// Integration tests against a real local MongoDB — no mocks.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

process.env.MONGO_URI ??= "mongodb://localhost:27017/cloud_workspace_auth_test";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ??= "test-refresh-secret";
process.env.ENV_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.ADMIN_EMAILS = `admin-${Date.now()}@test.local`;

const authService = await import("./auth.service.js");
const { User } = await import("../models/User.js");
const { ApiError } = await import("../utils/ApiError.js");
const { USER_ROLE } = await import("../constants/user.constants.js");

before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
});

after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("registering with an ADMIN_EMAILS address is auto-promoted to admin", async () => {
  const [adminEmail] = process.env.ADMIN_EMAILS.split(",");
  const user = await authService.registerUser({ name: "Admin", email: adminEmail, password: "password123" });
  assert.equal(user.role, USER_ROLE.ADMIN);
});

test("registering with an unrelated address stays a regular user", async () => {
  const user = await authService.registerUser({
    name: "Regular",
    email: `regular-${Date.now()}@test.local`,
    password: "password123",
  });
  assert.equal(user.role, USER_ROLE.USER);
});

test("a disabled account cannot log in, even with the correct password", async () => {
  const email = `disabled-${Date.now()}@test.local`;
  await authService.registerUser({ name: "Disabled", email, password: "password123" });
  await User.updateOne({ email }, { disabled: true });

  await assert.rejects(
    () => authService.validateCredentials(email, "password123"),
    (error) => error instanceof ApiError && error.statusCode === 403
  );
});

test("logging in with an ADMIN_EMAILS address promotes an existing user too, not just at registration", async () => {
  const [adminEmail] = process.env.ADMIN_EMAILS.split(",");
  // Simulate an account that existed before being added to ADMIN_EMAILS.
  await User.updateOne({ email: adminEmail }, { role: USER_ROLE.USER });
  const user = await authService.validateCredentials(adminEmail, "password123");
  assert.equal(user.role, USER_ROLE.ADMIN);
});
