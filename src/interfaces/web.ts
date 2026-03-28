import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { Agent } from "../agent/agent.js";
import { t, setLocale, getLocale, getSupportedLocales } from "../i18n/index.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function handleApiError(err: unknown, res: express.Response): void {
  if (err instanceof AppError) {
    const statusCode = err.name === "WatiApiError" && "statusCode" in err
      ? (err as { statusCode?: number }).statusCode
      : undefined;
    const httpStatus = statusCode === 401 || statusCode === 403 ? 502 : 500;
    res.status(httpStatus).json({ error: t(err.messageKey, err.messageParams) });
  } else {
    logger.error("WebAPI", "Unhandled error", { error: err });
    res.status(500).json({ error: t("error.unexpected") });
  }
}

export function startWeb(agent: Agent, port: number = 3000): void {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "web-public")));

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "message is required" });
        return;
      }
      const response = await agent.handleUserInput(message);
      res.json(response);
    } catch (err) {
      handleApiError(err, res);
    }
  });

  app.post("/api/confirm", async (req, res) => {
    try {
      const { confirmed } = req.body;
      if (confirmed) {
        const result = await agent.executePendingPlan();
        res.json(result);
      } else {
        agent.cancelPlan();
        res.json({ text: t("plan.cancelled"), plan: null });
      }
    } catch (err) {
      handleApiError(err, res);
    }
  });

  app.get("/api/locale", (_req, res) => {
    res.json({ locale: getLocale(), supported: getSupportedLocales() });
  });

  app.post("/api/locale", (req, res) => {
    const { locale } = req.body;
    if (!locale || typeof locale !== "string") {
      res.status(400).json({ error: "locale is required" });
      return;
    }
    setLocale(locale);
    res.json({ locale: getLocale() });
  });

  const WEB_KEYS = [
    "web.subtitle", "web.welcome", "web.examples_title",
    "web.example1", "web.example2", "web.example3",
    "web.placeholder", "web.send",
    "web.confirm_prompt", "web.confirm_yes", "web.confirm_no",
    "web.confirmed", "web.cancelled",
    "thinking", "plan.cancelled",
    "web.mic_title", "web.listening", "web.mic_denied",
    "web.mic_network_error", "web.mic_unsupported",
    "web.tts_on", "web.tts_off", "web.voice_input",
  ];

  app.get("/api/translations", (_req, res) => {
    const translations: Record<string, string> = {};
    for (const key of WEB_KEYS) {
      translations[key] = t(key);
    }
    res.json(translations);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.listen(port, () => {
    console.log(`\n🌐 Web UI running at http://localhost:${port}\n`);
  });
}
