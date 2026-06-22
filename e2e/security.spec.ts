import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";

test.describe("Security", () => {
  test("app boots without lock screen on web", async ({ appPage: page }) => {
    const pinInput = page.getByRole("textbox", { name: /pin/i });
    await expect(pinInput).toBeHidden();
  });

  test("security accordion is accessible", async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const securityBtn = page.getByRole("button", { name: "Security" });
    await expect(securityBtn).toBeVisible();
    await securityBtn.click();

    await expect(
      page.getByText("Security Mode", { exact: false })
    ).toBeVisible({ timeout: 3_000 });
  });

  test("web stub shows encryption unavailable message", async ({
    appPage: page,
  }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const securityBtn = page.getByRole("button", { name: "Security" });
    await securityBtn.click();

    await expect(
      page.getByText("Encryption is not available on web", { exact: false })
    ).toBeVisible({ timeout: 3_000 });
  });

  test.fixme("forgot pin has import/reset options", async () => {
    // Web stub cannot show lock screen (encryption always ready)
  });

  test.fixme("nuclear wipe requires confirmation", async () => {
    // Web stub cannot show lock screen (encryption always ready)
  });

  test.fixme("import backup has fields", async () => {
    // Web stub cannot show lock screen (encryption always ready)
  });
});
