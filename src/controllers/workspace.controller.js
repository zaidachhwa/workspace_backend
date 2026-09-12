import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  environmentVariableSchema,
} from "../validators/workspace.validator.js";
import * as workspaceService from "../services/workspace.service.js";

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await workspaceService.listWorkspaces(req.user.id);
  sendSuccess(res, { data: workspaces.map(workspaceService.toWorkspaceResponse) });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const input = await createWorkspaceSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const { workspace, gitImportError } = await workspaceService.createWorkspace(req.user.id, input);
  sendSuccess(res, {
    status: 201,
    message: "Workspace created",
    data: { ...workspaceService.toWorkspaceResponse(workspace), gitImportError },
  });
});

export const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.getOwnedWorkspace(req.params.id, req.user.id);
  sendSuccess(res, { data: workspaceService.toWorkspaceResponse(workspace) });
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  const input = await updateWorkspaceSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const workspace = await workspaceService.updateWorkspace(req.user.id, req.params.id, input);
  sendSuccess(res, { message: "Workspace updated", data: workspace });
});

export const deleteWorkspace = asyncHandler(async (req, res) => {
  await workspaceService.deleteWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace deleted" });
});

export const startWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.startWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace started", data: workspaceService.toWorkspaceResponse(workspace) });
});

export const stopWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.stopWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace stopped", data: workspaceService.toWorkspaceResponse(workspace) });
});

export const restartWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.restartWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace restarted", data: workspaceService.toWorkspaceResponse(workspace) });
});

export const getWorkspaceStatus = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.syncWorkspaceStatus(req.user.id, req.params.id);
  const { status, lastStartedAt, accessUrl } = workspaceService.toWorkspaceResponse(workspace);
  sendSuccess(res, { data: { status, lastStartedAt, accessUrl } });
});

export const listWorkspaceEvents = asyncHandler(async (req, res) => {
  const events = await workspaceService.listWorkspaceEvents(req.user.id, req.params.id);
  sendSuccess(res, { data: events });
});

export const listEnvironmentKeys = asyncHandler(async (req, res) => {
  const keys = await workspaceService.listEnvironmentKeys(req.user.id, req.params.id);
  sendSuccess(res, { data: keys });
});

export const setEnvironmentVariable = asyncHandler(async (req, res) => {
  const { key, value } = await environmentVariableSchema.validate(req.body, {
    abortEarly: true,
    stripUnknown: true,
  });
  const keys = await workspaceService.setEnvironmentVariable(req.user.id, req.params.id, key, value);
  sendSuccess(res, { message: "Environment variable saved", data: keys });
});

export const removeEnvironmentVariable = asyncHandler(async (req, res) => {
  await workspaceService.removeEnvironmentVariable(req.user.id, req.params.id, req.params.key);
  sendSuccess(res, { message: "Environment variable removed" });
});
