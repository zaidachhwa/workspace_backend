// Integration tests against a REAL local MongoDB and REAL Docker daemon.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.MONGO_URI ??= "mongodb://localhost:27017/cloud_workspace_admin_test";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ??= "test-refresh-secret";
process.env.ENV_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.BASE_WORKSPACE_DOMAIN ??= "test.localtest.me";

const { User } = await import("../models/User.js");
const { Workspace } = await import("../models/Workspace.js");
const { WorkspaceTemplate } = await import("../models/WorkspaceTemplate.js");
const workspaceService = await import("./workspace.service.js");
const adminService = await import("./admin.service.js");
const dockerService = await import("./docker.service.js");
const { WORKSPACE_STATUS } = await import("../constants/workspace.constants.js");

let userId;
let templateId;
let workspaceId;

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.create({ name: "Admin Target", email: `admin-target-${Date.now()}@test.local` });
  const template = await WorkspaceTemplate.create({
    name: `admin-test-template-${Date.now()}`,
    image: "cloudworkspace/dev-node:latest",
  });
  userId = user.id;
  templateId = template.id;
});

after(async () => {
  if (workspaceId) await workspaceService.deleteWorkspace(userId, workspaceId).catch(() => {});
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("listUsers includes owned workspaces with an accurate count", async () => {
  const { workspace } = await workspaceService.createWorkspace(userId, {
    name: "admin-list-test",
    templateId,
    profile: "small",
  });
  workspaceId = workspace.id;

  const users = await adminService.listUsers();
  const target = users.find((u) => String(u.id) === String(userId));
  assert.ok(target, "target user should be in the list");
  assert.equal(target.workspaceCount, 1);
  assert.equal(target.workspaces[0].name, "admin-list-test");
});

test("updateUser changes the workspace quota", async () => {
  const updated = await adminService.updateUser(userId, { workspaceQuota: 2 });
  assert.equal(updated.workspaceQuota, 2);
});

test("disabling a user actually stops their running workspaces, not just future logins", async () => {
  await adminService.updateUser(userId, { disabled: true });

  const workspace = await Workspace.findById(workspaceId);
  assert.equal(workspace.status, WORKSPACE_STATUS.STOPPED);

  const info = await dockerService.inspectContainer(workspace.containerId);
  assert.equal(info.running, false);
});
