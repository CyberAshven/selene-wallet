/**
 * Wallet helpers for E2E tests.
 * Handles wallet import, network switching, and sync waiting.
 */
import { type Page, type Locator, expect } from "@playwright/test";
import { nav } from "./selectors";

/** Read mainnet mnemonic; returns undefined if not set (tests should skip). */
export function getMainnetMnemonic(): string | undefined {
  return process.env.E2E_MAINNET_MNEMONIC;
}

/**
 * Wait for the app to fully boot (past lock screen, into wallet view).
 * On web stub, encryption is a no-op, so the app boots directly.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await nav.wallet(page).waitFor({ timeout: 30_000 });
}

/**
 * Wait for the wallet to finish syncing with Electrum.
 * Looks for the sync indicator to stop spinning.
 */
export async function waitForSync(page: Page): Promise<void> {
  const indicator = page.getByTestId("sync-indicator");
  const isPresent = await indicator
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  if (isPresent) {
    await expect(indicator).toHaveAttribute("data-syncing", "false", {
      timeout: 30_000,
    });
  }
}

/**
 * Expand a settings accordion by clicking its button header.
 * Accordion titles are rendered inside <button> elements.
 */
async function expandAccordion(page: Page, title: string): Promise<void> {
  const accordion = page.getByRole("button", { name: title });
  await accordion.click();
}

/**
 * Switch to chipnet network via the Debug page.
 * Network switching is in DebugSettings (not the regular Network accordion).
 * After selecting chipnet, the app reloads via window.location.assign("/").
 */
export async function switchToChipnet(page: Page): Promise<void> {
  await page.goto("/debug");

  const debugAccordion = page.getByRole("button", { name: "Debug Options" });
  await expect(debugAccordion).toBeVisible({ timeout: 10_000 });
  await debugAccordion.click();

  const networkSelect = page.getByRole("combobox").first();
  await expect(networkSelect).toBeVisible({ timeout: 5_000 });
  await networkSelect.selectOption("chipnet");

  await waitForAppReady(page);
}

/**
 * Import a wallet from mnemonic via the wallet wizard.
 * @param derivationPath - Optional derivation path (e.g. "m/44'/0'/0'").
 *   Defaults to "auto" which scans all supported paths.
 */
export async function importWallet(
  page: Page,
  mnemonic: string,
  derivationPath?: string
): Promise<void> {
  await nav.settings(page).click();
  await page.waitForURL("**/settings");

  await expandAccordion(page, "Wallets");

  const newWalletBtn = page.getByText("Create/Import Wallet", {
    exact: false,
  });
  await newWalletBtn.click();
  await page.waitForURL("**/settings/wallet/wizard**");

  const importBtn = page.getByRole("button", { name: /Import Wallet/i });
  await importBtn.click();
  await page.waitForURL("**/settings/wallet/wizard/import**");

  const mnemonicInput = page.getByTestId("mnemonic-input");
  await mnemonicInput.fill(mnemonic);

  // Select derivation path if specified
  if (derivationPath) {
    await expandAccordion(page, "Additional Options");
    const derivSelect = page.getByRole("combobox").first();
    await derivSelect.selectOption(derivationPath);
  }

  const confirmBtn = page.getByRole("button", { name: /Import Wallet/i });
  await confirmBtn.click();

  await expect(page).not.toHaveURL(/\/wizard/, { timeout: 30_000 });
  await waitForSync(page);

  await nav.wallet(page).click();
}

/**
 * Navigate to the wallet view (home/receive screen).
 */
export async function goToWallet(page: Page): Promise<void> {
  await nav.wallet(page).click();
  await page.waitForURL("**/wallet**");
}

/**
 * Get the currently displayed address text from the wallet view.
 * Waits for the address to be non-empty before returning.
 */
export async function getDisplayedAddress(page: Page): Promise<string> {
  const addressEl = page.getByTestId("address-display");
  await expect(addressEl).not.toHaveText("", { timeout: 5_000 });
  return (await addressEl.textContent()) || "";
}

/**
 * Find a form control inside an AccordionChild by its label text.
 *
 * AccordionChild DOM: div.p-2.5 > div.flex > [label div, control div]
 * getByText matches the label div, two parent levels reaches the flex wrapper
 * which contains both the label and the control as descendants.
 */
export function accordionControl(
  page: Page,
  labelText: string,
  controlSelector: string
) {
  // AccordionChild uses raw CSS selectors for control targeting because
  // the control type varies (select, input[type=checkbox], input[type=color], etc.)
  // and there's no accessible role/label pattern to match generically.
  // eslint-disable-next-line playwright/no-raw-locators
  return page.getByText(labelText, { exact: false }).locator("../..").locator(controlSelector);
}

/**
 * Toggle a checkbox and verify the state changed using web-first assertions.
 * Restores the original state after verification.
 */
export async function expectToggle(checkbox: Locator): Promise<void> {
  const wasChecked = await checkbox.isChecked();

  // Toggle: state should flip
  await checkbox.click();
  const flipped = wasChecked
    ? expect(checkbox).not.toBeChecked()
    : expect(checkbox).toBeChecked();
  await flipped;

  // Restore: state should return to original
  await checkbox.click();
  const restored = wasChecked
    ? expect(checkbox).toBeChecked()
    : expect(checkbox).not.toBeChecked();
  await restored;
}
