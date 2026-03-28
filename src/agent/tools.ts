import type { ToolDefinition } from "../llm/types.js";

export interface ToolMeta {
  destructive: boolean;
}

export const TOOL_META: Record<string, ToolMeta> = {
  search_contacts: { destructive: false },
  get_contact_info: { destructive: false },
  add_contact: { destructive: true },
  update_contact_attributes: { destructive: true },
  add_tag: { destructive: true },
  remove_tag: { destructive: true },
  get_templates: { destructive: false },
  send_template_message: { destructive: true },
  send_session_message: { destructive: true },
  send_broadcast: { destructive: true },
  get_operators: { destructive: false },
  assign_operator: { destructive: true },
  assign_ticket: { destructive: true },
  set_language: { destructive: false },
};

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "search_contacts",
    description:
      "Search for contacts. Can filter by tag or name. Returns a list of matching contacts with their phone numbers, tags, and attributes.",
    input_schema: {
      type: "object",
      properties: {
        tag: {
          type: "string",
          description: "Filter contacts by tag (e.g. 'VIP', 'new-customer')",
        },
        name: {
          type: "string",
          description: "Filter contacts by name (partial match)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_contact_info",
    description:
      "Get detailed information about a single contact by their WhatsApp number.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number (digits only, with country code, e.g. '5511999001001')",
        },
      },
      required: ["whatsapp_number"],
    },
  },
  {
    name: "add_contact",
    description:
      "Add a new contact to the system. If the contact already exists, updates their name and attributes.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number (digits only, with country code)",
        },
        name: {
          type: "string",
          description: "The contact's full name",
        },
        custom_params: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
            },
            required: ["name", "value"],
          },
          description: "Custom attributes for the contact (e.g. city, plan)",
        },
      },
      required: ["whatsapp_number", "name"],
    },
  },
  {
    name: "update_contact_attributes",
    description: "Update custom attributes of an existing contact.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number",
        },
        custom_params: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "string" },
            },
            required: ["name", "value"],
          },
          description: "Attributes to update",
        },
      },
      required: ["whatsapp_number", "custom_params"],
    },
  },
  {
    name: "add_tag",
    description: "Add a tag to a contact.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number",
        },
        tag: {
          type: "string",
          description: "The tag to add (e.g. 'VIP', 'new-customer')",
        },
      },
      required: ["whatsapp_number", "tag"],
    },
  },
  {
    name: "remove_tag",
    description: "Remove a tag from a contact.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number",
        },
        tag: {
          type: "string",
          description: "The tag to remove",
        },
      },
      required: ["whatsapp_number", "tag"],
    },
  },
  {
    name: "get_templates",
    description:
      "List available WhatsApp message templates. Returns template names, statuses, and body text with parameter placeholders.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "send_template_message",
    description:
      "Send a pre-approved WhatsApp template message to a contact. The template must be APPROVED. Parameters fill in the {{1}}, {{2}} placeholders in the template body.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The recipient's WhatsApp number",
        },
        template_name: {
          type: "string",
          description: "The name of the template to send (e.g. 'welcome_message')",
        },
        broadcast_name: {
          type: "string",
          description: "A name for this broadcast/send (for tracking purposes)",
        },
        parameters: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Parameter name (e.g. '1', '2' or 'body_1')" },
              value: { type: "string", description: "Parameter value" },
            },
            required: ["name", "value"],
          },
          description: "Template parameter values to fill in placeholders",
        },
      },
      required: ["whatsapp_number", "template_name", "broadcast_name"],
    },
  },
  {
    name: "send_session_message",
    description:
      "Send a free-form text message to a contact. Only works within 24h of their last message (WhatsApp session window).",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The recipient's WhatsApp number",
        },
        message_text: {
          type: "string",
          description: "The message text to send",
        },
      },
      required: ["whatsapp_number", "message_text"],
    },
  },
  {
    name: "send_broadcast",
    description:
      "Send a template message as a broadcast to a predefined contact segment.",
    input_schema: {
      type: "object",
      properties: {
        segment_name: {
          type: "string",
          description: "The name of the contact segment to broadcast to",
        },
        template_name: {
          type: "string",
          description: "The template to send",
        },
        broadcast_name: {
          type: "string",
          description: "A name for this broadcast",
        },
      },
      required: ["segment_name", "template_name", "broadcast_name"],
    },
  },
  {
    name: "get_operators",
    description: "List available operators/agents and their teams.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "assign_operator",
    description: "Assign a specific operator to handle a contact's conversation.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number",
        },
        operator_email: {
          type: "string",
          description: "The operator's email address",
        },
      },
      required: ["whatsapp_number", "operator_email"],
    },
  },
  {
    name: "assign_ticket",
    description: "Assign a contact's conversation to a team.",
    input_schema: {
      type: "object",
      properties: {
        whatsapp_number: {
          type: "string",
          description: "The contact's WhatsApp number",
        },
        team_name: {
          type: "string",
          description: "The team name to assign to (e.g. 'Support', 'Sales')",
        },
      },
      required: ["whatsapp_number", "team_name"],
    },
  },
  {
    name: "set_language",
    description:
      "Set the UI language based on the user's language. Call this when you detect the user is writing in a specific language.",
    input_schema: {
      type: "object",
      properties: {
        language: {
          type: "string",
          enum: ["en", "pt"],
          description: "The language code",
        },
      },
      required: ["language"],
    },
  },
];
