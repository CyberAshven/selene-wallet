/**
 * Page object selectors for Selene Wallet E2E tests.
 *
 * Locator factories return Playwright Locator objects using
 * getByRole / getByTestId to satisfy playwright/no-raw-locators.
 */
import type { Page } from "@playwright/test";

// --------
// Bottom navigation tabs

export const nav = {
  wallet: (page: Page) =>
    page.getByTestId("nav-bottom").getByRole("link", { name: /Wallet/ }),
  assets: (page: Page) =>
    page.getByTestId("nav-bottom").getByRole("link", { name: /Assets/ }),
  explore: (page: Page) =>
    page.getByTestId("nav-bottom").getByRole("link", { name: /Explore/ }),
  settings: (page: Page) =>
    page.getByTestId("nav-bottom").getByRole("link", { name: /Settings/ }),
};

// --------
// Wallet view (receive/home screen)

export const walletView = {
  balanceHideButton: (page: Page) =>
    page.getByRole("img", { name: /^eye(-invisible)?$/ }),
  balanceArea: (page: Page) => page.getByTestId("balance-area"),
  walletNameLink: (page: Page) => page.getByTestId("wallet-name-link"),
  qrButton: (page: Page) => page.getByTestId("qr-button"),
  addressDisplay: (page: Page) => page.getByTestId("address-display"),
  requestAmountTrigger: (page: Page) => page.getByTestId("request-amount"),
  requestAmountInput: (page: Page) => page.getByTestId("satoshi-input"),
  historyButton: (page: Page) =>
    page.getByRole("img", { name: "history" }),
  scannerButton: (page: Page) =>
    page.getByRole("img", { name: "scan" }),
  sendButton: (page: Page) =>
    page.getByRole("img", { name: "send" }),
};

// --------
// Send page

export const sendPage = {
  header: (page: Page) => page.getByTestId("send-header"),
  error: (page: Page) => page.getByTestId("send-error"),
  amountInput: (page: Page) => page.getByTestId("satoshi-input"),
  addressInput: (page: Page) => page.getByTestId("editable-input"),
  slideToSend: (page: Page) => page.getByTestId("slide-to-action"),
  backButton: (page: Page) =>
    page.getByRole("img", { name: "arrow-left" }),
};

// --------
// History page

export const historyPage = {
  container: (page: Page) => page.getByTestId("history-view"),
};

// --------
// Settings page

export const settingsPage = {
  container: (page: Page) => page.getByTestId("settings-view"),
};

// --------
// Assets page

export const assetsPage = {
  tokensTab: (page: Page) => page.getByRole("link", { name: "Tokens" }),
  coinsTab: (page: Page) => page.getByRole("link", { name: "Coins" }),
};

// --------
// Scanner overlay

export const scanner = {
  closeButton: (page: Page) =>
    page.getByRole("img", { name: "close" }),
};

// --------
// Sweep page

export const sweepPage = {
  error: (page: Page) => page.getByTestId("sweep-error"),
};
