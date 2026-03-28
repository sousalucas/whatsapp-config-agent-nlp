import { config } from "../utils/config.js";
import type { LLMProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { GeminiProvider } from "./gemini.js";

export function createLLMProvider(): LLMProvider {
  const provider = config.llm.provider;

  switch (provider) {
    case "anthropic":
      if (!config.llm.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
      }
      return new AnthropicProvider({
        apiKey: config.llm.anthropicApiKey,
        model: config.llm.anthropicModel,
      });
    case "gemini":
      if (!config.llm.googleApiKey) {
        throw new Error("GOOGLE_API_KEY is required when LLM_PROVIDER=gemini");
      }
      return new GeminiProvider({
        apiKey: config.llm.googleApiKey,
        model: config.llm.googleModel,
      });
    default:
      throw new Error(
        `Unknown LLM_PROVIDER: "${provider}". Supported: anthropic, gemini`
      );
  }
}
