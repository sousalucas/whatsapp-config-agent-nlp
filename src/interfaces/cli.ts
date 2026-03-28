import * as readline from "readline";
import { Agent } from "../agent/agent.js";
import { t } from "../i18n/index.js";
import type { Plan } from "../agent/planner.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function formatPlan(plan: Plan): string {
  const lines: string[] = [t("plan.header")];
  plan.steps.forEach((step, i) => {
    const key = step.destructive ? "plan.step_destructive" : "plan.step";
    lines.push(t(key, { n: String(i + 1), description: step.description }));
  });
  return lines.join("\n");
}

export async function startCLI(agent: Agent): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n" + t("welcome") + "\n");

  const askQuestion = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  const prompt = async (): Promise<void> => {
    const input = await askQuestion(`\n${t("prompt")} > `);
    const trimmed = input.trim();

    if (!trimmed) {
      return prompt();
    }

    if (trimmed === "exit" || trimmed === "sair" || trimmed === "quit") {
      console.log("\nBye! 👋\n");
      rl.close();
      return;
    }

    try {
      console.log(`\n${t("thinking")}`);
      const response = await agent.handleUserInput(trimmed);

      if (response.plan) {
        console.log("\n" + formatPlan(response.plan));

        if (response.plan.requiresConfirmation) {
          const answer = await askQuestion(t("plan.confirm") + " ");
          const yes = ["yes", "y", "sim", "s"].includes(answer.trim().toLowerCase());

          if (yes) {
            const result = await agent.executePendingPlan((stepResult) => {
              if (stepResult.success) {
                console.log(t("plan.step_done", { n: String(stepResult.stepIndex + 1) }));
              } else {
                console.log(
                  t("plan.step_failed", {
                    n: String(stepResult.stepIndex + 1),
                    error: stepResult.userMessage || t("error.unexpected"),
                  })
                );
              }
            });

            if (result.text) {
              console.log("\n" + result.text);
            }
          } else {
            agent.cancelPlan();
            console.log("\n" + t("plan.cancelled"));
          }
        }
      } else if (response.text) {
        console.log("\n" + response.text);
      }
    } catch (err) {
      if (err instanceof AppError) {
        console.error("\n" + t(err.messageKey, err.messageParams));
      } else {
        logger.error("CLI", "Unhandled error", { error: err });
        console.error("\n" + t("error.unexpected"));
      }
    }

    return prompt();
  };

  await prompt();
}
