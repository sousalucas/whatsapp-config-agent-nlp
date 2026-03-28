export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface LLMMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface LLMResponse {
  content: ContentBlock[];
  stopReason: "end_turn" | "tool_use";
}

export interface LLMProvider {
  chat(params: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse>;
}
