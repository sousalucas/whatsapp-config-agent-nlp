import { describe, it, expect, beforeEach } from "vitest";
import { MockWatiClient } from "../src/wati/mock.js";

describe("MockWatiClient", () => {
  let client: MockWatiClient;

  beforeEach(() => {
    client = new MockWatiClient();
  });

  describe("getContacts", () => {
    it("returns all seed contacts with no filter", async () => {
      const result = await client.getContacts();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBe(result.items.length);
    });

    it("filters contacts by tag", async () => {
      const result = await client.getContacts({ tag: "VIP" });
      expect(result.items.length).toBeGreaterThan(0);
      for (const contact of result.items) {
        expect(contact.tags).toContain("VIP");
      }
    });

    it("filters contacts by name", async () => {
      const result = await client.getContacts({ name: "Carlos" });
      expect(result.items.length).toBe(1);
      expect(result.items[0].fullName).toContain("Carlos");
    });

    it("returns empty when no match", async () => {
      const result = await client.getContacts({ tag: "nonexistent" });
      expect(result.items.length).toBe(0);
    });
  });

  describe("addContact", () => {
    it("creates a new contact", async () => {
      const contact = await client.addContact("5511987654321", "Ana Beatriz", [
        { name: "city", value: "São Paulo" },
      ]);
      expect(contact.phone).toBe("5511987654321");
      expect(contact.fullName).toBe("Ana Beatriz");
      expect(contact.firstName).toBe("Ana");
      expect(contact.customParams).toContainEqual({ name: "city", value: "São Paulo" });
    });

    it("updates existing contact", async () => {
      const contact = await client.addContact("5511999001001", "Carlos Updated");
      expect(contact.fullName).toBe("Carlos Updated");
    });

    it("new contact is findable", async () => {
      await client.addContact("5599999999999", "Test User");
      const info = await client.getContactInfo("5599999999999");
      expect(info).not.toBeNull();
      expect(info!.fullName).toBe("Test User");
    });
  });

  describe("addTag / removeTag", () => {
    it("adds a tag to a contact", async () => {
      await client.addContact("5500000000000", "Tag Test");
      const result = await client.addTag("5500000000000", "test-tag");
      expect(result).toBe(true);

      const info = await client.getContactInfo("5500000000000");
      expect(info!.tags).toContain("test-tag");
    });

    it("removes a tag from a contact", async () => {
      const result = await client.removeTag("5511999001001", "VIP");
      expect(result).toBe(true);

      const info = await client.getContactInfo("5511999001001");
      expect(info!.tags).not.toContain("VIP");
    });

    it("returns false for non-existent contact", async () => {
      const result = await client.addTag("0000000000000", "tag");
      expect(result).toBe(false);
    });
  });

  describe("getMessageTemplates", () => {
    it("returns seed templates", async () => {
      const result = await client.getMessageTemplates();
      expect(result.items.length).toBeGreaterThan(0);
      const names = result.items.map((t) => t.elementName);
      expect(names).toContain("welcome_message");
      expect(names).toContain("renewal_reminder");
    });
  });

  describe("sendTemplateMessage", () => {
    it("succeeds with valid template", async () => {
      const result = await client.sendTemplateMessage(
        "5511999001001",
        "welcome_message",
        "test-broadcast",
        [{ name: "1", value: "Carlos" }]
      );
      expect(result.success).toBe(true);
    });

    it("fails with non-existent template", async () => {
      const result = await client.sendTemplateMessage(
        "5511999001001",
        "nonexistent",
        "test",
        []
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("operators", () => {
    it("returns seed operators", async () => {
      const operators = await client.getOperators();
      expect(operators.length).toBeGreaterThan(0);
    });

    it("assigns operator by email", async () => {
      const result = await client.assignOperator("5511999001001", "maria@company.com");
      expect(result).toBe(true);
    });

    it("fails with unknown operator email", async () => {
      const result = await client.assignOperator("5511999001001", "nobody@company.com");
      expect(result).toBe(false);
    });
  });
});
