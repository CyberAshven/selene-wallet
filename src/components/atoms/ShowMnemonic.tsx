import { useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { EyeInvisibleOutlined, WarningFilled } from "@ant-design/icons";

import { walletSetKeyViewed } from "@/redux/wallet";

import ModalService from "@/kernel/app/ModalService";
import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import translations from "@/components/views/settings/SettingsWalletView/translations";

import { useClipboard } from "@/hooks/useClipboard";
import { useLongPress } from "@/hooks/useLongPress";

import { translate } from "@/util/translations";

export default function ShowMnemonic({
  walletHash,
  onReveal = undefined,
  disableLongPress = false,
}: {
  walletHash: string;
  onReveal?: () => void;
  disableLongPress?: boolean;
}) {
  const dispatch = useDispatch();
  const WalletManager = WalletManagerService();

  const { handleCopyToClipboard } = useClipboard();

  // toggle visibility for recovery phrase
  const [shouldShowRecoveryPhrase, setShouldShowRecoveryPhrase] =
    useState(false);
  const mnemonic = useRef("");
  const passphrase = useRef("");

  const handleFetchMnemonic = async () => {
    await WalletManager.openWalletDatabase(walletHash);
    const { mnemonic: m, passphrase: p } = WalletManager.getWallet(walletHash);

    mnemonic.current = m;
    passphrase.current = p;
  };

  // handler for mnemonic visibility area
  const handleShowMnemonic = async () => {
    if (shouldShowRecoveryPhrase === false) {
      const isAuthorized = await SecurityService().authorize(
        AuthActions.RevealPrivateKeys
      );
      if (!isAuthorized) {
        return;
      }

      await handleFetchMnemonic();

      setShouldShowRecoveryPhrase(true);
      dispatch(walletSetKeyViewed({ walletHash }));
      onReveal?.();
    } else {
      mnemonic.current = "";
      setShouldShowRecoveryPhrase(false);
    }
  };

  const handleClipboardCopy = async () => {
    const hasConsent = await ModalService().showConfirm({
      title: translate(translations.copyToClipboardPromptTitle),
      message: translate(translations.copyToClipboardPromptMessage),
      confirmLabel: translate(translations.proceed),
    });
    if (!hasConsent) {
      return;
    }

    const isAuthorized = await SecurityService().authorize(
      AuthActions.RevealPrivateKeys
    );
    if (!isAuthorized) {
      return;
    }

    await handleFetchMnemonic();

    const hasPassphrase = passphrase.current !== "";
    const clipboardString = hasPassphrase
      ? `${mnemonic.current} — ${translate(translations.passphrase)}: ${passphrase.current}`
      : mnemonic.current;

    handleCopyToClipboard(
      clipboardString,
      translate(translations.copiedToClipboardSuccess),
      hasPassphrase
        ? translate(translations.copiedToClipboardPassphrase)
        : undefined,
      true
    );
  };

  const wallet = WalletManager.getWalletMeta(walletHash);

  const isKeyViewed = wallet.key_viewed_at !== null;
  const hasWalletBalance = wallet.balance > 0;

  const walletBalanceClasses = hasWalletBalance
    ? "border-4 border-error bg-warn"
    : "border-4 border-warn bg-warn/90";

  const keyNotViewedClasses = isKeyViewed
    ? "border-2 border-primary-700 bg-neutral-600"
    : walletBalanceClasses;

  const handleLongPress = async () => {
    if (shouldShowRecoveryPhrase === false && isKeyViewed === false) {
      return;
    }
    await handleClipboardCopy();
  };

  const longPressEvents = useLongPress<
    React.TouchEvent<HTMLButtonElement> | React.MouseEvent
  >(disableLongPress ? () => {} : handleLongPress, handleShowMnemonic);

  const splitMnemonic = mnemonic.current.split(" ");

  return (
    <button
      type="button"
      className={`w-full flex-col rounded-lg flex items-center justify-center my-2 px-2 py-4 cursor-pointer border rounded-lg ${keyNotViewedClasses}`}
      // eslint-disable-next-line
      {...longPressEvents}
    >
      {shouldShowRecoveryPhrase ? (
        <div className="flex flex-col justify-between items-center">
          <div className="text-center text-error text-xl font-bold">
            <WarningFilled className="mr-2 text-warn" />
            {translate(translations.keepSecret)}
            <WarningFilled className="ml-2 text-warn" />
          </div>
          <div className="text-center text-neutral-50 text-xl py-4 select-all grid gap-md grid-cols-3 gap-2 font-mono">
            {splitMnemonic.map((w, idx) => (
              <div
                key={`w-${w}`}
                className="col-span-1 rounded-2xl border whitespace-nowrap px-2 py-1 text-sm flex select-none"
              >
                <span className="text-neutral-300">{idx + 1}.</span>{" "}
                <span className="flex-1 text-center">{w}</span>
              </div>
            ))}
          </div>
          <div className="text-center text-error text-xl font-bold">
            <WarningFilled className="mr-2 text-warn" />
            {translate(translations.dontStoreDigitally)}
            <WarningFilled className="ml-2 text-warn" />
          </div>
        </div>
      ) : (
        <>
          <EyeInvisibleOutlined className="text-8xl text-neutral-50" />
          <div className="text-center text-neutral-25 text-xl font-bold">
            {translate(translations.viewRecoveryPhrase)}
          </div>
          {isKeyViewed ? (
            <div className="text-center text-neutral-200 font-mono tracking-tight">
              ({translate(translations.longPressToCopy)})
            </div>
          ) : (
            <div className="text-center text-neutral-50 text-lg font-semibold">
              ({translate(translations.secretAndSecure)})
            </div>
          )}
        </>
      )}
    </button>
  );
}
