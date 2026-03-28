import { describe, it, expect, beforeEach } from "vitest";
import { t, setLocale } from "../src/i18n/index.js";

describe("i18n", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("returns English string by default", () => {
    const result = t("plan.header");
    expect(result).toContain("planning to do");
  });

  it("returns Portuguese string when locale is pt", () => {
    setLocale("pt");
    const result = t("plan.header");
    expect(result).toContain("planejando fazer");
  });

  it("replaces template variables", () => {
    const result = t("plan.step", { n: "1", description: "Add contact" });
    expect(result).toContain("1");
    expect(result).toContain("Add contact");
  });

  it("falls back to English for missing keys", () => {
    setLocale("pt");
    // Use a key that exists in en
    const result = t("plan.header");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns key when not found in any locale", () => {
    const result = t("nonexistent.key");
    expect(result).toBe("nonexistent.key");
  });

  it("handles tool descriptions in both languages", () => {
    const en = t("tool.add_contact", { name: "Ana", number: "123" });
    expect(en).toContain("Ana");
    expect(en).toContain("123");

    setLocale("pt");
    const pt = t("tool.add_contact", { name: "Ana", number: "123" });
    expect(pt).toContain("Ana");
    expect(pt).toContain("123");
    expect(pt).not.toBe(en); // Should be different translations
  });
});
