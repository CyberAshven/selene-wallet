/**
 * App Store / Play Store screenshot generation via Playwright.
 *
 * Run:   npx playwright test --project=screenshots
 * Output: android/metadata screenshot directories
 *
 * Uses 4x device pixel ratio to produce store-quality images.
 * Android: 1440x3200 (360x800 viewport @ 4x)
 *
 * Requires E2E_MAINNET_MNEMONIC in .env for a wallet with real
 * balance, transaction history, and CashTokens.
 */
import { test as base, expect, type Page } from "@playwright/test";
import {
  importWallet,
  waitForAppReady,
  waitForSync,
} from "./helpers/wallet";
import { nav, walletView } from "./helpers/selectors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ANDROID_DIR = path.join(
  __dirname,
  "../android/metadata/android/en-US/images/phoneScreenshots"
);

const mnemonic = process.env.E2E_MAINNET_MNEMONIC;

/** Wait for all toasts to disappear. */
async function clearToasts(page: Page) {
  try {
    await page
      .locator("[data-testid='notification-container']")
      .waitFor({ state: "hidden", timeout: 4000 });
  } catch {
    // Container might not exist
  }
}

/** Wait for all images in the viewport to finish loading. */
async function waitForImages(page: Page) {
  await page
    .waitForFunction(
      () => {
        const imgs = document.querySelectorAll("img");
        return Array.from(imgs).every(
          (img) => img.complete && img.naturalHeight > 0
        );
      },
      { timeout: 8000 }
    )
    .catch(() => {});
}

// Use serial mode — import wallet once, reuse for all screenshots
base.describe.configure({ mode: "serial" });

base.describe("Store Screenshots", () => {
  base.skip(!mnemonic, "E2E_MAINNET_MNEMONIC not set");

  let page: Page;

  base.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Mock CoinGecko API for consistent exchange rate
    await page.route("**/api.coingecko.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          "bitcoin-cash": {
            usd: 462.84, aud: 722.31, brl: 2637.14, cad: 647.22,
            chf: 406.12, clp: 442816, cny: 3357.69, czk: 10640,
            dkk: 3164.48, eur: 423.89, gbp: 356.78, hkd: 3598.06,
            huf: 171284, idr: 7617400, ils: 1654.05, inr: 39042.68,
            jpy: 67542, krw: 653814, mxn: 9452.84, myr: 2012.36,
            nok: 4877.52, nzd: 774.32, pen: 1712.48, php: 26482,
            pkr: 128965, pln: 1798.42, rub: 44186, sar: 1735.65,
            sek: 4627.84, sgd: 614.52, thb: 15685, try: 17846,
            twd: 14842, uah: 19124, vnd: 11842000, zar: 8414.52,
          },
        }),
      })
    );

    await page.goto("/");
    await waitForAppReady(page);
    await importWallet(page, mnemonic!, "m/44'/0'/0'");
    await waitForSync(page);

    // Rename wallets
    async function renameWallet(oldName: string, newName: string) {
      await nav.settings(page).click();
      await page.waitForURL("**/settings**");
      await page.getByRole("button", { name: "Wallets" }).click();
      await page.waitForTimeout(300);
      await page.getByText(oldName, { exact: true }).click();
      await page.waitForURL("**/settings/wallet**");
      await page.waitForTimeout(300);
      const editIcon = page.getByRole("img", { name: /edit|pencil/i }).first();
      if (await editIcon.isVisible({ timeout: 1500 }).catch(() => false)) {
        await editIcon.click();
      }
      const nameInput = page.locator("input[type='text']").first();
      if (await nameInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await nameInput.fill(newName);
        await nameInput.press("Enter");
      }
    }

    await renameWallet("Imported Wallet", "Selene Wallet");
    await renameWallet("My Selene Wallet", "New Wallet");

    // Preload BCMR token metadata
    await nav.assets(page).click();
    await page.waitForURL("**/assets**");
    await page.waitForTimeout(2000);
    await waitForImages(page);

    // Back to wallet, let toasts fade
    await nav.wallet(page).click();
    await page.waitForTimeout(3000);
  });

  base.afterAll(async () => {
    await page.close();
  });

  // 1. Wallet home
  base("1 - Wallet home (receive)", async () => {
    await nav.wallet(page).click();
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/1_en-US.png` });
  });

  // 2. Transaction history
  base("2 - Transaction history", async () => {
    await walletView.historyButton(page).click();
    await page.waitForURL("**/wallet/history**");
    await page.waitForTimeout(1000);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/2_en-US.png` });
  });

  // 3. Send screen
  base("3 - Send screen", async () => {
    await page.goto("/wallet/send");
    await page.waitForURL("**/wallet/send**");
    await page.waitForTimeout(500);
    await clearToasts(page);

    await page.getByTestId("editable-input").fill(
      "bitcoincash:qz6cwvxgp4qhzsk374mpjhqp385p8vp3m5whcmtrvw"
    );
    await page.getByTestId("satoshi-input").fill("7.42");
    await page.waitForTimeout(300);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/3_en-US.png` });
  });

  // 4. Assets (tokens)
  base("4 - Assets (tokens)", async () => {
    await nav.assets(page).click();
    await page.waitForURL("**/assets**");
    await page.waitForTimeout(1000);
    await waitForImages(page);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/4_en-US.png` });
  });

  // 5. NFT detail (Badger)
  base("5 - NFT detail (HoneyBadgers)", async () => {
    await nav.assets(page).click();
    await page.waitForURL("**/assets**");
    await page.waitForTimeout(1000);
    await waitForImages(page);

    await page.getByText("HoneyBadgers").first().click();
    await page.waitForTimeout(1500);
    await waitForImages(page);

    const nftCards = page.locator(".rounded-t.rounded-b-sm");
    const count = await nftCards.count();
    await nftCards.nth(count >= 2 ? 1 : 0).click();
    await page.waitForTimeout(1000);
    await waitForImages(page);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/5_en-US.png` });
  });

  // 6. Explore
  base("6 - Explore", async () => {
    // Close NFT modal first if open
    const closeBtn = page.getByRole("img", { name: /close/i }).first();
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
    }
    await nav.explore(page).click();
    await page.waitForURL("**/explore**");
    await page.waitForTimeout(1500);
    await waitForImages(page);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/6_en-US.png` });
  });

  // 7. Settings
  base("7 - Settings", async () => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");
    await page.getByRole("button", { name: "Wallets" }).click();
    await page.waitForTimeout(300);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/7_en-US.png` });
  });

  // 8. Wallet Info
  base("8 - Wallet Info", async () => {
    await page.getByText("Selene Wallet", { exact: true }).click();
    await page.waitForURL("**/settings/wallet**");
    await page.waitForTimeout(300);
    await clearToasts(page);
    await page.screenshot({ path: `${ANDROID_DIR}/8_en-US.png` });
  });
});
