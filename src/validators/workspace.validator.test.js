import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceSchema, environmentVariableSchema } from "./workspace.validator.js";

const validBase = { name: "my-project", templateId: "507f1f77bcf86cd799439011" };

test("createWorkspaceSchema accepts a minimal valid payload and defaults profile to small", async () => {
  const result = await createWorkspaceSchema.validate(validBase);
  assert.equal(result.profile, "small");
});

test("createWorkspaceSchema rejects an unknown profile — clients can't send raw resource limits", async () => {
  await assert.rejects(() => createWorkspaceSchema.validate({ ...validBase, profile: "xlarge" }));
});

test("createWorkspaceSchema requires a name", async () => {
  await assert.rejects(() => createWorkspaceSchema.validate({ templateId: validBase.templateId }));
});

test("createWorkspaceSchema allows gitRepoUrl to be omitted or blank", async () => {
  await assert.doesNotReject(() => createWorkspaceSchema.validate(validBase));
  await assert.doesNotReject(() => createWorkspaceSchema.validate({ ...validBase, gitRepoUrl: "" }));
});

test("createWorkspaceSchema accepts a public https repo URL", async () => {
  const result = await createWorkspaceSchema.validate({
    ...validBase,
    gitRepoUrl: "https://github.com/octocat/Hello-World.git",
  });
  assert.equal(result.gitRepoUrl, "https://github.com/octocat/Hello-World.git");
});

test("createWorkspaceSchema rejects a non-https repo URL — no SSH keys to manage", async () => {
  await assert.rejects(() => createWorkspaceSchema.validate({ ...validBase, gitRepoUrl: "git@github.com:user/repo.git" }));
  await assert.rejects(() => createWorkspaceSchema.validate({ ...validBase, gitRepoUrl: "http://example.com/repo.git" }));
});

test("environmentVariableSchema requires UPPER_SNAKE_CASE keys", async () => {
  await assert.doesNotReject(() => environmentVariableSchema.validate({ key: "DATABASE_URL", value: "x" }));
  await assert.rejects(() => environmentVariableSchema.validate({ key: "database_url", value: "x" }));
  await assert.rejects(() => environmentVariableSchema.validate({ key: "1BAD", value: "x" }));
});
