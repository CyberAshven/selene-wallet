import { test, expect } from "./helpers/fixtures";
import { walletView } from "./helpers/selectors";

test.describe("Wallet View: Advanced Interactions", () => {
  test("QR button contains rendered QR code", async ({ appPage: page }) => {
    const qrBtn = walletView.qrButton(page);
    await expect(qrBtn).toBeVisible();
    // QR code renders as a <canvas> inside the button — verify child content exists
    await expect(qrBtn).toHaveAttribute("data-testid", "qr-button");
    const inner = await qrBtn.innerHTML();
    expect(inner.length).toBeGreaterThan(0);
  });

  test("sync indicator is visible", async ({ appPage: page }) => {
    const syncIndicator = page.getByTestId("sync-indicator");
    await expect(syncIndicator).toBeVisible({ timeout: 5_000 });
  });
});
