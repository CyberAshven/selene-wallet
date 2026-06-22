import { test, expect } from "./helpers/fixtures";
import { walletView } from "./helpers/selectors";
import { getDisplayedAddress } from "./helpers/wallet";

test.describe("Wallet View (Receive Screen)", () => {
  test("app boots to receive screen", async ({ appPage: page }) => {
    await expect(
      page.getByText("Receive", { exact: true }).first()
    ).toBeVisible();
  });

  test("address is displayed", async ({ appPage: page }) => {
    const addressEl = walletView.addressDisplay(page);
    await expect(addressEl).toBeVisible();
    const address = await getDisplayedAddress(page);
    expect(address.length).toBeGreaterThan(0);
    expect(address).toMatch(/^q[a-z0-9]+$/);
  });

  test("address format is valid cashaddr", async ({ appPage: page }) => {
    const address = await getDisplayedAddress(page);
    // CashAddr charset: qpzry9x8gf2tvdw0s3jn54khce6mua7l
    expect(address).toMatch(/^q[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/);
    expect(address.length).toBeGreaterThanOrEqual(34);
  });

  test("QR code is displayed", async ({ appPage: page }) => {
    await expect(walletView.qrButton(page)).toBeVisible();
  });

  test("receive tokens toggle updates address", async ({
    appPage: page,
  }) => {
    const addressBefore = await getDisplayedAddress(page);

    const checkbox = page.getByTestId("receive-tokens");
    await expect(checkbox).toBeVisible();
    await checkbox.click();

    // Wait for address to change (token address differs from standard)
    const addressEl = walletView.addressDisplay(page);
    await expect(addressEl).not.toHaveText(addressBefore);

    const addressAfter = await getDisplayedAddress(page);
    expect(addressAfter).not.toBe(addressBefore);

    // Toggle back
    await checkbox.click();
    await expect(addressEl).toHaveText(addressBefore);
  });

  test("request amount shows input", async ({ appPage: page }) => {
    const trigger = walletView.requestAmountTrigger(page);
    await expect(trigger).toBeVisible();
    await trigger.click();

    const input = walletView.requestAmountInput(page).first();
    await expect(input).toBeVisible();
  });

  test("eyeball button toggles privacy mode", async ({ appPage: page }) => {
    const hideBtn = walletView.balanceHideButton(page).first();
    await expect(hideBtn).toBeVisible();
    await hideBtn.click();

    // Balance should be hidden
    const balanceArea = walletView.balanceArea(page);
    await expect(balanceArea).toHaveAttribute("data-hidden", "true");

    // Click balance area to undo privacy mode
    await balanceArea.click();
    await expect(balanceArea).toHaveAttribute("data-hidden", "false");
  });

  test("tapping balance swaps currency display", async ({
    appPage: page,
  }) => {
    const balanceArea = walletView.balanceArea(page);
    await expect(balanceArea).toBeVisible();
    const textBefore = await balanceArea.textContent();
    await balanceArea.click();
    await expect(balanceArea).not.toHaveText(textBefore!);
  });

  test("wallet name navigates to wallet settings", async ({
    appPage: page,
  }) => {
    const walletNameLink = walletView.walletNameLink(page);
    await expect(walletNameLink).toBeVisible();
    await walletNameLink.click();
    await page.waitForURL("**/settings/wallet/**");
  });

  test("history button navigates", async ({ appPage: page }) => {
    const historyBtn = walletView.historyButton(page);
    await expect(historyBtn).toBeVisible();
    await historyBtn.click();
    await page.waitForURL("**/wallet/history");
  });

  test("send button navigates", async ({ appPage: page }) => {
    const sendBtn = walletView.sendButton(page);
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();
    await page.waitForURL("**/wallet/send**");
  });
});
