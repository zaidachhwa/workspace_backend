import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { WorkspaceTemplate } from "../models/WorkspaceTemplate.js";

export const listWorkspaceTemplates = asyncHandler(async (req, res) => {
  const templates = await WorkspaceTemplate.find().sort({ name: 1 });
  sendSuccess(res, { data: templates });
});
