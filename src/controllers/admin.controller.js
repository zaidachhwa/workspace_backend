import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { updateUserSchema } from "../validators/admin.validator.js";
import * as adminService from "../services/admin.service.js";

export const listUsers = asyncHandler(async (req, res) => {
  const users = await adminService.listUsers();
  sendSuccess(res, { data: users });
});

export const updateUser = asyncHandler(async (req, res) => {
  const input = await updateUserSchema.validate(req.body, { abortEarly: true, stripUnknown: true });
  const user = await adminService.updateUser(req.params.id, input);
  sendSuccess(res, { message: "User updated", data: user });
});
