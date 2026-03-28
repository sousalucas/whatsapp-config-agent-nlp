export interface Contact {
  id: string;
  wAid: string;
  firstName: string;
  fullName: string;
  phone: string;
  tags: string[];
  customParams: { name: string; value: string }[];
  contactStatus: "VALID" | "INVALID";
  created: string;
}

export interface MessageTemplate {
  id: string;
  elementName: string;
  category: string;
  status: "APPROVED" | "REJECTED" | "PENDING";
  language: string;
  body: string;
  footer?: string;
}

export interface Operator {
  id: string;
  name: string;
  email: string;
  team: string;
  isOnline: boolean;
}

export interface SendResult {
  success: boolean;
  phoneNumber: string;
  error?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  pageNumber: number;
  pageSize: number;
}

export interface WatiClient {
  // Contacts
  getContacts(params?: {
    tag?: string;
    name?: string;
    pageSize?: number;
    pageNumber?: number;
  }): Promise<PaginatedResult<Contact>>;
  getContactInfo(whatsappNumber: string): Promise<Contact | null>;
  addContact(
    whatsappNumber: string,
    name: string,
    customParams?: { name: string; value: string }[]
  ): Promise<Contact>;
  updateContactAttributes(
    whatsappNumber: string,
    customParams: { name: string; value: string }[]
  ): Promise<boolean>;

  // Tags
  addTag(whatsappNumber: string, tag: string): Promise<boolean>;
  removeTag(whatsappNumber: string, tag: string): Promise<boolean>;

  // Templates
  getMessageTemplates(params?: {
    pageSize?: number;
    pageNumber?: number;
  }): Promise<PaginatedResult<MessageTemplate>>;

  // Messages
  sendSessionMessage(
    whatsappNumber: string,
    messageText: string
  ): Promise<SendResult>;
  sendTemplateMessage(
    whatsappNumber: string,
    templateName: string,
    broadcastName: string,
    params?: { name: string; value: string }[]
  ): Promise<SendResult>;

  // Broadcasts
  sendBroadcast(
    segmentName: string,
    templateName: string,
    broadcastName: string
  ): Promise<boolean>;

  // Operators
  getOperators(): Promise<Operator[]>;
  assignOperator(
    whatsappNumber: string,
    operatorEmail: string
  ): Promise<boolean>;
  assignTicket(
    whatsappNumber: string,
    teamName: string
  ): Promise<boolean>;
}
