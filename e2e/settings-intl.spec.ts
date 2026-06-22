import { test, expect } from "./helpers/fixtures";
import { nav, settingsPage } from "./helpers/selectors";
import { accordionControl } from "./helpers/wallet";

test.describe("Settings: Localization", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const intlBtn = page.getByRole("button", { name: "Localization" });
    await expect(intlBtn).toBeVisible();
    await intlBtn.click();
  });

  test("language select shows available languages", async ({
    appPage: page,
  }) => {
    const langSelect = accordionControl(page, "Language", "select");
    await expect(langSelect).toBeVisible({ timeout: 3_000 });

    const count = await langSelect.getByRole("option").count();
    expect(count).toBeGreaterThan(5);
  });

  test("switching language updates UI text", async ({ appPage: page }) => {
    const langSelect = accordionControl(page, "Language", "select");
    await expect(langSelect).toBeVisible();

    // Switch to Spanish
    await langSelect.selectOption({ value: "es" });
    const settingsContainer = settingsPage.container(page);
    const select = settingsContainer.getByRole("combobox").first();
    await expect(select).toHaveValue("es");

    // "Wallets" should now show as "Billeteras"
    await expect(settingsContainer).toContainText("Billeteras");

    // Restore to device default
    await select.selectOption({ value: "" });
    await expect(select).toHaveValue("");
  });
});
