import { describe, it, expect } from "vitest";
import { buildPlan } from "../src/agent/planner.js";
import type { ContentBlock } from "../src/llm/types.js";

describe("buildPlan", () => {
  it("builds a plan from tool_use blocks", () => {
    const blocks: ContentBlock[] = [
      { type: "text", text: "I'll add the contact and tag them." },
      {
        type: "tool_use",
        id: "tc1",
        name: "add_contact",
        input: { whatsapp_number: "5511987654321", name: "Ana Beatriz" },
      },
      {
        type: "tool_use",
        id: "tc2",
        name: "add_tag",
        input: { whatsapp_number: "5511987654321", tag: "new-customer" },
      },
    ];

    const plan = buildPlan(blocks);
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].toolName).toBe("add_contact");
    expect(plan.steps[1].toolName).toBe("add_tag");
    expect(plan.summary).toContain("add the contact");
  });

  it("marks destructive steps", () => {
    const blocks: ContentBlock[] = [
      {
        type: "tool_use",
        id: "tc1",
        name: "send_template_message",
        input: {
          whatsapp_number: "5511987654321",
          template_name: "welcome_message",
          broadcast_name: "test",
        },
      },
    ];

    const plan = buildPlan(blocks);
    expect(plan.steps[0].destructive).toBe(true);
    expect(plan.requiresConfirmation).toBe(true);
  });

  it("does not require confirmation for read-only tools", () => {
    const blocks: ContentBlock[] = [
      {
        type: "tool_use",
        id: "tc1",
        name: "search_contacts",
        input: { tag: "VIP" },
      },
      {
        type: "tool_use",
        id: "tc2",
        name: "get_templates",
        input: {},
      },
    ];

    const plan = buildPlan(blocks);
    expect(plan.requiresConfirmation).toBe(false);
  });

  it("handles empty content blocks", () => {
    const plan = buildPlan([]);
    expect(plan.steps).toHaveLength(0);
    expect(plan.requiresConfirmation).toBe(false);
  });

  it("generates descriptions for each tool type", () => {
    const blocks: ContentBlock[] = [
      { type: "tool_use", id: "1", name: "search_contacts", input: { tag: "VIP" } },
      { type: "tool_use", id: "2", name: "get_contact_info", input: { whatsapp_number: "123" } },
      { type: "tool_use", id: "3", name: "add_contact", input: { whatsapp_number: "123", name: "Test" } },
      { type: "tool_use", id: "4", name: "add_tag", input: { whatsapp_number: "123", tag: "vip" } },
      { type: "tool_use", id: "5", name: "get_templates", input: {} },
      { type: "tool_use", id: "6", name: "get_operators", input: {} },
    ];

    const plan = buildPlan(blocks);
    expect(plan.steps).toHaveLength(6);
    // Each step should have a non-empty description
    for (const step of plan.steps) {
      expect(step.description.length).toBeGreaterThan(0);
    }
  });
});
