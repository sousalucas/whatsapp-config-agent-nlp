import { createWebApp } from "../../src/interfaces/web.js";
import { Agent } from "../../src/agent/agent.js";
import { MockWatiClient } from "../../src/wati/mock.js";
import { MockLLMProvider } from "./mock-llm.js";
import type { Server } from "http";
import type express from "express";

export interface TestContext {
  baseURL: string;
  server: Server;
  app: express.Express;
  agent: Agent;
  llm: MockLLMProvider;
  wati: MockWatiClient;
}

export async function startTestServer(): Promise<TestContext> {
  const llm = new MockLLMProvider();
  const wati = new MockWatiClient();
  const agent = new Agent(llm, wati);
  const app = createWebApp(agent);

  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({
        baseURL: `http://localhost:${port}`,
        server,
        app,
        agent,
        llm,
        wati,
      });
    });
  });
}

export async function stopTestServer(ctx: TestContext): Promise<void> {
  return new Promise((resolve) => {
    ctx.server.close(() => resolve());
  });
}
