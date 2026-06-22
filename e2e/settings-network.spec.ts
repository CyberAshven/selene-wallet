import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";
import { accordionControl } from "./helpers/wallet";

test.describe("Settings: Network", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const networkBtn = page.getByRole("button", { name: "Network" });
    await expect(networkBtn).toBeVisible();
    await networkBtn.click();
  });

  test("server select shows available servers", async ({
    appPage: page,
  }) => {
    const serverSelect = accordionControl(page, "Electrum Server", "select");
    await expect(serverSelect).toBeVisible({ timeout: 3_000 });

    const count = await serverSelect.getByRole("option").count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("add custom server form appears on plus button click", async ({
    appPage: page,
  }) => {
    const plusBtn = page
      .getByRole("button")
      .filter({
        has: page.getByRole("img", { name: "plus-circle" }),
      });
    await expect(plusBtn).toBeVisible({ timeout: 3_000 });
    await plusBtn.click();

    const serverInput = accordionControl(
      page,
      "Custom Server",
      "input[type='text']"
    );
    await expect(serverInput).toBeVisible({ timeout: 3_000 });
    await serverInput.fill("not-a-valid-server");
  });

  test("offline mode toggle works", async ({ appPage: page }) => {
    const checkbox = accordionControl(
      page,
      "Offline",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    // Enable offline mode
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Server select should be disabled when offline
    const serverSelect = accordionControl(page, "Electrum Server", "select");
    await expect(serverSelect).toBeDisabled();

    // Disable offline mode (restore)
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
    await expect(serverSelect).toBeEnabled();
  });
});
