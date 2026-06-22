import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";
import { accordionControl } from "./helpers/wallet";

test.describe("Explore", () => {
  test("explore tab visibility toggles from settings", async ({
    appPage: page,
  }) => {
    // Explore tab should be visible by default
    await expect(nav.explore(page)).toBeVisible();

    // Navigate to Settings > User Interface accordion
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const uiAccordion = page.getByRole("button", {
      name: "User Interface",
    });
    await expect(uiAccordion).toBeVisible();
    await uiAccordion.click();

    const checkbox = accordionControl(
      page,
      "Display Explore tab",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeChecked();

    // Uncheck — explore tab should disappear
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expect(nav.explore(page)).toBeHidden();

    // Re-check — explore tab should reappear
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await expect(nav.explore(page)).toBeVisible();
  });

  test("explore page renders", async ({ appPage: page }) => {
    await nav.explore(page).click();
    await page.waitForURL("**/explore");
    await expect(page.getByRole("main")).toBeVisible();
  });
});
