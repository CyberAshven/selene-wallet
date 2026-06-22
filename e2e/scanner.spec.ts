import { test, expect } from "./helpers/fixtures";
import { walletView, scanner } from "./helpers/selectors";

test.describe("Scanner", () => {
  test("scanner opens and closes", async ({ appPage: page }) => {
    const scannerBtn = walletView.scannerButton(page);
    await expect(scannerBtn).toBeVisible();
    await scannerBtn.click();

    const closeBtn = scanner.closeButton(page).first();
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });

    await closeBtn.click();

    await expect(
      page.getByText("Receive", { exact: true }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test.fixme("scanner torch works", async () => {
    // Scanner torch requires native Capacitor plugin - skip in headless
  });

  test.fixme("image select scan works", async () => {
    // Image select requires file picker / native camera - skip in headless
  });
});
