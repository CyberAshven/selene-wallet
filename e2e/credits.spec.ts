import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";

test.describe("Credits", () => {
  test("credits page shows version", async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings");

    const versionBtn = page.getByText("Selene Wallet v", { exact: false });
    await expect(versionBtn).toBeVisible();
    await versionBtn.click();

    await page.waitForURL("**/credits");
    await expect(
      page.getByText("Selene Wallet v", { exact: false })
    ).toBeVisible();
  });
});
