import type { LLMProvider, LLMMessage, ContentBlock } from "../llm/types.js";
import type { WatiClient } from "../wati/types.js";
import { AGENT_TOOLS } from "./tools.js";
import { buildPlan, type Plan } from "./planner.js";
import { executePlan, type StepResult } from "./executor.js";
import { setLocale, t } from "../i18n/index.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const SYSTEM_PROMPT = `You are a WhatsApp Business API assistant powered by WATI. You help users manage their contacts, messages, templates, and operator assignments through natural language.

BEHAVIOR:
- When the user asks you to do something, plan the necessary API calls using the tools available to you.
- Always verify before acting (e.g., check if a template exists before sending it, confirm a contact exists before messaging them).
- Return ALL tool calls needed to fulfill the request in a single response when possible.
- Respond in the same language the user writes in. If the user writes in Portuguese, respond in Portuguese.
- On your FIRST response, call set_language with the detected language of the user's message.

SAFETY:
- Never send messages without being explicitly asked.
- If the user's request is ambiguous or missing required information, ask for clarification instead of guessing.
- Prefer reading/searching operations to narrow down targets before writing operations.

CONTEXT:
- You have access to a WATI WhatsApp Business API instance.
- Contacts have names, phone numbers (with country code, digits only), tags, and custom attributes.
- Message templates are pre-approved by WhatsApp and have named parameters like {{1}}, {{2}}.
- When sending template messages, the broadcast_name can be a descriptive name for tracking (e.g., "onboarding_ana_2025").

FORMATTING:
- Be concise and helpful.
- When presenting results, format them clearly.
- Explain what each action does when presenting a plan.`;

export interface AgentResponse {
  text: string;
  plan: Plan | null;
}

export class Agent {
  private messages: LLMMessage[] = [];
  private pendingPlan: Plan | null = null;
  private pendingAssistantContent: ContentBlock[] | null = null;

  constructor(
    private llm: LLMProvider,
    private wati: WatiClient
  ) {}

  async handleUserInput(text: string): Promise<AgentResponse> {
    this.messages.push({ role: "user", content: text });

    try {
      const response = await this.llm.chat({
        systemPrompt: SYSTEM_PROMPT,
        messages: this.messages,
        tools: AGENT_TOOLS,
      });

      if (response.stopReason === "end_turn") {
        this.messages.push({ role: "assistant", content: response.content });
        const textContent = response.content
          .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return { text: textContent, plan: null };
      }

      // LLM wants to use tools — process set_language immediately, build plan for the rest
      const toolUseBlocks = response.content.filter(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
      );

      // Handle set_language immediately (internal tool, no confirmation needed)
      const langTool = toolUseBlocks.find((b) => b.name === "set_language");
      if (langTool) {
        const lang = langTool.input.language as string;
        setLocale(lang);
      }

      // Check if there are only non-destructive read operations — execute immediately
      const plan = buildPlan(response.content);

      // Filter out set_language from displayed plan
      plan.steps = plan.steps.filter((s) => s.toolName !== "set_language");

      if (plan.steps.length === 0) {
        // Only set_language was called — we need to provide tool results and continue
        const toolResults: ContentBlock[] = toolUseBlocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: JSON.stringify({ success: true }),
        }));

        this.messages.push({ role: "assistant", content: response.content });
        this.messages.push({ role: "user", content: toolResults });

        // Continue the conversation — LLM might have more to say
        return this.continueAfterToolResults();
      }

      if (!plan.requiresConfirmation) {
        // Read-only operations: execute immediately and feed results back to LLM
        return this.executeAndContinue(plan, response.content, toolUseBlocks);
      }

      // Destructive operations: show plan and wait for confirmation
      this.pendingPlan = plan;
      this.pendingAssistantContent = response.content;
      return { text: plan.summary, plan };
    } catch (err) {
      // Remove the user message we just pushed since the request failed
      this.messages.pop();
      throw this.wrapError(err, "handleUserInput");
    }
  }

  async executePendingPlan(
    onStepComplete?: (result: StepResult) => void
  ): Promise<AgentResponse> {
    if (!this.pendingPlan || !this.pendingAssistantContent) {
      return { text: t("plan.no_pending"), plan: null };
    }

    const plan = this.pendingPlan;
    const assistantContent = this.pendingAssistantContent;
    this.pendingPlan = null;
    this.pendingAssistantContent = null;

    // Execute all steps (including set_language results)
    const allToolUseBlocks = assistantContent.filter(
      (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
    );

    const results = await executePlan(plan.steps, this.wati, onStepComplete);

    // Build tool_result messages for all tool calls
    const toolResults: ContentBlock[] = allToolUseBlocks.map((block) => {
      if (block.name === "set_language") {
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: JSON.stringify({ success: true }),
        };
      }
      const result = results.find(
        (r) => plan.steps[r.stepIndex]?.toolCallId === block.id
      );
      return {
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: result
          ? JSON.stringify(result.success ? result.data : { error: result.error })
          : JSON.stringify({ error: "Step not executed" }),
      };
    });

    // Add to conversation and let LLM summarize
    this.messages.push({ role: "assistant", content: assistantContent });
    this.messages.push({ role: "user", content: toolResults });

    try {
      return await this.continueAfterToolResults();
    } catch (err) {
      throw this.wrapError(err, "executePendingPlan");
    }
  }

  cancelPlan(): void {
    this.pendingPlan = null;
    this.pendingAssistantContent = null;
  }

  hasPendingPlan(): boolean {
    return this.pendingPlan !== null;
  }

  private async executeAndContinue(
    plan: Plan,
    assistantContent: ContentBlock[],
    allToolUseBlocks: Extract<ContentBlock, { type: "tool_use" }>[]
  ): Promise<AgentResponse> {
    const results = await executePlan(plan.steps, this.wati);

    const toolResults: ContentBlock[] = allToolUseBlocks.map((block) => {
      if (block.name === "set_language") {
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: JSON.stringify({ success: true }),
        };
      }
      const result = results.find(
        (r) => plan.steps[r.stepIndex]?.toolCallId === block.id
      );
      return {
        type: "tool_result" as const,
        tool_use_id: block.id,
        content: result
          ? JSON.stringify(result.success ? result.data : { error: result.error })
          : JSON.stringify({ error: "Step not executed" }),
      };
    });

    this.messages.push({ role: "assistant", content: assistantContent });
    this.messages.push({ role: "user", content: toolResults });

    return this.continueAfterToolResults();
  }

  private async continueAfterToolResults(): Promise<AgentResponse> {
    // Let the LLM process tool results — it may call more tools or give a final answer
    const maxIterations = 10;

    for (let i = 0; i < maxIterations; i++) {
      const response = await this.llm.chat({
        systemPrompt: SYSTEM_PROMPT,
        messages: this.messages,
        tools: AGENT_TOOLS,
      });

      if (response.stopReason === "end_turn") {
        this.messages.push({ role: "assistant", content: response.content });
        const textContent = response.content
          .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        return { text: textContent, plan: null };
      }

      // More tool calls — check if destructive
      const toolUseBlocks = response.content.filter(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
      );

      // Handle set_language
      const langTool = toolUseBlocks.find((b) => b.name === "set_language");
      if (langTool) {
        setLocale(langTool.input.language as string);
      }

      const plan = buildPlan(response.content);
      plan.steps = plan.steps.filter((s) => s.toolName !== "set_language");

      if (plan.steps.length === 0) {
        // Only set_language — provide result and continue
        const toolResults: ContentBlock[] = toolUseBlocks.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.id,
          content: JSON.stringify({ success: true }),
        }));
        this.messages.push({ role: "assistant", content: response.content });
        this.messages.push({ role: "user", content: toolResults });
        continue;
      }

      if (plan.requiresConfirmation) {
        // Needs user confirmation — return plan
        this.pendingPlan = plan;
        this.pendingAssistantContent = response.content;
        return { text: plan.summary, plan };
      }

      // Non-destructive — execute immediately
      const results = await executePlan(plan.steps, this.wati);
      const toolResults: ContentBlock[] = toolUseBlocks.map((block) => {
        if (block.name === "set_language") {
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify({ success: true }),
          };
        }
        const result = results.find(
          (r) => plan.steps[r.stepIndex]?.toolCallId === block.id
        );
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: result
            ? JSON.stringify(result.success ? result.data : { error: result.error })
            : JSON.stringify({ error: "Step not executed" }),
        };
      });

      this.messages.push({ role: "assistant", content: response.content });
      this.messages.push({ role: "user", content: toolResults });
    }

    return {
      text: t("agent.max_iterations"),
      plan: null,
    };
  }

  private wrapError(err: unknown, context: string): AppError {
    if (err instanceof AppError) return err;
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Agent", `Unexpected error in ${context}: ${message}`, { error: err });
    return new AppError(message, "error.unexpected", {}, err);
  }
}
