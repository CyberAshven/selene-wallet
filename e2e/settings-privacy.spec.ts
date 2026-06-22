import { test, expect } from "./helpers/fixtures";
import { nav, walletView } from "./helpers/selectors";
import { accordionControl, expectToggle } from "./helpers/wallet";

test.describe("Settings: Privacy", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const privacyBtn = page.getByRole("button", { name: "Privacy" });
    await expect(privacyBtn).toBeVisible();
    await privacyBtn.click();
  });

  test("hide balance toggle works and affects wallet view", async ({
    appPage: page,
  }) => {
    const checkbox = accordionControl(
      page,
      "Hide balances",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    // Ensure hide balance is enabled (toggle on if not already)
    await checkbox.check();
    await expect(checkbox).toBeChecked();

    // Go to wallet — balance should be hidden
    await nav.wallet(page).click();
    const balanceArea = walletView.balanceArea(page);
    await expect(balanceArea).toHaveAttribute("data-hidden", "true", {
      timeout: 3_000,
    });

    // Disable hide balance
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");
    await page.getByRole("button", { name: "Privacy" }).click();
    const checkbox2 = accordionControl(
      page,
      "Hide balances",
      "input[type='checkbox']"
    );
    await checkbox2.click();
    await expect(checkbox2).not.toBeChecked();
  });

  test("daily check-in toggle works", async ({ appPage: page }) => {
    const checkbox = accordionControl(
      page,
      "Stats check-in",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    await expectToggle(checkbox);
  });

  test("auto-resolve token metadata toggle works", async ({
    appPage: page,
  }) => {
    const checkbox = accordionControl(
      page,
      "resolve Token metadata",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    await expectToggle(checkbox);
  });
});
