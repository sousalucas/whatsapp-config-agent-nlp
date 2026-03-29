import { test as base, expect } from "@playwright/test";
import {
  startTestServer,
  stopTestServer,
  type TestContext,
} from "./test-server.js";

type TestFixtures = {
  testContext: TestContext;
};

export const test = base.extend<TestFixtures>({
  testContext: async ({}, use) => {
    const ctx = await startTestServer();
    await use(ctx);
    await stopTestServer(ctx);
  },
});

export { expect };
