import * as yup from "yup";

export const updateUserSchema = yup.object({
  workspaceQuota: yup.number().integer().min(0),
  disabled: yup.boolean(),
});
