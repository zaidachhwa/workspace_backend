import { randomBytes } from "node:crypto";
import { WorkspaceSnapshot } from "../models/WorkspaceSnapshot.js";
import { ApiError } from "../utils/ApiError.js";
import { WORKSPACE_STATUS, WORKSPACE_EVENT_TYPE } from "../constants/workspace.constants.js";
import { getAccessibleWorkspace, logEvent } from "./workspace.service.js";
import * as dockerService from "./docker.service.js";

const generateFilename = () => `${Date.now()}-${randomBytes(3).toString("hex")}.tar.gz`;

export const listSnapshots = async (userId, workspaceId) => {
  await getAccessibleWorkspace(workspaceId, userId);
  return WorkspaceSnapshot.find({ workspace: workspaceId }).sort({ createdAt: -1 });
};

// Allowed while running — a snapshot of a live filesystem is a reasonable
// "save my current work" action; restoring is the destructive half, so
// that's the one that requires the workspace to be stopped first.
export const createSnapshot = async (userId, workspaceId) => {
  const workspace = await getAccessibleWorkspace(workspaceId, userId);
  const filename = generateFilename();
  const sizeBytes = await dockerService.createSnapshot(workspace.slug, filename);
  const snapshot = await WorkspaceSnapshot.create({ workspace: workspace.id, filename, sizeBytes });
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.SNAPSHOT_CREATED, { snapshotId: snapshot.id });
  return snapshot;
};

export const restoreSnapshot = async (userId, workspaceId, snapshotId) => {
  const workspace = await getAccessibleWorkspace(workspaceId, userId);
  if (workspace.status !== WORKSPACE_STATUS.STOPPED) {
    throw new ApiError(409, "Stop the workspace before restoring a snapshot");
  }

  const snapshot = await WorkspaceSnapshot.findOne({ _id: snapshotId, workspace: workspace.id });
  if (!snapshot) throw new ApiError(404, "Snapshot not found");

  await dockerService.restoreSnapshot(workspace.slug, snapshot.filename);
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.SNAPSHOT_RESTORED, { snapshotId: snapshot.id });
};

export const deleteSnapshot = async (userId, workspaceId, snapshotId) => {
  const workspace = await getAccessibleWorkspace(workspaceId, userId);
  const snapshot = await WorkspaceSnapshot.findOneAndDelete({ _id: snapshotId, workspace: workspace.id });
  if (!snapshot) throw new ApiError(404, "Snapshot not found");

  await dockerService.deleteSnapshotFile(workspace.slug, snapshot.filename);
  await logEvent(workspace.id, userId, WORKSPACE_EVENT_TYPE.SNAPSHOT_DELETED, { snapshotId: snapshot.id });
};
