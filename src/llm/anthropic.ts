import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider, LLMResponse, LLMMessage, ToolDefinition, ContentBlock } from "./types.js";
import { LLMError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function classifyAnthropicError(err: unknown): { messageKey: string; technicalMessage: string } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { messageKey: "error.llm_auth", technicalMessage: `Authentication failed: ${err.message}` };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { messageKey: "error.llm_rate_limit", technicalMessage: `Rate limited: ${err.message}` };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { messageKey: "error.llm_timeout", technicalMessage: `Connection error: ${err.message}` };
  }
  if (err instanceof Anthropic.InternalServerError) {
    return { messageKey: "error.llm_overloaded", technicalMessage: `Server error: ${err.message}` };
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) {
      return { messageKey: "error.llm_overloaded", technicalMessage: `Overloaded: ${err.message}` };
    }
    return { messageKey: "error.llm", technicalMessage: `API error (${err.status}): ${err.message}` };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { messageKey: "error.llm", technicalMessage: message };
}

export class AnthropicProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
  }

  async chat(params: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: params.systemPrompt,
        messages: params.messages.map((m) => ({
          role: m.role,
          content: m.content as Anthropic.MessageCreateParams["messages"][number]["content"],
        })),
        tools: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema as Anthropic.Tool["input_schema"],
        })),
      });

      const content: ContentBlock[] = response.content.map((block) => {
        if (block.type === "text") {
          return { type: "text" as const, text: block.text };
        }
        if (block.type === "tool_use") {
          return {
            type: "tool_use" as const,
            id: block.id,
            name: block.name,
            input: block.input as Record<string, unknown>,
          };
        }
        return { type: "text" as const, text: "" };
      });

      return {
        content,
        stopReason: response.stop_reason === "tool_use" ? "tool_use" : "end_turn",
      };
    } catch (err) {
      const { messageKey, technicalMessage } = classifyAnthropicError(err);
      logger.error("AnthropicProvider", technicalMessage, { error: err });
      throw new LLMError(technicalMessage, messageKey, {}, err);
    }
  }
}
