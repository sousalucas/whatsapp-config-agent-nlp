import { describe, it, expect } from "vitest";
import { execaNode } from "execa";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const ENTRY = path.join(ROOT, "src/index.ts");

const baseEnv = {
  ...process.env,
  WATI_MODE: "mock",
  LLM_PROVIDER: "mock",
  AGENT_LOCALE: "en",
};

/**
 * Runs the CLI interactively. Watches stdout for prompt patterns
 * ("> " or "yes/no)") and sends the next input line when a prompt appears.
 * This avoids the issue where piping all input at once causes readline
 * to lose buffered lines when stdin closes during async processing.
 */
function runInteractiveCLI(
  inputs: string[],
  timeout = 15_000
): Promise<{ stdout: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const proc = execaNode(ENTRY, [], {
      env: baseEnv,
      timeout,
      nodeOptions: ["--import", "tsx"],
      reject: false,
    });

    let stdout = "";
    let promptCount = 0;
    let inputIndex = 0;

    proc.stdout!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;

      // Count prompts: "You > " or "(yes/no) "
      const newPrompts = (text.match(/> |\(yes\/no\)/g) || []).length;
      promptCount += newPrompts;

      // Send next input when a new prompt appears
      while (inputIndex < inputs.length && promptCount > inputIndex) {
        proc.stdin!.write(inputs[inputIndex] + "\n");
        inputIndex++;
      }
    });

    proc.on("close", (code) => {
      resolve({ stdout, exitCode: code });
    });

    // Safety: if process doesn't exit, kill it after timeout
    setTimeout(() => {
      proc.kill();
    }, timeout);
  });
}

describe("CLI e2e", () => {
  it("exits cleanly with exit command", async () => {
    const { exitCode, stdout } = await runInteractiveCLI(["exit"]);
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Bye!");
  });

  it("displays welcome message on start", async () => {
    const { stdout } = await runInteractiveCLI(["exit"]);
    expect(stdout).toContain("WhatsApp Business assistant");
  });

  it("handles a greeting message", async () => {
    const { stdout } = await runInteractiveCLI(["hello", "exit"]);
    expect(stdout).toContain("WhatsApp Business assistant");
    expect(stdout).toContain("Bye!");
  });

  it("handles a read-only query", async () => {
    const { stdout } = await runInteractiveCLI(
      ["list VIP contacts", "exit"],
      20_000
    );
    expect(stdout).toContain("VIP");
    expect(stdout).toContain("Bye!");
  });

  it("handles destructive action with confirmation", async () => {
    const { stdout } = await runInteractiveCLI(
      ["send template welcome to Carlos", "yes", "exit"],
      20_000
    );
    expect(stdout).toContain("planning to do");
    expect(stdout).toContain("Bye!");
  });

  it("handles destructive action with rejection", async () => {
    const { stdout } = await runInteractiveCLI(
      ["send template welcome to Carlos", "no", "exit"],
      20_000
    );
    expect(stdout).toContain("planning to do");
    expect(stdout).toContain("Bye!");
  });
});
