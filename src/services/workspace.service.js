import { randomBytes } from "node:crypto";
import { Workspace } from "../models/Workspace.js";
import { WorkspaceTemplate } from "../models/WorkspaceTemplate.js";
import { WorkspaceEvent } from "../models/WorkspaceEvent.js";
import { ApiError } from "../utils/ApiError.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { env } from "../config/env.js";
import { WORKSPACE_PROFILES, WORKSPACE_STATUS, WORKSPACE_EVENT_TYPE } from "../constants/workspace.constants.js";
import * as dockerService from "./docker.service.js";

const toSlug = (name) =>
  `${name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${randomBytes(3).toString("hex")}`;

const generateAccessPassword = () => randomBytes(9).toString("base64url");

const logEvent = (workspaceId, userId, eventType, metadata = {}) =>
  WorkspaceEvent.create({ workspace: workspaceId, user: userId, eventType, metadata });

// Ownership check happens on every read/write. Returning 404 (not 403) for a
// workspace owned by someone else avoids leaking that the ID exists.
export const getOwnedWorkspace = async (workspaceId, userId) => {
  const workspace = await Workspace.findOne({ _id: workspaceId, user: userId });
  if (!workspace) throw new ApiError(404, "Workspace not found");
  return workspace;
};

// The container access password is a platform-managed credential (not user
// secret material), so — unlike custom environment values — it's fine to
// decrypt it back for the owner so they can actually log into their IDE.
export const toWorkspaceResponse = (workspace) => {
  const json = workspace.toJSON();
  const isRunning = workspace.status === WORKSPACE_STATUS.RUNNING;
  const port = env.workspaceProxyPort ? `:${env.workspaceProxyPort}` : "";
  return {
    ...json,
    accessUrl:
      isRunning && workspace.accessDomain
        ? `${env.workspaceProtocol}://${workspace.accessDomain}${port}`
        : null,
    accessPassword:
      isRunning && workspace.accessPasswordEncrypted ? decrypt(workspace.accessPasswordEncrypted) : null,
  };
};

export const listWorkspaces = (userId) => Workspace.find({ user: userId }).sort({ createdAt: -1 });

export const createWorkspace = async (userId, { name, templateId, profile }) => {
  const template = await WorkspaceTemplate.findById(templateId);
  if (!template) throw new ApiError(400, "Unknown workspace template");

  const limits = WORKSPACE_PROFILES[profile];
  const slug = toSlug(name);

  const workspace = await Workspace.create({
    user: userId,
    name,
    slug,
    template: template.id,
    accessDomain: `${slug}.${env.baseWorkspaceDomain}`,
    status: WORKSPACE_STATUS.CREATING,
    ...limits,
  });

  try {
    await dockerService.createWorkspaceVolume(slug);
    const accessPassword = generateAccessPassword();
    const containerId = await dockerService.createWorkspaceContainer({
      slug,
      image: template.image,
      cpuLimit: limits.cpuLimit,
      memoryLimitMb: limits.memoryLimitMb,
      env: { PASSWORD: accessPassword, ...(await resolveDecryptedEnvironment(workspace.id)) },
    });

    workspace.containerId = containerId;
    workspace.accessPasswordEncrypted = encrypt(accessPassword);
    workspace.status = WORKSPACE_STATUS.RUNNING;
    workspace.lastStartedAt = new Date();
    await workspace.save();
  } catch (error) {
    workspace.status = WORKSPACE_STATUS.ERROR;
    await workspace.save();
    await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.CREATED, { templateId, profile, error: error.message });
    throw new ApiError(502, "Failed to provision workspace container");
  }

  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.CREATED, { templateId, profile });
  return workspace;
};

export const updateWorkspace = async (userId, workspaceId, updates) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  Object.assign(workspace, updates);
  await workspace.save();
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.UPDATED, updates);
  return workspace;
};

export const deleteWorkspace = async (userId, workspaceId) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  if (workspace.containerId) await dockerService.removeContainer(workspace.containerId);
  await dockerService.removeWorkspaceVolume(workspace.slug);
  await workspace.deleteOne();
  await logEvent(workspaceId, userId, WORKSPACE_EVENT_TYPE.DELETED);
};

// If the container was removed outside the platform (manual `docker rm`,
// host cleanup), START recreates it against the same persistent volume —
// matches the spec's RECOVER lifecycle.
export const startWorkspace = async (userId, workspaceId) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  const template = await WorkspaceTemplate.findById(workspace.template);

  const existing = workspace.containerId ? await dockerService.inspectContainer(workspace.containerId) : null;

  if (existing) {
    await dockerService.startContainer(workspace.containerId);
  } else {
    // Self-heal workspaces created before accessDomain was assigned at creation time.
    workspace.accessDomain ??= `${workspace.slug}.${env.baseWorkspaceDomain}`;
    const accessPassword = generateAccessPassword();
    const containerId = await dockerService.createWorkspaceContainer({
      slug: workspace.slug,
      image: template.image,
      cpuLimit: workspace.cpuLimit,
      memoryLimitMb: workspace.memoryLimitMb,
      env: { PASSWORD: accessPassword, ...(await resolveDecryptedEnvironment(workspace.id)) },
    });
    workspace.containerId = containerId;
    workspace.accessPasswordEncrypted = encrypt(accessPassword);
  }

  workspace.status = WORKSPACE_STATUS.RUNNING;
  workspace.lastStartedAt = new Date();
  await workspace.save();
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.STARTED);
  return workspace;
};

export const stopWorkspace = async (userId, workspaceId) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  if (workspace.containerId) await dockerService.stopContainer(workspace.containerId);
  workspace.status = WORKSPACE_STATUS.STOPPED;
  await workspace.save();
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.STOPPED);
  return workspace;
};

export const restartWorkspace = async (userId, workspaceId) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  if (!workspace.containerId) throw new ApiError(409, "Workspace has no container to restart — start it first");

  await dockerService.restartContainer(workspace.containerId);
  workspace.status = WORKSPACE_STATUS.RUNNING;
  workspace.lastStartedAt = new Date();
  await workspace.save();
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.RESTARTED);
  return workspace;
};

// Reconciles DB status against the real container state (spec: detect
// unhealthy/dead container). Called from the status endpoint rather than
// every read, to avoid a Docker round-trip on every workspace list/fetch.
export const syncWorkspaceStatus = async (userId, workspaceId) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  if (!workspace.containerId) return workspace;

  const info = await dockerService.inspectContainer(workspace.containerId);
  if (!info) {
    workspace.status = WORKSPACE_STATUS.STOPPED;
    workspace.containerId = null;
  } else if (info.running) {
    workspace.status = WORKSPACE_STATUS.RUNNING;
  } else if (workspace.status === WORKSPACE_STATUS.RUNNING) {
    workspace.status = WORKSPACE_STATUS.ERROR;
  }
  await workspace.save();
  return workspace;
};

export const listWorkspaceEvents = async (userId, workspaceId) => {
  await getOwnedWorkspace(workspaceId, userId);
  return WorkspaceEvent.find({ workspace: workspaceId }).sort({ createdAt: -1 }).limit(200);
};

// Environment values are returned as keys only; the encrypted value never
// round-trips back to a client except through this deliberate helper.
export const listEnvironmentKeys = async (userId, workspaceId) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  return workspace.environment.map((entry) => entry.key);
};

export const setEnvironmentVariable = async (userId, workspaceId, key, value) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  const encryptedValue = encrypt(value);
  const existing = workspace.environment.find((entry) => entry.key === key);
  if (existing) {
    existing.encryptedValue = encryptedValue;
  } else {
    workspace.environment.push({ key, encryptedValue });
  }
  await workspace.save();
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.ENVIRONMENT_SET, { key });
  return workspace.environment.map((entry) => entry.key);
};

export const removeEnvironmentVariable = async (userId, workspaceId, key) => {
  const workspace = await getOwnedWorkspace(workspaceId, userId);
  workspace.environment = workspace.environment.filter((entry) => entry.key !== key);
  await workspace.save();
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.ENVIRONMENT_REMOVED, { key });
};

// Exposed only for the workspace container bootstrap step (never an HTTP response body).
export const resolveDecryptedEnvironment = async (workspaceId) => {
  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) throw new ApiError(404, "Workspace not found");
  return Object.fromEntries(workspace.environment.map((entry) => [entry.key, decrypt(entry.encryptedValue)]));
};
