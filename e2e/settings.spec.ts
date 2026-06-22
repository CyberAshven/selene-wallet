import { test, expect } from "./helpers/fixtures";
import { nav, settingsPage } from "./helpers/selectors";

test.describe("Settings", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");
  });

  test("settings page renders", async ({ appPage: page }) => {
    await expect(settingsPage.container(page)).toBeVisible();
  });

  test("has expected sections", async ({ appPage: page }) => {
    await expect(
      page.getByRole("button", { name: "Wallets" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Security" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Currency" })
    ).toBeVisible();
  });

  test("accordions expand and collapse", async ({ appPage: page }) => {
    const walletsBtn = page.getByRole("button", { name: "Wallets" });
    await expect(walletsBtn).toBeVisible();
    await walletsBtn.click();

    const content = page.getByText("Create/Import Wallet", { exact: false });
    await expect(content).toBeVisible({ timeout: 3_000 });

    await walletsBtn.click();
    await expect(content).toBeHidden();
  });

  test("network settings shows server selector", async ({
    appPage: page,
  }) => {
    const networkBtn = page.getByRole("button", { name: "Network" });
    await expect(networkBtn).toBeVisible();
    await networkBtn.click();

    await expect(page.getByRole("combobox").first()).toBeVisible({
      timeout: 3_000,
    });
  });

  test("currency settings shows denomination", async ({
    appPage: page,
  }) => {
    const currencyBtn = page.getByRole("button", { name: "Currency" });
    await expect(currencyBtn).toBeVisible();
    await currencyBtn.click();

    await expect(
      page.getByText("Denomination", { exact: false })
    ).toBeVisible({ timeout: 3_000 });
  });

  test("privacy settings has hide balance toggle", async ({
    appPage: page,
  }) => {
    const privacyBtn = page.getByRole("button", { name: "Privacy" });
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();

    await expect(
      page.getByText("Hide balances", { exact: false })
    ).toBeVisible({ timeout: 3_000 });
  });
});
