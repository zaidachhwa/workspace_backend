import { User } from "../models/User.js";
import { Workspace } from "../models/Workspace.js";
import { ApiError } from "../utils/ApiError.js";
import { WORKSPACE_STATUS } from "../constants/workspace.constants.js";
import * as dockerService from "./docker.service.js";

export const listUsers = async () => {
  const users = await User.find().sort({ createdAt: -1 });
  const workspaces = await Workspace.find().select("user name status");

  const workspacesByUser = new Map();
  for (const workspace of workspaces) {
    const key = String(workspace.user);
    if (!workspacesByUser.has(key)) workspacesByUser.set(key, []);
    workspacesByUser.get(key).push({ id: workspace.id, name: workspace.name, status: workspace.status });
  }

  return users.map((user) => {
    const owned = workspacesByUser.get(String(user.id)) ?? [];
    return { ...user.toJSON(), workspaceCount: owned.length, workspaces: owned };
  });
};

export const updateUser = async (userId, { workspaceQuota, disabled }) => {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (workspaceQuota !== undefined) user.workspaceQuota = workspaceQuota;

  const isBeingDisabled = disabled === true && !user.disabled;
  if (disabled !== undefined) user.disabled = disabled;
  await user.save();

  // Disabling stops the ability to work, not just future logins — an
  // already-open session could otherwise keep using running workspaces for
  // up to the access token's remaining 15 minutes.
  if (isBeingDisabled) {
    const runningWorkspaces = await Workspace.find({ user: userId, status: WORKSPACE_STATUS.RUNNING });
    for (const workspace of runningWorkspaces) {
      if (workspace.containerId) await dockerService.stopContainer(workspace.containerId).catch(() => {});
      workspace.status = WORKSPACE_STATUS.STOPPED;
      await workspace.save();
    }
  }

  return user;
};
