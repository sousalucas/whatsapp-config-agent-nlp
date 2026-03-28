import type {
  WatiClient,
  Contact,
  MessageTemplate,
  Operator,
  SendResult,
  PaginatedResult,
} from "./types.js";

const SEED_CONTACTS: Contact[] = [
  {
    id: "c1",
    wAid: "5511999001001",
    firstName: "Carlos",
    fullName: "Carlos Mendes",
    phone: "5511999001001",
    tags: ["VIP", "renewal-due"],
    customParams: [
      { name: "city", value: "São Paulo" },
      { name: "plan", value: "premium" },
    ],
    contactStatus: "VALID",
    created: "2025-01-15T10:00:00Z",
  },
  {
    id: "c2",
    wAid: "5521988002002",
    firstName: "Ana",
    fullName: "Ana Costa",
    phone: "5521988002002",
    tags: ["new-customer"],
    customParams: [{ name: "city", value: "Rio de Janeiro" }],
    contactStatus: "VALID",
    created: "2025-03-01T14:30:00Z",
  },
  {
    id: "c3",
    wAid: "5511977003003",
    firstName: "Roberto",
    fullName: "Roberto Silva",
    phone: "5511977003003",
    tags: ["VIP", "payment-overdue"],
    customParams: [
      { name: "city", value: "São Paulo" },
      { name: "plan", value: "enterprise" },
    ],
    contactStatus: "VALID",
    created: "2024-11-20T09:00:00Z",
  },
  {
    id: "c4",
    wAid: "14155550100",
    firstName: "John",
    fullName: "John Smith",
    phone: "14155550100",
    tags: ["VIP"],
    customParams: [{ name: "city", value: "San Francisco" }],
    contactStatus: "VALID",
    created: "2025-02-10T16:00:00Z",
  },
  {
    id: "c5",
    wAid: "6281234567890",
    firstName: "Dewi",
    fullName: "Dewi Putri",
    phone: "6281234567890",
    tags: ["payment-overdue"],
    customParams: [{ name: "city", value: "Jakarta" }],
    contactStatus: "VALID",
    created: "2025-01-25T08:00:00Z",
  },
];

const SEED_TEMPLATES: MessageTemplate[] = [
  {
    id: "t1",
    elementName: "welcome_message",
    category: "MARKETING",
    status: "APPROVED",
    language: "en",
    body: "Welcome {{1}}! We're glad to have you on board. Let us know if you need anything.",
  },
  {
    id: "t2",
    elementName: "renewal_reminder",
    category: "UTILITY",
    status: "APPROVED",
    language: "en",
    body: "Hi {{1}}, your plan renews on {{2}}. Please ensure your payment method is up to date.",
  },
  {
    id: "t3",
    elementName: "payment_overdue",
    category: "UTILITY",
    status: "APPROVED",
    language: "en",
    body: "Hi {{1}}, your payment of {{2}} is overdue. Please settle it to avoid service interruption.",
  },
  {
    id: "t4",
    elementName: "flash_sale",
    category: "MARKETING",
    status: "APPROVED",
    language: "en",
    body: "Hey {{1}}! Flash sale: {{2}}% off all plans for the next 24 hours. Don't miss out!",
  },
  {
    id: "t5",
    elementName: "boas_vindas",
    category: "MARKETING",
    status: "APPROVED",
    language: "pt",
    body: "Bem-vindo(a) {{1}}! Estamos felizes em ter você conosco. Qualquer dúvida, é só chamar.",
  },
];

const SEED_OPERATORS: Operator[] = [
  {
    id: "op1",
    name: "Maria Santos",
    email: "maria@company.com",
    team: "Support",
    isOnline: true,
  },
  {
    id: "op2",
    name: "Carlos Lima",
    email: "carlos@company.com",
    team: "Sales",
    isOnline: true,
  },
  {
    id: "op3",
    name: "Fernanda Oliveira",
    email: "fernanda@company.com",
    team: "Support",
    isOnline: false,
  },
];

export class MockWatiClient implements WatiClient {
  private contacts: Contact[] = SEED_CONTACTS.map((c) => ({ ...c, tags: [...c.tags], customParams: [...c.customParams] }));
  private templates: MessageTemplate[] = [...SEED_TEMPLATES];
  private operators: Operator[] = [...SEED_OPERATORS];
  private log(action: string, detail: string) {
    console.log(`  [MOCK] ${action}: ${detail}`);
  }

  async getContacts(params?: {
    tag?: string;
    name?: string;
    pageSize?: number;
    pageNumber?: number;
  }): Promise<PaginatedResult<Contact>> {
    let filtered = this.contacts;
    if (params?.tag) {
      filtered = filtered.filter((c) => c.tags.includes(params.tag!));
    }
    if (params?.name) {
      const q = params.name.toLowerCase();
      filtered = filtered.filter((c) => c.fullName.toLowerCase().includes(q));
    }
    const pageSize = params?.pageSize || 20;
    const pageNumber = params?.pageNumber || 1;
    const start = (pageNumber - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);
    this.log("getContacts", `found ${filtered.length} contacts (filter: ${JSON.stringify(params || {})})`);
    return { items, total: filtered.length, pageNumber, pageSize };
  }

  async getContactInfo(whatsappNumber: string): Promise<Contact | null> {
    const contact = this.contacts.find((c) => c.phone === whatsappNumber);
    this.log("getContactInfo", contact ? `found ${contact.fullName}` : `not found: ${whatsappNumber}`);
    return contact || null;
  }

  async addContact(
    whatsappNumber: string,
    name: string,
    customParams?: { name: string; value: string }[]
  ): Promise<Contact> {
    const existing = this.contacts.find((c) => c.phone === whatsappNumber);
    if (existing) {
      this.log("addContact", `contact ${whatsappNumber} already exists, updating name`);
      existing.fullName = name;
      existing.firstName = name.split(" ")[0];
      if (customParams) existing.customParams = customParams;
      return existing;
    }
    const contact: Contact = {
      id: `c${this.contacts.length + 1}`,
      wAid: whatsappNumber,
      firstName: name.split(" ")[0],
      fullName: name,
      phone: whatsappNumber,
      tags: [],
      customParams: customParams || [],
      contactStatus: "VALID",
      created: new Date().toISOString(),
    };
    this.contacts.push(contact);
    this.log("addContact", `created ${name} (${whatsappNumber})`);
    return contact;
  }

  async updateContactAttributes(
    whatsappNumber: string,
    customParams: { name: string; value: string }[]
  ): Promise<boolean> {
    const contact = this.contacts.find((c) => c.phone === whatsappNumber);
    if (!contact) {
      this.log("updateContactAttributes", `contact not found: ${whatsappNumber}`);
      return false;
    }
    for (const param of customParams) {
      const existing = contact.customParams.find((p) => p.name === param.name);
      if (existing) {
        existing.value = param.value;
      } else {
        contact.customParams.push(param);
      }
    }
    this.log("updateContactAttributes", `updated ${contact.fullName}: ${JSON.stringify(customParams)}`);
    return true;
  }

  async addTag(whatsappNumber: string, tag: string): Promise<boolean> {
    const contact = this.contacts.find((c) => c.phone === whatsappNumber);
    if (!contact) {
      this.log("addTag", `contact not found: ${whatsappNumber}`);
      return false;
    }
    if (!contact.tags.includes(tag)) {
      contact.tags.push(tag);
    }
    this.log("addTag", `added tag "${tag}" to ${contact.fullName}`);
    return true;
  }

  async removeTag(whatsappNumber: string, tag: string): Promise<boolean> {
    const contact = this.contacts.find((c) => c.phone === whatsappNumber);
    if (!contact) {
      this.log("removeTag", `contact not found: ${whatsappNumber}`);
      return false;
    }
    contact.tags = contact.tags.filter((t) => t !== tag);
    this.log("removeTag", `removed tag "${tag}" from ${contact.fullName}`);
    return true;
  }

  async getMessageTemplates(params?: {
    pageSize?: number;
    pageNumber?: number;
  }): Promise<PaginatedResult<MessageTemplate>> {
    const pageSize = params?.pageSize || 20;
    const pageNumber = params?.pageNumber || 1;
    const start = (pageNumber - 1) * pageSize;
    const items = this.templates.slice(start, start + pageSize);
    this.log("getMessageTemplates", `returning ${items.length} templates`);
    return { items, total: this.templates.length, pageNumber, pageSize };
  }

  async sendSessionMessage(
    whatsappNumber: string,
    messageText: string
  ): Promise<SendResult> {
    this.log("sendSessionMessage", `to ${whatsappNumber}: "${messageText.substring(0, 50)}..."`);
    return { success: true, phoneNumber: whatsappNumber };
  }

  async sendTemplateMessage(
    whatsappNumber: string,
    templateName: string,
    broadcastName: string,
    params?: { name: string; value: string }[]
  ): Promise<SendResult> {
    const template = this.templates.find((t) => t.elementName === templateName);
    if (!template) {
      this.log("sendTemplateMessage", `template "${templateName}" not found`);
      return { success: false, phoneNumber: whatsappNumber, error: `Template "${templateName}" not found` };
    }
    if (template.status !== "APPROVED") {
      this.log("sendTemplateMessage", `template "${templateName}" not approved`);
      return { success: false, phoneNumber: whatsappNumber, error: `Template "${templateName}" is ${template.status}` };
    }
    this.log(
      "sendTemplateMessage",
      `sent "${templateName}" to ${whatsappNumber} with params ${JSON.stringify(params || [])}`
    );
    return { success: true, phoneNumber: whatsappNumber };
  }

  async sendBroadcast(
    segmentName: string,
    templateName: string,
    broadcastName: string
  ): Promise<boolean> {
    this.log("sendBroadcast", `template "${templateName}" to segment "${segmentName}" (broadcast: ${broadcastName})`);
    return true;
  }

  async getOperators(): Promise<Operator[]> {
    this.log("getOperators", `returning ${this.operators.length} operators`);
    return this.operators;
  }

  async assignOperator(
    whatsappNumber: string,
    operatorEmail: string
  ): Promise<boolean> {
    const operator = this.operators.find((o) => o.email === operatorEmail);
    if (!operator) {
      this.log("assignOperator", `operator not found: ${operatorEmail}`);
      return false;
    }
    this.log("assignOperator", `assigned ${operator.name} to conversation with ${whatsappNumber}`);
    return true;
  }

  async assignTicket(
    whatsappNumber: string,
    teamName: string
  ): Promise<boolean> {
    this.log("assignTicket", `assigned ${whatsappNumber} to team "${teamName}"`);
    return true;
  }
}
