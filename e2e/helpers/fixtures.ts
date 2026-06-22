/**
 * Playwright test fixtures for Selene Wallet E2E tests.
 * Extends the base test with app-specific setup and helpers.
 */
import { test as base, expect, type Page } from "@playwright/test";
import { waitForAppReady } from "./wallet";

/**
 * Extended test fixture that waits for the app to boot before each test.
 */
export const test = base.extend<{ appPage: Page }>({
  appPage: async ({ page }, use) => {
    // Navigate to the app
    await page.goto("/");

    // Wait for the app to fully initialize
    await waitForAppReady(page);

    // Use the page in the test
    await use(page);
  },
});

export { expect };
