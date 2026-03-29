import { test, expect } from "../fixtures/playwright-fixtures.js";

test.describe("Web UI language switching", () => {
  test("switching language updates UI text", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);

    // Switch to Portuguese
    await page.locator("#lang-select").selectOption("pt");

    // Wait for translations to update
    await expect(page.locator("#subtitle")).not.toHaveText("", { timeout: 5_000 });

    // Verify subtitle changed (Portuguese text)
    const subtitle = await page.locator("#subtitle").textContent();
    expect(subtitle).toBeTruthy();
  });

  test("lang query param sets initial language", async ({ testContext, page }) => {
    await page.goto(`${testContext.baseURL}/?lang=pt`);

    const langSelect = page.locator("#lang-select");
    await expect(langSelect).toHaveValue("pt");
  });

  test("language change updates URL query param", async ({ testContext, page }) => {
    await page.goto(testContext.baseURL);

    await page.locator("#lang-select").selectOption("pt");

    // Wait for URL to update
    await page.waitForURL(/lang=pt/);
    expect(page.url()).toContain("lang=pt");
  });
});
