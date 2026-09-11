import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDurationMs } from "./duration.js";

test("parses each supported unit", () => {
  assert.equal(parseDurationMs("15m"), 15 * 60_000);
  assert.equal(parseDurationMs("7d"), 7 * 86_400_000);
  assert.equal(parseDurationMs("30s"), 30_000);
  assert.equal(parseDurationMs("2h"), 2 * 3_600_000);
});

test("rejects an invalid format", () => {
  assert.throws(() => parseDurationMs("banana"));
});
