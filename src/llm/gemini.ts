import { GoogleGenerativeAI, type Content, type Part, type FunctionDeclaration } from "@google/generative-ai";
import type { LLMProvider, LLMResponse, LLMMessage, ToolDefinition, ContentBlock } from "./types.js";
import { LLMError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s base — free tier is 15 RPM (~4s between requests)

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  return lower.includes("429") || lower.includes("rate limit") || lower.includes("quota") || lower.includes("resource has been exhausted");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyGeminiError(err: unknown): { messageKey: string; technicalMessage: string } {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("authentication") || lower.includes("permission")) {
    return { messageKey: "error.llm_auth", technicalMessage: `Authentication failed: ${message}` };
  }
  if (lower.includes("rate limit") || lower.includes("quota") || lower.includes("429")) {
    return { messageKey: "error.llm_rate_limit", technicalMessage: `Rate limited: ${message}` };
  }
  if (lower.includes("timeout") || lower.includes("network") || lower.includes("econnrefused")) {
    return { messageKey: "error.llm_timeout", technicalMessage: `Connection error: ${message}` };
  }
  if (lower.includes("overloaded") || lower.includes("503") || lower.includes("500")) {
    return { messageKey: "error.llm_overloaded", technicalMessage: `Server error: ${message}` };
  }
  return { messageKey: "error.llm", technicalMessage: message };
}

function toGeminiContents(messages: LLMMessage[]): Content[] {
  const contents: Content[] = [];

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";

    if (typeof msg.content === "string") {
      contents.push({ role, parts: [{ text: msg.content }] });
      continue;
    }

    const parts: Part[] = [];
    for (const block of msg.content) {
      if (block.type === "text") {
        parts.push({ text: block.text });
      } else if (block.type === "tool_use") {
        parts.push({
          functionCall: { name: block.name, args: block.input },
        });
      } else if (block.type === "tool_result") {
        parts.push({
          functionResponse: {
            name: findToolName(messages, block.tool_use_id),
            response: { result: block.content },
          },
        });
      }
    }

    if (parts.length > 0) {
      contents.push({ role, parts });
    }
  }

  return contents;
}

function findToolName(messages: LLMMessage[], toolUseId: string): string {
  for (const msg of messages) {
    if (typeof msg.content === "string") continue;
    for (const block of msg.content) {
      if (block.type === "tool_use" && block.id === toolUseId) {
        return block.name;
      }
    }
  }
  return "unknown";
}

function toGeminiTools(tools: ToolDefinition[]): FunctionDeclaration[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.input_schema as unknown as FunctionDeclaration["parameters"],
  }));
}

export class GeminiProvider implements LLMProvider {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(opts: { apiKey: string; model: string }) {
    this.client = new GoogleGenerativeAI(opts.apiKey);
    this.model = opts.model;
  }

  async chat(params: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: params.systemPrompt,
      tools: [{ functionDeclarations: toGeminiTools(params.tools) }],
      generationConfig: { maxOutputTokens: 4096 },
    });

    const contents = toGeminiContents(params.messages);

    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent({ contents });
        const response = result.response;
        const parts = response.candidates?.[0]?.content?.parts ?? [];

        const content: ContentBlock[] = [];
        let hasToolUse = false;

        for (const part of parts) {
          if (part.functionCall) {
            hasToolUse = true;
            content.push({
              type: "tool_use",
              id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              name: part.functionCall.name,
              input: (part.functionCall.args ?? {}) as Record<string, unknown>,
            });
          } else if (part.text) {
            content.push({ type: "text", text: part.text });
          }
        }

        return {
          content,
          stopReason: hasToolUse ? "tool_use" : "end_turn",
        };
      } catch (err) {
        lastError = err;

        if (isRateLimitError(err) && attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          logger.warn("GeminiProvider", `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          continue;
        }

        break;
      }
    }

    const { messageKey, technicalMessage } = classifyGeminiError(lastError);
    logger.error("GeminiProvider", technicalMessage, { error: lastError });
    throw new LLMError(technicalMessage, messageKey, {}, lastError);
  }
}
