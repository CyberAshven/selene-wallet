import { test, expect } from "./helpers/fixtures";
import { nav, assetsPage } from "./helpers/selectors";

test.describe("Assets: Coins Tab", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.assets(page).click();
    await page.waitForURL("**/assets/**");

    await assetsPage.coinsTab(page).first().click();
    await page.waitForURL("**/assets/coins**");
  });

  test("coins tab renders with balance header or empty state", async ({
    appPage: page,
  }) => {
    const cashBalance = page.getByText("Cash Balance", { exact: false });
    const noCoins = page.getByText("No Coins", { exact: false });

    await expect(cashBalance.or(noCoins).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("Assets: Tokens Tab", () => {
  test("tokens tab shows empty state for fresh wallet", async ({
    appPage: page,
  }) => {
    await nav.assets(page).click();
    await page.waitForURL("**/assets/**");

    await assetsPage.tokensTab(page).first().click();
    await page.waitForURL("**/assets/tokens**");

    const noTokens = page.getByText("No Tokens", { exact: false });
    await expect(noTokens).toBeVisible({ timeout: 5_000 });
  });
});
