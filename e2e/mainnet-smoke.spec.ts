import { test, expect } from "@playwright/test";
import { walletView } from "./helpers/selectors";
import {
  waitForAppReady,
  waitForSync,
  importWallet,
  getMainnetMnemonic,
  getDisplayedAddress,
  goToWallet,
} from "./helpers/wallet";

const mainnetMnemonic = getMainnetMnemonic();

test.describe("Mainnet Smoke Test", () => {
  test.skip(!mainnetMnemonic, "E2E_MAINNET_MNEMONIC env var not set");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await importWallet(page, mainnetMnemonic!, "m/44'/0'/0'");
  });

  test("import mainnet wallet and verify sync", async ({ page }) => {
    await waitForSync(page);
    await goToWallet(page);
    await expect(
      page.getByText("Receive", { exact: true }).first()
    ).toBeVisible();
  });

  test("mainnet address is displayed", async ({ page }) => {
    const address = await getDisplayedAddress(page);
    expect(address).toMatch(/^q[a-z0-9]+$/);
  });

  test("mainnet balance displays", async ({ page }) => {
    await waitForSync(page);
    const balanceArea = walletView.balanceArea(page);
    await expect(balanceArea).toBeVisible();
    const content = await balanceArea.textContent();
    expect(content!.length).toBeGreaterThan(0);
  });

  // NOTE: Does NOT send transactions to preserve mainnet balance
});
