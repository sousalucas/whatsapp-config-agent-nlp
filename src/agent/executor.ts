import type { WatiClient } from "../wati/types.js";
import type { PlanStep } from "./planner.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { t } from "../i18n/index.js";

export interface StepResult {
  stepIndex: number;
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
  userMessage?: string;
}

export async function executeStep(
  step: PlanStep,
  wati: WatiClient
): Promise<StepResult> {
  const input = step.toolInput;

  try {
    let data: unknown;

    switch (step.toolName) {
      case "search_contacts":
        data = await wati.getContacts({
          tag: input.tag as string | undefined,
          name: input.name as string | undefined,
        });
        break;

      case "get_contact_info":
        data = await wati.getContactInfo(input.whatsapp_number as string);
        break;

      case "add_contact":
        data = await wati.addContact(
          input.whatsapp_number as string,
          input.name as string,
          input.custom_params as { name: string; value: string }[] | undefined
        );
        break;

      case "update_contact_attributes":
        data = await wati.updateContactAttributes(
          input.whatsapp_number as string,
          input.custom_params as { name: string; value: string }[]
        );
        break;

      case "add_tag":
        data = await wati.addTag(
          input.whatsapp_number as string,
          input.tag as string
        );
        break;

      case "remove_tag":
        data = await wati.removeTag(
          input.whatsapp_number as string,
          input.tag as string
        );
        break;

      case "get_templates":
        data = await wati.getMessageTemplates();
        break;

      case "send_template_message":
        data = await wati.sendTemplateMessage(
          input.whatsapp_number as string,
          input.template_name as string,
          input.broadcast_name as string,
          input.parameters as { name: string; value: string }[] | undefined
        );
        break;

      case "send_session_message":
        data = await wati.sendSessionMessage(
          input.whatsapp_number as string,
          input.message_text as string
        );
        break;

      case "send_broadcast":
        data = await wati.sendBroadcast(
          input.segment_name as string,
          input.template_name as string,
          input.broadcast_name as string
        );
        break;

      case "get_operators":
        data = await wati.getOperators();
        break;

      case "assign_operator":
        data = await wati.assignOperator(
          input.whatsapp_number as string,
          input.operator_email as string
        );
        break;

      case "assign_ticket":
        data = await wati.assignTicket(
          input.whatsapp_number as string,
          input.team_name as string
        );
        break;

      case "set_language":
        data = { language: input.language, applied: true };
        break;

      default:
        logger.warn("Executor", `Unknown tool requested: ${step.toolName}`);
        return {
          stepIndex: 0,
          toolName: step.toolName,
          success: false,
          data: null,
          error: `Unknown tool: ${step.toolName}`,
          userMessage: t("error.unexpected"),
        };
    }

    logger.debug("Executor", `Step completed: ${step.toolName}`, { toolInput: input });
    return { stepIndex: 0, toolName: step.toolName, success: true, data };
  } catch (err) {
    const technicalMessage = err instanceof Error ? err.message : String(err);
    logger.error("Executor", `Step failed: ${step.toolName}`, { error: err, toolInput: input });

    // Use the friendly message from AppError subclasses, or fall back to generic
    const userMessage = err instanceof AppError
      ? t(err.messageKey, err.messageParams)
      : t("error.unexpected");

    return {
      stepIndex: 0,
      toolName: step.toolName,
      success: false,
      data: null,
      error: technicalMessage,
      userMessage,
    };
  }
}

export async function executePlan(
  steps: PlanStep[],
  wati: WatiClient,
  onStepComplete?: (result: StepResult) => void
): Promise<StepResult[]> {
  const results: StepResult[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const result = await executeStep(step, wati);
    result.stepIndex = i;
    results.push(result);

    if (onStepComplete) onStepComplete(result);

    if (!result.success) {
      logger.warn("Executor", `Plan stopped at step ${i + 1}/${steps.length} due to failure`, {
        failedTool: step.toolName,
        error: result.error,
      });
      break;
    }
  }

  return results;
}
