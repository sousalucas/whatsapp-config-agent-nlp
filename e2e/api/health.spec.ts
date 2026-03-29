import { test, expect } from "../fixtures/playwright-fixtures.js";

test.describe("GET /api/health", () => {
  test("returns ok status", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/health`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toEqual({ status: "ok" });
  });
});
