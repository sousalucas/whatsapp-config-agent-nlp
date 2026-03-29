import { test, expect } from "../fixtures/playwright-fixtures.js";

test.describe("Locale API", () => {
  test("GET /api/locale returns current locale", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/locale`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.locale).toBeTruthy();
    expect(data.supported).toBeTruthy();
  });

  test("POST /api/locale changes locale", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/locale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: "pt" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.locale).toBe("pt");
  });

  test("POST /api/locale returns 400 for missing locale", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/locale`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("locale is required");
  });

  test("GET /api/translations returns translation keys", async ({ testContext }) => {
    const response = await fetch(`${testContext.baseURL}/api/translations`);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data["web.subtitle"]).toBeTruthy();
    expect(data["web.welcome"]).toBeTruthy();
    expect(data["web.send"]).toBeTruthy();
  });
});
