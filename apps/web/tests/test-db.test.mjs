import assert from "node:assert/strict";
import test from "node:test";

test("GET /api/test-db confirms the database is reachable", async () => {
  const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/test-db`, {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, database: "connected" });
});