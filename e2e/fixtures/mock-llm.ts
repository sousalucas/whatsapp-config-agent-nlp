import type { LLMProvider, LLMResponse, LLMMessage, ToolDefinition, ContentBlock } from "../../src/llm/types.js";

let idCounter = 0;

export function mockToolId(): string {
  return `mock_${++idCounter}`;
}

export class MockLLMProvider implements LLMProvider {
  private responses: LLMResponse[] = [];

  enqueue(response: LLMResponse): void {
    this.responses.push(response);
  }

  enqueueText(text: string): void {
    this.enqueue({
      content: [{ type: "text", text }],
      stopReason: "end_turn",
    });
  }

  enqueueToolUse(
    toolCalls: Array<{ name: string; input: Record<string, unknown> }>,
    text?: string
  ): void {
    const content: ContentBlock[] = [];
    if (text) content.push({ type: "text", text });
    for (const tc of toolCalls) {
      content.push({
        type: "tool_use",
        id: mockToolId(),
        name: tc.name,
        input: tc.input,
      });
    }
    this.enqueue({ content, stopReason: "tool_use" });
  }

  async chat(_params: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse> {
    const response = this.responses.shift();
    if (!response) {
      throw new Error("MockLLMProvider: no more enqueued responses");
    }
    return response;
  }

  get remaining(): number {
    return this.responses.length;
  }
}
