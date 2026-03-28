import { describe, it, expect, beforeEach } from "vitest";
import { executeStep, executePlan } from "../src/agent/executor.js";
import { MockWatiClient } from "../src/wati/mock.js";
import type { PlanStep } from "../src/agent/planner.js";

describe("executor", () => {
  let wati: MockWatiClient;

  beforeEach(() => {
    wati = new MockWatiClient();
  });

  describe("executeStep", () => {
    it("executes search_contacts", async () => {
      const step: PlanStep = {
        toolCallId: "tc1",
        toolName: "search_contacts",
        toolInput: { tag: "VIP" },
        description: "Search VIP contacts",
        destructive: false,
      };
      const result = await executeStep(step, wati);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty("items");
    });

    it("executes add_contact", async () => {
      const step: PlanStep = {
        toolCallId: "tc2",
        toolName: "add_contact",
        toolInput: { whatsapp_number: "5511987654321", name: "Ana Beatriz" },
        description: "Add contact",
        destructive: true,
      };
      const result = await executeStep(step, wati);
      expect(result.success).toBe(true);
    });

    it("executes add_tag", async () => {
      const step: PlanStep = {
        toolCallId: "tc3",
        toolName: "add_tag",
        toolInput: { whatsapp_number: "5511999001001", tag: "test" },
        description: "Add tag",
        destructive: true,
      };
      const result = await executeStep(step, wati);
      expect(result.success).toBe(true);
    });

    it("handles unknown tool gracefully", async () => {
      const step: PlanStep = {
        toolCallId: "tc4",
        toolName: "unknown_tool",
        toolInput: {},
        description: "Unknown",
        destructive: false,
      };
      const result = await executeStep(step, wati);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown tool");
    });
  });

  describe("executePlan", () => {
    it("executes multiple steps in sequence", async () => {
      const steps: PlanStep[] = [
        {
          toolCallId: "tc1",
          toolName: "add_contact",
          toolInput: { whatsapp_number: "5500000000001", name: "Plan Test" },
          description: "Add contact",
          destructive: true,
        },
        {
          toolCallId: "tc2",
          toolName: "add_tag",
          toolInput: { whatsapp_number: "5500000000001", tag: "plan-test" },
          description: "Add tag",
          destructive: true,
        },
      ];

      const results = await executePlan(steps, wati);
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);

      // Verify state was updated
      const info = await wati.getContactInfo("5500000000001");
      expect(info).not.toBeNull();
      expect(info!.tags).toContain("plan-test");
    });

    it("stops execution on failure", async () => {
      const steps: PlanStep[] = [
        {
          toolCallId: "tc1",
          toolName: "unknown_tool",
          toolInput: {},
          description: "Will fail",
          destructive: false,
        },
        {
          toolCallId: "tc2",
          toolName: "search_contacts",
          toolInput: {},
          description: "Should not run",
          destructive: false,
        },
      ];

      const results = await executePlan(steps, wati);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
    });

    it("calls onStepComplete callback", async () => {
      const steps: PlanStep[] = [
        {
          toolCallId: "tc1",
          toolName: "get_templates",
          toolInput: {},
          description: "Get templates",
          destructive: false,
        },
      ];

      const completed: number[] = [];
      await executePlan(steps, wati, (r) => completed.push(r.stepIndex));
      expect(completed).toEqual([0]);
    });
  });
});
