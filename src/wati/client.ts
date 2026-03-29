import axios, { type AxiosInstance, type AxiosError } from "axios";
import type {
  WatiClient,
  Contact,
  MessageTemplate,
  Operator,
  SendResult,
  PaginatedResult,
} from "./types.js";
import { WatiApiError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function classifyAxiosError(err: unknown, operation: string): WatiApiError {
  if (err instanceof WatiApiError) return err;
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError;
    const status = axErr.response?.status;
    const technicalMessage = `WATI ${operation} failed: HTTP ${status || "N/A"} — ${axErr.message}`;

    if (status === 401 || status === 403) {
      return new WatiApiError(technicalMessage, "error.wati_auth", {}, status, err);
    }
    if (status === 404) {
      return new WatiApiError(technicalMessage, "error.wati_not_found", { resource: operation }, status, err);
    }
    if (status === 429) {
      return new WatiApiError(technicalMessage, "error.wati_rate_limit", {}, status, err);
    }
    if (axErr.code === "ECONNABORTED" || axErr.code === "ETIMEDOUT") {
      return new WatiApiError(technicalMessage, "error.wati_timeout", {}, undefined, err);
    }
    return new WatiApiError(technicalMessage, "error.wati", {}, status, err);
  }

  const message = err instanceof Error ? err.message : String(err);
  return new WatiApiError(`WATI ${operation} failed: ${message}`, "error.wati", {}, undefined, err);
}

export class RealWatiClient implements WatiClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, apiToken: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 30000,
    });
  }

  async getContacts(params?: {
    tag?: string;
    name?: string;
    pageSize?: number;
    pageNumber?: number;
  }): Promise<PaginatedResult<Contact>> {
    try {
      const queryParams: Record<string, string | number> = {
        pageSize: params?.pageSize || 20,
        pageNumber: params?.pageNumber || 1,
      };
      if (params?.tag) queryParams.tag = params.tag;
      if (params?.name) queryParams.name = params.name;

      const res = await this.http.get("/api/v1/getContacts", { params: queryParams });
      const data = res.data;
      // WATI returns contact_list as an object { items, count, pageSize, pageNumber }
      // Fall back to direct array in case of API version differences
      const contactList = data.contact_list;
      const rawContacts: unknown[] = Array.isArray(contactList)
        ? contactList
        : Array.isArray(contactList?.items)
          ? contactList.items
          : Array.isArray(data.contacts)
            ? data.contacts
            : [];
      const contacts: Contact[] = rawContacts.map(
        (c) => this.normalizeContact(c as Record<string, unknown>)
      );
      const total = contactList?.count ?? contactList?.total ?? contacts.length;
      return {
        items: contacts,
        total,
        pageNumber: queryParams.pageNumber as number,
        pageSize: queryParams.pageSize as number,
      };
    } catch (err) {
      const watiErr = classifyAxiosError(err, "getContacts");
      logger.error("WatiClient", watiErr.message, { error: err });
      throw watiErr;
    }
  }

  async getContactInfo(whatsappNumber: string): Promise<Contact | null> {
    try {
      const res = await this.http.get(`/api/v1/getContactInfo/${whatsappNumber}`);
      return this.normalizeContact(res.data);
    } catch (err) {
      // 404 is expected — contact doesn't exist
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      const watiErr = classifyAxiosError(err, "getContactInfo");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber });
      throw watiErr;
    }
  }

  async addContact(
    whatsappNumber: string,
    name: string,
    customParams?: { name: string; value: string }[]
  ): Promise<Contact> {
    try {
      const res = await this.http.post(`/api/v1/addContact/${whatsappNumber}`, {
        name,
        customParams: customParams || [],
      });
      // WATI signals failure with HTTP 200 + result:false — surface the real reason
      if (res.data.result === false) {
        const reason = res.data.info || "addContact failed";
        throw new WatiApiError(reason, "error.wati", {}, undefined);
      }
      // WATI may return just {result: true} without full contact data; fall back to a minimal contact
      const raw = res.data || {};
      const contact = raw.contact || raw;
      return this.normalizeContact({
        wAid: whatsappNumber,
        phone: whatsappNumber,
        name,
        ...contact,
      });
    } catch (err) {
      const watiErr = classifyAxiosError(err, "addContact");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber, name });
      throw watiErr;
    }
  }

  async updateContactAttributes(
    whatsappNumber: string,
    customParams: { name: string; value: string }[]
  ): Promise<boolean> {
    try {
      const res = await this.http.post(
        `/api/v1/updateContactAttributes/${whatsappNumber}`,
        { customParams }
      );
      return res.data.result === true;
    } catch (err) {
      const watiErr = classifyAxiosError(err, "updateContactAttributes");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber });
      throw watiErr;
    }
  }

  async addTag(whatsappNumber: string, tag: string): Promise<boolean> {
    try {
      const res = await this.http.post(`/api/v1/addTag/${whatsappNumber}`, { tag });
      return res.data.result === true;
    } catch (err) {
      const watiErr = classifyAxiosError(err, "addTag");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber, tag });
      throw watiErr;
    }
  }

  async removeTag(whatsappNumber: string, tag: string): Promise<boolean> {
    try {
      await this.http.delete(`/api/v1/removeTag/${whatsappNumber}/${tag}`);
      return true;
    } catch (err) {
      const watiErr = classifyAxiosError(err, "removeTag");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber, tag });
      throw watiErr;
    }
  }

  async getMessageTemplates(params?: {
    pageSize?: number;
    pageNumber?: number;
  }): Promise<PaginatedResult<MessageTemplate>> {
    try {
      const res = await this.http.get("/api/v1/getMessageTemplates", {
        params: {
          pageSize: params?.pageSize || 100,
          pageNumber: params?.pageNumber || 1,
        },
      });
      const templates: MessageTemplate[] = (
        res.data.messageTemplates || res.data.items || []
      ).map((t: Record<string, unknown>) => ({
        id: t.id || "",
        elementName: t.elementName || t.name || "",
        category: t.category || "",
        status: t.status || "PENDING",
        language: t.language || "en",
        body: t.body || "",
        footer: t.footer || undefined,
      }));
      return {
        items: templates,
        total: templates.length,
        pageNumber: params?.pageNumber || 1,
        pageSize: params?.pageSize || 100,
      };
    } catch (err) {
      const watiErr = classifyAxiosError(err, "getMessageTemplates");
      logger.error("WatiClient", watiErr.message, { error: err });
      throw watiErr;
    }
  }

  async sendSessionMessage(
    whatsappNumber: string,
    messageText: string
  ): Promise<SendResult> {
    try {
      await this.http.post(`/api/v1/sendSessionMessage/${whatsappNumber}`, {
        messageText,
      });
      return { success: true, phoneNumber: whatsappNumber };
    } catch (err) {
      const watiErr = classifyAxiosError(err, "sendSessionMessage");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber });
      throw watiErr;
    }
  }

  async sendTemplateMessage(
    whatsappNumber: string,
    templateName: string,
    broadcastName: string,
    params?: { name: string; value: string }[]
  ): Promise<SendResult> {
    try {
      await this.http.post(`/api/v1/sendTemplateMessage/${whatsappNumber}`, {
        template_name: templateName,
        broadcast_name: broadcastName,
        parameters: params || [],
      });
      return { success: true, phoneNumber: whatsappNumber };
    } catch (err) {
      const watiErr = classifyAxiosError(err, "sendTemplateMessage");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber, templateName });
      throw watiErr;
    }
  }

  async sendBroadcast(
    segmentName: string,
    templateName: string,
    broadcastName: string
  ): Promise<boolean> {
    try {
      const res = await this.http.post("/api/v1/sendBroadcastToSegment", {
        template_name: templateName,
        broadcast_name: broadcastName,
        segmentName,
      });
      return res.data.result === true;
    } catch (err) {
      const watiErr = classifyAxiosError(err, "sendBroadcast");
      logger.error("WatiClient", watiErr.message, { error: err, segmentName, templateName });
      throw watiErr;
    }
  }

  async getOperators(): Promise<Operator[]> {
    try {
      const res = await this.http.get("/api/v1/getOperators");
      return (res.data.operators || res.data || []).map(
        (op: Record<string, unknown>) => ({
          id: op.id || "",
          name: op.name || "",
          email: op.email || "",
          team: op.team || "",
          isOnline: op.isOnline === true,
        })
      );
    } catch (err) {
      const watiErr = classifyAxiosError(err, "getOperators");
      logger.error("WatiClient", watiErr.message, { error: err });
      throw watiErr;
    }
  }

  async assignOperator(
    whatsappNumber: string,
    operatorEmail: string
  ): Promise<boolean> {
    try {
      const res = await this.http.post(
        `/api/v1/assignOperator/${whatsappNumber}`,
        { email: operatorEmail }
      );
      return res.data.result === true;
    } catch (err) {
      const watiErr = classifyAxiosError(err, "assignOperator");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber, operatorEmail });
      throw watiErr;
    }
  }

  async assignTicket(
    whatsappNumber: string,
    teamName: string
  ): Promise<boolean> {
    try {
      const res = await this.http.post("/api/v1/tickets/assign", {
        whatsappNumber,
        teamName,
      });
      return res.data.result === true;
    } catch (err) {
      const watiErr = classifyAxiosError(err, "assignTicket");
      logger.error("WatiClient", watiErr.message, { error: err, whatsappNumber, teamName });
      throw watiErr;
    }
  }

  private normalizeContact(raw: Record<string, unknown>): Contact {
    return {
      id: String(raw.id || ""),
      wAid: String(raw.wAid || raw.whatsappNumber || ""),
      firstName: String(raw.firstName || ""),
      fullName: String(raw.fullName || raw.name || ""),
      phone: String(raw.phone || raw.wAid || raw.whatsappNumber || ""),
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      customParams: Array.isArray(raw.customParams) ? raw.customParams : [],
      contactStatus: (raw.contactStatus as "VALID" | "INVALID") || "VALID",
      created: String(raw.created || ""),
    };
  }
}
