import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ENV_ENCRYPTION_KEY ??= "0".repeat(64);
process.env.MONGO_URI ??= "mongodb://localhost:27017/test";
process.env.ACCESS_TOKEN_SECRET ??= "test-access-secret";
process.env.REFRESH_TOKEN_SECRET ??= "test-refresh-secret";
const { encrypt, decrypt } = await import("./encryption.js");

test("encrypt/decrypt round-trips a plaintext value", () => {
  const ciphertext = encrypt("super-secret-value");
  assert.notEqual(ciphertext, "super-secret-value");
  assert.equal(decrypt(ciphertext), "super-secret-value");
});

test("each encryption uses a fresh IV, so ciphertexts differ", () => {
  assert.notEqual(encrypt("same-value"), encrypt("same-value"));
});
