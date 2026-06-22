import { test, expect } from "./helpers/fixtures";
import { nav } from "./helpers/selectors";
import { accordionControl, expectToggle } from "./helpers/wallet";

test.describe("Settings: Payment", () => {
  test.beforeEach(async ({ appPage: page }) => {
    await nav.settings(page).click();
    await page.waitForURL("**/settings**");

    const paymentBtn = page.getByRole("button", { name: "Payment" });
    await expect(paymentBtn).toBeVisible();
    await paymentBtn.click();
  });

  test("instant pay toggle shows limit input when enabled", async ({
    appPage: page,
  }) => {
    const checkbox = accordionControl(
      page,
      "Allow Instant Pay",
      "input[type='checkbox']"
    );
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    const limitLabel = page.getByText("Instant Pay limit", { exact: false });
    await expect(limitLabel).toBeVisible();

    const limitInput = page.getByTestId("satoshi-input");
    await expect(limitInput.first()).toBeVisible();
  });

  test("legacy payment format toggle works", async ({ appPage: page }) => {
    const checkbox = accordionControl(
      page,
      "Legacy payment request format",
      "input[type='checkbox']"
    );
    await checkbox.scrollIntoViewIfNeeded();
    await expect(checkbox).toBeVisible({ timeout: 3_000 });

    await expectToggle(checkbox);
  });
});
