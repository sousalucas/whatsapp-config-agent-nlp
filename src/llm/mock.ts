import type { LLMProvider, LLMResponse, LLMMessage, ToolDefinition, ContentBlock } from "./types.js";

let callCount = 0;

function makeId(): string {
  return `mock_${++callCount}`;
}

function getLastUserText(messages: LLMMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "user" && typeof msg.content === "string") {
      return msg.content.toLowerCase();
    }
  }
  return "";
}

function hasToolResults(messages: LLMMessage[]): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "user" || typeof last.content === "string") return false;
  return (last.content as ContentBlock[]).some((b) => b.type === "tool_result");
}

export class MockLLMProvider implements LLMProvider {
  async chat(params: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse> {
    // If the last message contains tool_results, return a summary
    if (hasToolResults(params.messages)) {
      return this.summaryResponse(params.messages);
    }

    const text = getLastUserText(params.messages);

    // Pattern-match user input to return appropriate tool calls
    if (text.includes("contact") && text.includes("vip")) {
      return this.searchContactsResponse("VIP");
    }
    if (text.includes("contact") || text.includes("contato")) {
      return this.searchContactsResponse();
    }
    if (text.includes("template") && text.includes("send")) {
      return this.sendTemplateResponse();
    }
    if (text.includes("template") || text.includes("modelo")) {
      return this.getTemplatesResponse();
    }
    if (text.includes("operator") || text.includes("operador")) {
      return this.getOperatorsResponse();
    }

    // Default: greeting
    return {
      content: [
        { type: "text" as const, text: "Hello! I'm your WhatsApp Business assistant. I can help you manage contacts, templates, operators, and messages. What would you like to do?" },
      ],
      stopReason: "end_turn",
    };
  }

  private searchContactsResponse(tag?: string): LLMResponse {
    const toolCalls: ContentBlock[] = [
      { type: "tool_use", id: makeId(), name: "set_language", input: { language: "en" } },
      { type: "tool_use", id: makeId(), name: "search_contacts", input: tag ? { tag } : {} },
    ];
    return { content: toolCalls, stopReason: "tool_use" };
  }

  private getTemplatesResponse(): LLMResponse {
    return {
      content: [
        { type: "tool_use", id: makeId(), name: "set_language", input: { language: "en" } },
        { type: "tool_use", id: makeId(), name: "get_templates", input: {} },
      ],
      stopReason: "tool_use",
    };
  }

  private getOperatorsResponse(): LLMResponse {
    return {
      content: [
        { type: "tool_use", id: makeId(), name: "set_language", input: { language: "en" } },
        { type: "tool_use", id: makeId(), name: "get_operators", input: {} },
      ],
      stopReason: "tool_use",
    };
  }

  private sendTemplateResponse(): LLMResponse {
    return {
      content: [
        { type: "text", text: "I'll send the welcome message template to Carlos." },
        { type: "tool_use", id: makeId(), name: "set_language", input: { language: "en" } },
        { type: "tool_use", id: makeId(), name: "send_template_message", input: {
          whatsapp_number: "5511999001001",
          template_name: "welcome_message",
          broadcast_name: "test_broadcast",
          parameters: [{ name: "1", value: "Carlos" }],
        }},
      ],
      stopReason: "tool_use",
    };
  }

  private summaryResponse(messages: LLMMessage[]): LLMResponse {
    // Extract tool results to build a contextual summary
    const last = messages[messages.length - 1];
    if (last.role === "user" && Array.isArray(last.content)) {
      const results = (last.content as ContentBlock[]).filter((b) => b.type === "tool_result");
      for (const r of results) {
        if (r.type === "tool_result") {
          try {
            const data = JSON.parse(r.content);
            if (data.items && Array.isArray(data.items)) {
              const names = data.items.map((c: { fullName?: string; elementName?: string; name?: string }) =>
                c.fullName || c.elementName || c.name || "Unknown"
              ).join(", ");
              return {
                content: [{ type: "text", text: `Here are the results: ${names}` }],
                stopReason: "end_turn",
              };
            }
            if (data.success) {
              return {
                content: [{ type: "text", text: "Done! The operation completed successfully." }],
                stopReason: "end_turn",
              };
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    }

    return {
      content: [{ type: "text", text: "The operation completed." }],
      stopReason: "end_turn",
    };
  }
}
