import { config } from "./utils/config.js";
import { createLLMProvider } from "./llm/factory.js";
import { createWatiClient } from "./wati/factory.js";
import { Agent } from "./agent/agent.js";
import { startCLI } from "./interfaces/cli.js";
import { startWeb } from "./interfaces/web.js";
import { setLocale } from "./i18n/index.js";

function parseLangArg(): string | undefined {
  const idx = process.argv.indexOf("--lang");
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

const langArg = parseLangArg();
if (langArg) {
  setLocale(langArg);
} else if (config.agent.locale) {
  setLocale(config.agent.locale);
}

const llm = createLLMProvider();
const wati = createWatiClient();
const agent = new Agent(llm, wati);

const mode = process.argv.includes("--web") ? "web" : "cli";

if (mode === "web") {
  startWeb(agent, config.web.port);
} else {
  startCLI(agent);
}
