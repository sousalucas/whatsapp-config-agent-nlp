import dotenv from "dotenv";

dotenv.config();

export const config = {
  llm: {
    provider: process.env.LLM_PROVIDER || "anthropic",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || "",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
    googleApiKey: process.env.GOOGLE_API_KEY || "",
    googleModel: process.env.GOOGLE_MODEL || "gemini-2.0-flash",
  },
  wati: {
    mode: (process.env.WATI_MODE || "mock") as "mock" | "real",
    apiUrl: process.env.WATI_API_URL || "",
    apiToken: process.env.WATI_API_TOKEN || "",
  },
  agent: {
    locale: process.env.AGENT_LOCALE || "",
  },
  web: {
    port: parseInt(process.env.PORT || process.env.WEB_PORT || "3000", 10),
  },
};
