import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CheckCircleFilled,
  CopyOutlined,
} from "@ant-design/icons";

import {
  selectBchNetwork,
  selectCurrencySettings,
  selectShouldShowMemoCard,
  selectShouldShowOutputsCard,
  setPreference,
} from "@/redux/preferences";
import { selectActiveWalletHash } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import TokenManagerService from "@/kernel/wallet/TokenManagerService";
import TransactionHistoryService from "@/kernel/wallet/TransactionHistoryService";

import translations from "@/views/wallet/translations";
import Address from "@/atoms/Address";
import Satoshi from "@/atoms/Satoshi";
import SeleneLogo from "@/atoms/SeleneLogo";
import TokenAmount from "@/atoms/TokenAmount";

import { useClipboard } from "@/hooks/useClipboard";

import { binToHex } from "@/util/hex";

import { translate } from "@/util/translations";

const Log = LogService("WalletViewSendSuccess");

function WalletViewSendSuccess() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const location = useLocation();
  const { tx_hash, tx, header, prefillMemo } = location.state;
  const [isFocused, setIsFocused] = useState(false);

  const shouldShowOutputs = useSelector(selectShouldShowOutputsCard);
  const shouldShowMemo = useSelector(selectShouldShowMemoCard);

  Log.debug(tx_hash, tx);

  const walletHash = useSelector(selectActiveWalletHash);
  const { localCurrency } = useSelector(selectCurrencySettings);
  const bchNetwork = useSelector(selectBchNetwork);

  const [memo, setMemo] = useState(prefillMemo || "");

  const memoSaveRef = useRef(undefined);

  const handleMemoChange = (event) => {
    clearTimeout(memoSaveRef.current);

    setMemo(event.target.value);

    memoSaveRef.current = setTimeout(
      () =>
        TransactionHistoryService(
          walletHash,
          localCurrency,
          bchNetwork
        ).setTransactionMemo(tx_hash, event.target.value),
      1250
    );
  };

  const { handleCopyToClipboard } = useClipboard();

  const handleCopyTransactionId = async (event) => {
    event.stopPropagation();
    handleCopyToClipboard(tx_hash, translate(translations.transactionId));
  };

  const toggleOutputsVisibility = async (event) => {
    event.stopPropagation();
    dispatch(
      setPreference({
        key: "showOutputsCard",
        value: String(!shouldShowOutputs),
      })
    );
  };

  const toggleMemoVisibility = async (event) => {
    event.stopPropagation();
    dispatch(
      setPreference({ key: "showMemoCard", value: String(!shouldShowMemo) })
    );
  };

  const hasTokens = tx.vout.find((out) => out.token) !== undefined;

  return (
    <div
      className="absolute top-0 left-0 w-full h-full z-50 bg-primary dark:bg-primarydark-100 overflow-y-auto overscroll-none"
      onClick={() => navigate("/")}
    >
      <div
        className={`flex items-center justify-center p-4 bg-neutral-800 shadow-lg transition-[height] ${isFocused ? "h-0" : "h-48"}`} // set the height dynamically based on input focus to prevent the virtual keyboard from overlaying the input
      >
        <SeleneLogo className="h-full" cashtokens={hasTokens} />
      </div>
      <div className="p-1 bg-primary dark:bg-primary-900 text-white shadow-inner">
        <div className="p-2 flex justify-center items-center">
          <span className="text-4xl font-bold">
            {header || translate(translations.transactionSent)}
          </span>
        </div>
        <div className="p-2 flex justify-center items-center">
          <span className="text-2xl font-semibold">
            {translate(translations.tapAnywhereToContinue)}
          </span>
        </div>
      </div>
      <div className="p-2">
        <div
          className="border rounded mb-2 border-primary"
          onClick={handleCopyTransactionId}
        >
          <div className="p-1 bg-primary-900 rounded-t border border-t-0 border-primary-900">
            <span className="font-semibold text-neutral-25 flex items-center">
              {translate(translations.transactionId)}
              <CopyOutlined className="ml-1" />
            </span>
          </div>
          <div className="bg-primary-100 p-1 rounded-b-sm border border-t-0 border-primary-900">
            <span className="font-mono text-neutral-600 text-sm tracking-tighter break-all select-none">
              {tx_hash}
            </span>
          </div>
        </div>
        <div
          className="border rounded mb-2 border-primary"
          onClick={toggleMemoVisibility}
        >
          <div className="p-1 bg-primary-900 rounded-t border border-t-0 border-primary-900">
            <span className="font-semibold text-neutral-25 flex items-center">
              {translate(translations.memo)}
              {shouldShowMemo ? (
                <CaretDownOutlined className="ml-1" />
              ) : (
                <CaretRightOutlined className="ml-1" />
              )}
            </span>
          </div>
          {shouldShowMemo && (
            <div className="flex items-center p-1 rounded-b-sm border border-t-0 border-primary-900">
              <input
                type="text"
                className="flex-1 rounded-sm p-1 bg-white dark:bg-neutral-700 text-primary dark:text-neutral-25"
                value={memo}
                onChange={handleMemoChange}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onClick={(e) => e.stopPropagation()}
              />
              {memo && (
                <CheckCircleFilled className="shrink text-primary text-lg ml-2 mr-1 font-bold" />
              )}
            </div>
          )}
        </div>
        <div
          className="border rounded mb-2 border-primary"
          onClick={toggleOutputsVisibility}
        >
          <div className="p-1 bg-primary-900 rounded-t border border-t-0 border-primary-900">
            <span className="font-semibold text-neutral-25 flex items-center">
              {translate(translations.outputs)}
              {shouldShowOutputs ? (
                <CaretDownOutlined className="ml-1" />
              ) : (
                <CaretRightOutlined className="ml-1" />
              )}
            </span>
          </div>
          {shouldShowOutputs && (
            <div className="bg-primary-700 border border-primary-900">
              {tx.vout.map((output, i) => (
                <OutputListItem key={output.n} output={output} i={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default WalletViewSendSuccess;

/* eslint-disable react/prop-types */
function OutputListItem({ output, i }) {
  const bchNetwork = useSelector(selectBchNetwork);
  const zebraCss =
    i % 2 === 0
      ? "bg-primary-100 dark:bg-primarydark-100"
      : "bg-primary-50 dark:bg-primarydark-50";

  // Determine address format based on whether tokens are present
  const addressFormat = output.token ? "tokenaddr" : undefined;

  const walletHash = useSelector(selectActiveWalletHash);
  const TokenManager = TokenManagerService(walletHash, bchNetwork);
  const tokenData = output.token
    ? TokenManager.getToken(binToHex(output.token.category))
    : undefined;

  const token = tokenData
    ? {
        ...tokenData,
        amount: output.token.amount,
        nftCount: output.token.nft ? 1 : 0,
      }
    : undefined;

  return (
    <div className={`p-1.5 ${zebraCss}`}>
      <div className="flex text-sm items-center">
        <Address
          address={output.scriptPubKey.addresses[0]}
          format={addressFormat}
          className="tracking-tight"
        />
      </div>
      <div className="flex justify-between">
        <div className="dark:text-neutral-100">
          <span className="text-xs tracking-tighter mr-1.5 opacity-70">
            #{output.n}
          </span>
          <span className="font-mono">
            <Satoshi value={output.valueSatoshis} />
          </span>
          <span className="mx-1 text-neutral-500">/</span>
          <span className="text-sm opacity-80">
            <Satoshi value={output.valueSatoshis} flip />
          </span>
        </div>
        {token && (
          <span className="flex items-center justify-end">
            <span
              style={{ color: token.color }}
              className="font-mono text-xs tracking-tighter font-bold mr-0.5"
            >
              {token.symbol}
            </span>
            <span className="flex items-baseline gap-x-0.5">
              {token.amount > 0 && <TokenAmount token={token} />}
              {token.nftCount > 0 && <TokenAmount token={token} nft />}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
