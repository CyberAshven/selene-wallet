import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";

test.describe("Wallet Wizard", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const walletsBtn = page.getByRole("button", { name: "Wallets" });
    await expect(walletsBtn).toBeVisible();
    await walletsBtn.click();

    const newWalletBtn = page.getByText("Create/Import Wallet", {
      exact: false,
    });
    await expect(newWalletBtn).toBeVisible({ timeout: 3_000 });
    await newWalletBtn.click();
    await page.waitForURL("**/settings/wallet/wizard**");
  });

  test("wizard page renders", async ({ appPage: page }) => {
    await expect(
      page.getByRole("button", { name: /Create New Wallet/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Import Wallet/i })
    ).toBeVisible();
  });

  test("import option navigates to import form", async ({
    appPage: page,
  }) => {
    const importBtn = page.getByRole("button", { name: /Import Wallet/i });
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await page.waitForURL("**/settings/wallet/wizard/import**");

    const textarea = page.getByTestId("mnemonic-input");
    await expect(textarea).toBeVisible();
  });

  test("import validates word count", async ({ appPage: page }) => {
    const importBtn = page.getByRole("button", { name: /Import Wallet/i });
    await importBtn.click();
    await page.waitForURL("**/settings/wallet/wizard/import**");

    const textarea = page.getByTestId("mnemonic-input");
    await textarea.fill("apple banana cherry dog elephant");

    const submitBtn = page.getByRole("button", { name: /Import Wallet/i });
    await submitBtn.click();

    await expect(
      page.getByText("exactly 12", { exact: false })
    ).toBeVisible({ timeout: 3_000 });
  });

  test("import validates BIP39 mnemonic", async ({ appPage: page }) => {
    const importBtn = page.getByRole("button", { name: /Import Wallet/i });
    await importBtn.click();
    await page.waitForURL("**/settings/wallet/wizard/import**");

    const textarea = page.getByTestId("mnemonic-input");
    await textarea.fill(
      "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima"
    );

    const submitBtn = page.getByRole("button", { name: /Import Wallet/i });
    await submitBtn.click();

    await expect(
      page.getByText("invalid", { exact: false })
    ).toBeVisible({ timeout: 3_000 });
  });
});
