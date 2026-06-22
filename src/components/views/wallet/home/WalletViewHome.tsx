import { useMemo, useRef, useState } from "react";
import { QRCode } from "react-qrcode-logo";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  CaretRightOutlined,
  CloseOutlined,
  CopyOutlined,
  FormOutlined,
  ShopOutlined,
} from "@ant-design/icons";

import { selectKeyboardIsOpen, selectScannerIsScanning } from "@/redux/device";
import {
  selectBchNetwork,
  selectIsStablecoinMode,
  selectQrCodeSettings,
  selectShouldUseLegacyBip21,
  selectShouldUseTokenAddress,
  setPreference,
} from "@/redux/preferences";
import { selectIsSyncing } from "@/redux/sync";
import { selectActiveWalletHash, selectGenesisHeight } from "@/redux/wallet";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";

import translations from "@/views/wallet/translations";
import FullColumn from "@/layout/FullColumn";
import Address from "@/atoms/Address";
import CurrencySymbol from "@/atoms/CurrencySymbol";
import KeyWarning from "@/atoms/KeyWarning/KeyWarning";
import { SatoshiInput } from "@/atoms/SatoshiInput";

import { useClipboard } from "@/hooks/useClipboard";
import { useLongPress } from "@/hooks/useLongPress";

import { convertCashAddress } from "@/util/cashaddr";
import { logos } from "@/util/logos";
import { satsToBch } from "@/util/sats";
import { toAlphanumericUri } from "@/util/uri";

import { translate } from "@/util/translations";

import FocusedQrModal from "./FocusedQrModal";
import ScannerOverlay from "./ScannerOverlay";
import WalletViewButtons from "./WalletViewButtons";

export default function WalletViewHome() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const walletHash = useSelector(selectActiveWalletHash);
  const isKeyboardOpen = useSelector(selectKeyboardIsOpen);
  const isScanning = useSelector(selectScannerIsScanning);

  const qrCodeSettings = useSelector(selectQrCodeSettings);
  const bchNetwork = useSelector(selectBchNetwork);

  const isSyncing = useSelector(selectIsSyncing);
  const genesis_height = useSelector(selectGenesisHeight);

  const isStablecoinMode = useSelector(selectIsStablecoinMode);
  const shouldUseLegacyBip21 = useSelector(selectShouldUseLegacyBip21);

  const shouldUseTokenAddress = useSelector(selectShouldUseTokenAddress);
  const setShouldUseTokenAddress = (mode) =>
    dispatch(setPreference({ key: "useTokenAddress", value: mode }));

  const AddressManager = useMemo(
    () => AddressManagerService(walletHash),
    [walletHash]
  );
  const unusedAddressesRef = useRef(AddressManager.getUnusedAddresses(5));

  // only re-render when isSyncing changes
  const unusedAddresses = useMemo(() => {
    if (!isSyncing) {
      unusedAddressesRef.current = AddressManager.getUnusedAddresses(5);
    }

    return unusedAddressesRef.current;
  }, [AddressManager, isSyncing]);

  const standardAddress = unusedAddresses[0].address;

  // currently displayed address
  const address = useMemo(
    () =>
      shouldUseTokenAddress
        ? convertCashAddress(standardAddress, "tokenaddr")
        : standardAddress,
    [standardAddress, shouldUseTokenAddress]
  );

  // "Request Amount" state
  const [shouldShowRequestAmount, setShouldShowRequestAmount] = useState(false);
  const [satoshiInput, setSatoshiInput] = useState(0n);

  // Focused QR view state
  const [shouldShowFocusedQr, setShouldShowFocusedQr] = useState(false);

  const handleRequestAmountChange = (satInput) => {
    setSatoshiInput(satInput);
  };

  // generate bip21 uri for QR code
  // PayPro CHIP-2023-05: use ?s= (satoshis) by default, ?amount= (BCH) for legacy
  // PayPro format uses alphanumeric encoding for more efficient QR codes
  const qrRequest = useMemo(() => {
    if (!shouldShowRequestAmount || satoshiInput <= 0) {
      return address;
    }
    if (shouldUseLegacyBip21) {
      return `${address}?amount=${satsToBch(satoshiInput).bch}`;
    }
    return toAlphanumericUri(`${address}?s=${satoshiInput}`);
  }, [shouldShowRequestAmount, satoshiInput, address, shouldUseLegacyBip21]);

  const qrLogoImage = useMemo(() => {
    const logo = qrCodeSettings.logo.toLowerCase();
    return shouldUseTokenAddress ? logos[logo].img_tokens : logos[logo].img;
  }, [shouldUseTokenAddress, qrCodeSettings.logo]);

  const { handleCopyToClipboard } = useClipboard();
  const copyAddressToClipboard = async () => {
    handleCopyToClipboard(qrRequest, translate(translations.copiedAddress));
  };

  // Long press QR to show focused view, tap to copy
  const qrLongPressEvents = useLongPress(function handleQrLongPress() {
    setShouldShowFocusedQr(true);
  }, copyAddressToClipboard);

  const handleEnterVendorMode = async () => {
    const isAuthorized = await SecurityService().authorize(
      AuthActions.VendorMode
    );
    if (!isAuthorized) {
      return;
    }

    dispatch(setPreference({ key: "vendorModeActive", value: "true" }));
    navigate("/vendor");
  };

  // force red QR code border if connected to chipnet
  const qrCodeBorder =
    bchNetwork !== "mainnet"
      ? "border-[#ff0000]"
      : "border-primary-700 dark:border-primarydark-200";
  const addressColor =
    bchNetwork !== "mainnet" ? "text-[#ff0000]" : "text-neutral-25";

  return isScanning ? (
    <ScannerOverlay />
  ) : (
    <FullColumn className="justify-between">
      <div className="text-neutral-25">
        <div className="w-full mx-auto bg-primary dark:bg-primarydark-200 font-mono">
          <div className="py-1 flex justify-center items-center text-sm text-center uppercase">
            {translate(translations.receive)}
          </div>
          <div className="w-fit mx-auto">
            <button
              type="button"
              data-testid="qr-button"
              className={`border-4 cursor-pointer active:bg-primary shadow-inner shadow-lg active:shadow-none active:shadow-inner active:scale-[0.98] select-none ${qrCodeBorder}`}
              {...qrLongPressEvents}
            >
              <QRCode
                value={qrRequest}
                size={232}
                quietZone={12}
                bgColor={
                  bchNetwork !== "mainnet"
                    ? "#ffffff"
                    : qrCodeSettings.background
                }
                fgColor={
                  bchNetwork !== "mainnet"
                    ? "#000000"
                    : qrCodeSettings.foreground
                }
                logoImage={qrLogoImage}
                logoWidth={64}
                logoHeight={64}
              />
            </button>
          </div>
          <button
            type="button"
            data-testid="address-display"
            onClick={copyAddressToClipboard}
            className="flex items-center justify-center w-full py-2 text-xs text-center cursor-pointer slashed-zero select-none active:bg-primary-700 active:shadow-inner"
          >
            <CopyOutlined className={`mr-0.5 ${addressColor}`} />
            <Address
              address={address}
              color={addressColor}
              className="tracking-tight"
            />
          </button>
        </div>
        {shouldShowRequestAmount ? (
          <div className="flex justify-evenly items-center rounded-b-sm text-sm">
            <div className="flex w-full justify-between items-center text-primary-50 bg-primary-700">
              <CloseOutlined
                className="p-1 font-bold text-lg"
                onClick={() => setShouldShowRequestAmount(false)}
              />
              <span className="flex text-center grow items-center ml-1">
                <CurrencySymbol
                  className="text-lg bg-primary-200 rounded-l px-1 text-neutral-500 font-semibold font-mono dark:bg-primarydark-500"
                  currency={isStablecoinMode ? "USD" : undefined}
                />
                <SatoshiInput
                  satoshis={satoshiInput}
                  onChange={handleRequestAmountChange}
                  className="p-1 mr-1 w-full text-black/70 font-mono rounded-r dark:bg-primarydark-50 dark:text-neutral-100"
                  autoFocus
                />
              </span>

              <label
                className="bg-primary-400 dark:bg-primarydark-100 px-1.5 py-1.5 border-l border-primary-400 dark:border-primarydark-100 text-nowrap truncate flex items-center justify-between"
                onClick={handleEnterVendorMode}
              >
                <ShopOutlined className="mr-1" />
                {translate(translations.vendorMode)}
                <CaretRightOutlined className="ml-1" />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex justify-evenly items-center rounded-b-sm text-sm">
            <div
              className={`grow font-sans px-1 py-1.5 text-nowrap truncate ${!shouldShowRequestAmount ? "bg-primary-400 dark:bg-primarydark-100 active:bg-primary-700 active:shadow-inner" : "text-primary-50 bg-primary-700"}`}
              onClick={() =>
                !shouldShowRequestAmount && setShouldShowRequestAmount(true)
              }
            >
              <div
                data-testid="request-amount"
                className="flex items-center justify-center cursor-pointer"
              >
                <FormOutlined className="mr-1 font-bold" />
                <span className="truncate">
                  {translate(translations.requestAmount)}
                </span>
                <CaretRightOutlined className="ml-1" />
              </div>
            </div>
            <label
              className={`${shouldUseTokenAddress ? "bg-primary-700 dark:bg-primarydark-200" : "bg-primary-400 dark:bg-primarydark-100"} px-1.5 py-1.5 border-l border-primary-400 dark:border-primarydark-100 text-nowrap truncate flex items-center justify-between`}
            >
              {translate(translations.receiveTokens)}&nbsp;
              <input
                type="checkbox"
                data-testid="receive-tokens"
                checked={shouldUseTokenAddress}
                onChange={() =>
                  setShouldUseTokenAddress(!shouldUseTokenAddress)
                }
              />
            </label>
          </div>
        )}
        {genesis_height > 0 && <KeyWarning walletHash={walletHash} />}
      </div>
      {!isKeyboardOpen && <WalletViewButtons />}
      {shouldShowFocusedQr && (
        <FocusedQrModal
          qrRequest={qrRequest}
          onClose={() => setShouldShowFocusedQr(false)}
        />
      )}
    </FullColumn>
  );
}
