import { test, expect } from "./helpers/fixtures";
import { nav, assetsPage } from "./helpers/selectors";

test.describe("Assets", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.assets(page).click();
    await page.waitForURL("**/assets/**");
  });

  test("assets page renders", async ({ appPage: page }) => {
    await expect(assetsPage.tokensTab(page).first()).toBeVisible();
    await expect(assetsPage.coinsTab(page).first()).toBeVisible();
  });

  test("tokens tab navigates", async ({ appPage: page }) => {
    await assetsPage.tokensTab(page).first().click();
    await expect(page).toHaveURL(/\/assets\/tokens/);
  });

  test("coins tab navigates", async ({ appPage: page }) => {
    await assetsPage.coinsTab(page).first().click();
    await expect(page).toHaveURL(/\/assets\/coins/);
  });
});
