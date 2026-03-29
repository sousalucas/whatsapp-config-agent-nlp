import { MockLLMProvider } from "./mock-llm.js";

/** Scenario: simple greeting, no tools needed */
export function scenarioGreeting(llm: MockLLMProvider): void {
  llm.enqueueText(
    "Hello! I'm your WhatsApp Business assistant. How can I help you today?"
  );
}

/** Scenario: user asks to list contacts (read-only, no confirmation) */
export function scenarioListContacts(llm: MockLLMProvider): void {
  llm.enqueueToolUse([
    { name: "set_language", input: { language: "en" } },
    { name: "search_contacts", input: {} },
  ]);
  llm.enqueueText(
    "Here are your contacts: Carlos Mendes, Ana Costa, Roberto Silva, John Smith, and Dewi Putri."
  );
}

/** Scenario: user asks to list VIP contacts (read-only, no confirmation) */
export function scenarioListVIPContacts(llm: MockLLMProvider): void {
  llm.enqueueToolUse([
    { name: "set_language", input: { language: "en" } },
    { name: "search_contacts", input: { tag: "VIP" } },
  ]);
  llm.enqueueText(
    "I found 3 VIP contacts: Carlos Mendes, Roberto Silva, and John Smith."
  );
}

/** Scenario: user asks to send a template message (destructive, requires confirmation) */
export function scenarioSendTemplate(llm: MockLLMProvider): void {
  llm.enqueueToolUse(
    [
      { name: "set_language", input: { language: "en" } },
      {
        name: "send_template_message",
        input: {
          whatsapp_number: "5511999001001",
          template_name: "welcome_message",
          broadcast_name: "test_broadcast",
          parameters: [{ name: "1", value: "Carlos" }],
        },
      },
    ],
    "I'll send the welcome message template to Carlos."
  );
  // After confirmation and execution, LLM summarizes
  llm.enqueueText(
    "Done! The welcome message was sent to Carlos Mendes (5511999001001)."
  );
}

/** Scenario: user asks something out of scope (e.g., general knowledge) */
export function scenarioOutOfScope(llm: MockLLMProvider): void {
  llm.enqueueText(
    "I'm sorry, I can only help with WhatsApp Business management tasks such as contacts, messages, templates, and operators. Please ask me something related to your WATI account."
  );
}

/** Scenario: user asks to list templates (read-only) */
export function scenarioListTemplates(llm: MockLLMProvider): void {
  llm.enqueueToolUse([
    { name: "set_language", input: { language: "en" } },
    { name: "get_templates", input: {} },
  ]);
  llm.enqueueText(
    "Here are the available templates: welcome_message, renewal_reminder, payment_overdue, flash_sale, and boas_vindas."
  );
}
