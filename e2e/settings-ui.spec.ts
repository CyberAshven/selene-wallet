import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";
import { accordionControl, expectToggle } from "./helpers/wallet";

test.describe("Settings: User Interface", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const uiBtn = page.getByRole("button", { name: "User Interface" });
    await expect(uiBtn).toBeVisible();
    await uiBtn.click();
  });

  test("theme mode cycles system/light/dark", async ({ appPage: page }) => {
    const themeSelect = accordionControl(page, "Theme mode", "select");
    await expect(themeSelect).toBeVisible({ timeout: 3_000 });

    await expect(themeSelect.getByRole("option")).toHaveCount(3);

    // Switch to dark — verify via document.documentElement
    await themeSelect.selectOption({ index: 2 });
    await expect(async () => {
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      expect(isDark).toBe(true);
    }).toPass({ timeout: 2_000 });

    // Switch to light
    await themeSelect.selectOption({ index: 1 });
    await expect(async () => {
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      expect(isDark).toBe(false);
    }).toPass({ timeout: 2_000 });

    // Restore to system
    await themeSelect.selectOption({ index: 0 });
  });

  test("display exchange rate toggle works", async ({ appPage: page }) => {
    const checkbox = accordionControl(
      page,
      "exchange rate",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    await expectToggle(checkbox);
  });

  test("display sync counter toggle works", async ({ appPage: page }) => {
    const checkbox = accordionControl(
      page,
      "sync counter",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    await expectToggle(checkbox);
  });
});
