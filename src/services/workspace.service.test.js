// Integration tests against a REAL local MongoDB and REAL Docker daemon —
// no mocks. Precondition: `cloudworkspace/dev-node:latest` must already be
// built locally (it's our own image, not pullable from a public registry;
// see infra/docker/workspace/Dockerfile).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.MONGO_URI ??= "mongodb://localhost:27017/cloud_workspace_service_test";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ??= "test-refresh-secret";
process.env.ENV_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.BASE_WORKSPACE_DOMAIN ??= "test.localtest.me";

const { User } = await import("../models/User.js");
const { WorkspaceTemplate } = await import("../models/WorkspaceTemplate.js");
const workspaceService = await import("./workspace.service.js");
const dockerService = await import("./docker.service.js");
const { ApiError } = await import("../utils/ApiError.js");
const { WORKSPACE_STATUS } = await import("../constants/workspace.constants.js");

let ownerId;
let otherUserId;
let templateId;
let workspaceId;

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const owner = await User.create({ name: "Test Owner", email: `owner-${Date.now()}@test.local` });
  const otherUser = await User.create({ name: "Other User", email: `other-${Date.now()}@test.local` });
  const template = await WorkspaceTemplate.create({
    name: `test-template-${Date.now()}`,
    image: "cloudworkspace/dev-node:latest",
  });
  ownerId = owner.id;
  otherUserId = otherUser.id;
  templateId = template.id;
});

after(async () => {
  // Best-effort: if a test failed mid-lifecycle, still try to remove the
  // container/volume so a broken test run doesn't leak Docker resources.
  if (workspaceId) {
    await workspaceService.deleteWorkspace(ownerId, workspaceId).catch(() => {});
  }
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("createWorkspace provisions a real running container", async () => {
  const { workspace } = await workspaceService.createWorkspace(ownerId, {
    name: "lifecycle-test",
    templateId,
    profile: "small",
  });
  workspaceId = workspace.id;

  assert.equal(workspace.status, WORKSPACE_STATUS.RUNNING);
  assert.ok(workspace.containerId, "containerId should be set");
  assert.equal(workspace.accessDomain, `${workspace.slug}.test.localtest.me`);

  const info = await dockerService.inspectContainer(workspace.containerId);
  assert.equal(info.running, true);
});

test("getOwnedWorkspace returns the workspace for its owner", async () => {
  const workspace = await workspaceService.getOwnedWorkspace(workspaceId, ownerId);
  assert.equal(workspace.id, workspaceId);
});

test("getOwnedWorkspace 404s for a different user — core authorization guarantee", async () => {
  await assert.rejects(
    () => workspaceService.getOwnedWorkspace(workspaceId, otherUserId),
    (error) => error instanceof ApiError && error.statusCode === 404
  );
});

test("stopWorkspace actually stops the container", async () => {
  const workspace = await workspaceService.stopWorkspace(ownerId, workspaceId);
  assert.equal(workspace.status, WORKSPACE_STATUS.STOPPED);

  const info = await dockerService.inspectContainer(workspace.containerId);
  assert.equal(info.running, false);
});

test("startWorkspace starts the same container again", async () => {
  const workspace = await workspaceService.startWorkspace(ownerId, workspaceId);
  assert.equal(workspace.status, WORKSPACE_STATUS.RUNNING);

  const info = await dockerService.inspectContainer(workspace.containerId);
  assert.equal(info.running, true);
});

test("restartWorkspace by another user is denied, not just ignored", async () => {
  await assert.rejects(
    () => workspaceService.restartWorkspace(otherUserId, workspaceId),
    (error) => error instanceof ApiError && error.statusCode === 404
  );
});

test("deleteWorkspace removes the container, the volume, and the DB record", async () => {
  const workspace = await workspaceService.getOwnedWorkspace(workspaceId, ownerId);
  const { containerId, slug } = workspace;

  await workspaceService.deleteWorkspace(ownerId, workspaceId);
  workspaceId = null; // deleted — don't try again in the `after` hook

  const containerInfo = await dockerService.inspectContainer(containerId);
  assert.equal(containerInfo, null, "container should no longer exist");

  await assert.rejects(() => workspaceService.getOwnedWorkspace(workspace.id, ownerId));

  const Docker = (await import("dockerode")).default;
  const docker = new Docker({ socketPath: "/var/run/docker.sock" });
  await assert.rejects(() => docker.getVolume(`cw-volume-${slug}`).inspect(), "volume should be removed");
});
