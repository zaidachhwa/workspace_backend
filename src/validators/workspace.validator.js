import * as yup from "yup";
import { WORKSPACE_PROFILES } from "../constants/workspace.constants.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createWorkspaceSchema = yup.object({
  name: yup.string().trim().min(2).max(100).required(),
  templateId: yup.string().required(),
  profile: yup.string().oneOf(Object.keys(WORKSPACE_PROFILES)).default("small"),
  // Public repos only for now — HTTPS avoids needing to manage SSH keys/credentials.
  gitRepoUrl: yup
    .string()
    .trim()
    .matches(/^https:\/\/.+/, { message: "must be a public https:// repository URL", excludeEmptyString: true })
    .optional(),
});

export const updateWorkspaceSchema = yup.object({
  name: yup.string().trim().min(2).max(100),
});

export const environmentVariableSchema = yup.object({
  key: yup
    .string()
    .trim()
    .matches(/^[A-Z_][A-Z0-9_]*$/, "key must be UPPER_SNAKE_CASE")
    .required(),
  value: yup.string().required(),
});

export const slugSchema = yup.string().matches(slugPattern);

export const addMemberSchema = yup.object({
  email: yup.string().trim().email().required(),
});
