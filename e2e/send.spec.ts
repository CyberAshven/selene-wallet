import { test, expect } from "./helpers/fixtures";
import { walletView, sendPage } from "./helpers/selectors";

test.describe("Send", () => {
  test.beforeEach(async ({ appPage: page }) => {
    const sendBtn = walletView.sendButton(page);
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();
    await page.waitForURL("**/wallet/send**");
  });

  test("send page renders", async ({ appPage: page }) => {
    await expect(sendPage.header(page)).toBeVisible();
  });

  test("address input and amount input are accessible", async ({
    appPage: page,
  }) => {
    await expect(sendPage.addressInput(page)).toBeVisible();
    await expect(sendPage.amountInput(page).first()).toBeVisible();
  });

  test("back button works", async ({ appPage: page }) => {
    const backBtn = sendPage.backButton(page);
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await page.waitForURL("**/wallet**");
    await expect(
      page.getByText("Receive", { exact: true }).first()
    ).toBeVisible();
  });

  test("large amount shows error state", async ({ appPage: page }) => {
    const amountInput = sendPage.amountInput(page).first();
    await expect(amountInput).toBeVisible();
    await amountInput.fill("999999999");
    await expect(amountInput).toHaveClass(/border-error/);
  });

  test("slide-to-send visible", async ({ appPage: page }) => {
    await expect(sendPage.slideToSend(page)).toBeVisible();
  });
});
