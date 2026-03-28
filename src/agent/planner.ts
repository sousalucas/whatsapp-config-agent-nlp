import type { ContentBlock } from "../llm/types.js";
import { TOOL_META } from "./tools.js";
import { t } from "../i18n/index.js";

export interface PlanStep {
  toolCallId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  description: string;
  destructive: boolean;
}

export interface Plan {
  steps: PlanStep[];
  summary: string;
  requiresConfirmation: boolean;
}

function describeStep(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "search_contacts": {
      const filters: string[] = [];
      if (input.tag) filters.push(`tag="${input.tag}"`);
      if (input.name) filters.push(`name="${input.name}"`);
      return t("tool.search_contacts", { filters: filters.length ? filters.join(", ") : "all" });
    }
    case "get_contact_info":
      return t("tool.get_contact_info", { number: String(input.whatsapp_number) });
    case "add_contact":
      return t("tool.add_contact", {
        name: String(input.name),
        number: String(input.whatsapp_number),
      });
    case "update_contact_attributes":
      return t("tool.update_contact_attributes", { number: String(input.whatsapp_number) });
    case "add_tag":
      return t("tool.add_tag", { tag: String(input.tag), number: String(input.whatsapp_number) });
    case "remove_tag":
      return t("tool.remove_tag", { tag: String(input.tag), number: String(input.whatsapp_number) });
    case "get_templates":
      return t("tool.get_templates");
    case "send_template_message":
      return t("tool.send_template_message", {
        template: String(input.template_name),
        number: String(input.whatsapp_number),
      });
    case "send_session_message":
      return t("tool.send_session_message", { number: String(input.whatsapp_number) });
    case "send_broadcast":
      return t("tool.send_broadcast", {
        template: String(input.template_name),
        segment: String(input.segment_name),
      });
    case "get_operators":
      return t("tool.get_operators");
    case "assign_operator":
      return t("tool.assign_operator", {
        email: String(input.operator_email),
        number: String(input.whatsapp_number),
      });
    case "assign_ticket":
      return t("tool.assign_ticket", {
        team: String(input.team_name),
        number: String(input.whatsapp_number),
      });
    case "set_language":
      return t("tool.set_language", { lang: String(input.language) });
    default:
      return `${toolName}(${JSON.stringify(input)})`;
  }
}

export function buildPlan(contentBlocks: ContentBlock[]): Plan {
  const toolUseBlocks = contentBlocks.filter(
    (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use"
  );

  const steps: PlanStep[] = toolUseBlocks.map((block) => {
    const meta = TOOL_META[block.name] || { destructive: false };
    return {
      toolCallId: block.id,
      toolName: block.name,
      toolInput: block.input,
      description: describeStep(block.name, block.input),
      destructive: meta.destructive,
    };
  });

  const hasDestructive = steps.some((s) => s.destructive);

  const textBlocks = contentBlocks.filter(
    (b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text"
  );
  const summary = textBlocks.map((b) => b.text).join("\n") || "";

  return {
    steps,
    summary,
    requiresConfirmation: hasDestructive,
  };
}
