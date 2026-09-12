import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  environmentVariableSchema,
  addMemberSchema,
} from "../validators/workspace.validator.js";
import * as workspaceService from "../services/workspace.service.js";

export const listWorkspaces = asyncHandler(async (req, res) => {
  const workspaces = await workspaceService.listWorkspaces(req.user.id);
  sendSuccess(res, { data: workspaces.map((w) => workspaceService.toWorkspaceResponse(w, req.user.id)) });
});

export const createWorkspace = asyncHandler(async (req, res) => {
  const input = await createWorkspaceSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const { workspace, gitImportError } = await workspaceService.createWorkspace(req.user.id, input);
  sendSuccess(res, {
    status: 201,
    message: "Workspace created",
    data: { ...workspaceService.toWorkspaceResponse(workspace, req.user.id), gitImportError },
  });
});

export const getWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.getAccessibleWorkspace(req.params.id, req.user.id);
  sendSuccess(res, { data: workspaceService.toWorkspaceResponse(workspace, req.user.id) });
});

export const updateWorkspace = asyncHandler(async (req, res) => {
  const input = await updateWorkspaceSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const workspace = await workspaceService.updateWorkspace(req.user.id, req.params.id, input);
  sendSuccess(res, { message: "Workspace updated", data: workspaceService.toWorkspaceResponse(workspace, req.user.id) });
});

export const deleteWorkspace = asyncHandler(async (req, res) => {
  await workspaceService.deleteWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace deleted" });
});

export const startWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.startWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace started", data: workspaceService.toWorkspaceResponse(workspace, req.user.id) });
});

export const stopWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.stopWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace stopped", data: workspaceService.toWorkspaceResponse(workspace, req.user.id) });
});

export const restartWorkspace = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.restartWorkspace(req.user.id, req.params.id);
  sendSuccess(res, { message: "Workspace restarted", data: workspaceService.toWorkspaceResponse(workspace, req.user.id) });
});

export const getWorkspaceStatus = asyncHandler(async (req, res) => {
  const workspace = await workspaceService.syncWorkspaceStatus(req.user.id, req.params.id);
  const { status, lastStartedAt, accessUrl } = workspaceService.toWorkspaceResponse(workspace, req.user.id);
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

export const listMembers = asyncHandler(async (req, res) => {
  const { owner, members } = await workspaceService.listMembers(req.user.id, req.params.id);
  sendSuccess(res, { data: { owner, members } });
});

export const addMember = asyncHandler(async (req, res) => {
  const { email } = await addMemberSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const member = await workspaceService.addMember(req.user.id, req.params.id, email);
  sendSuccess(res, { status: 201, message: "Member added", data: member });
});

export const removeMember = asyncHandler(async (req, res) => {
  await workspaceService.removeMember(req.user.id, req.params.id, req.params.memberId);
  sendSuccess(res, { message: "Member removed" });
});
