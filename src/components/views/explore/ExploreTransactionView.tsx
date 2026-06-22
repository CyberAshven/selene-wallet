/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLoaderData } from "react-router";
import { DateTime } from "luxon";
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  CopyOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  HourglassOutlined,
} from "@ant-design/icons";

import {
  selectBchNetwork,
  selectCurrencySettings,
  selectIsExperimental,
} from "@/redux/preferences";
import { selectChaintip } from "@/redux/sync";
import { selectActiveWalletHash } from "@/redux/wallet";

//import LogService from "@/kernel/app/LogService";
import NotificationService from "@/kernel/app/NotificationService";
import TransactionManagerService, {
  TransactionOutput,
  TransactionEntity,
} from "@/kernel/bch/TransactionManagerService";
import TokenManagerService from "@/kernel/wallet/TokenManagerService";
import TransactionExportService, {
  prepareTransactionExportData,
} from "@/kernel/wallet/TransactionExportService";
import TransactionHistoryService from "@/kernel/wallet/TransactionHistoryService";

import Accordion from "@/atoms/Accordion";
import Address from "@/atoms/Address";
import Button from "@/atoms/Button";
import Card from "@/atoms/Card";
import Editable from "@/atoms/Editable";
import LinkExternal from "@/atoms/LinkExternal";
import Satoshi from "@/atoms/Satoshi";
import TokenAmount from "@/atoms/TokenAmount";

import { useClipboard } from "@/hooks/useClipboard";

import { binToHex, hexToUtf8 } from "@/util/hex";
import { getTxExplorerUrl } from "@/util/network";

import { translate } from "@/util/translations";
import translations from "./translations";

import ExploreSearchBar from "./ExploreSearchBar";

//const Log = LogService("ExploreTransactionView");

export default function ExploreTransactionView() {
  const tx = useLoaderData();

  const isExperimental = useSelector(selectIsExperimental);
  const bchNetwork = useSelector(selectBchNetwork);

  const walletHash = useSelector(selectActiveWalletHash);
  const { localCurrency } = useSelector(selectCurrencySettings);
  const chaintip = useSelector(selectChaintip);

  const TransactionHistory = useMemo(
    () => TransactionHistoryService(walletHash, localCurrency, bchNetwork),
    [walletHash, localCurrency, bchNetwork]
  );
  const [isExporting, setIsExporting] = useState(false);

  const [memo, setMemo] = useState(
    TransactionHistory.getTransactionMemo(tx.tx_hash) || ""
  );

  useEffect(
    function refreshMemo() {
      setMemo(TransactionHistory.getTransactionMemo(tx.tx_hash));
    },
    [tx.tx_hash, TransactionHistory]
  );

  const isConfirmed = tx.blockhash !== null;
  const confirmations = isConfirmed ? chaintip.height - tx.height : 0;

  const txDate = (
    isConfirmed ? DateTime.fromSeconds(tx.time) : DateTime.fromISO(tx.time_seen)
  ).toLocaleString(DateTime.DATETIME_FULL);

  const { handleCopyToClipboard } = useClipboard();
  const handleCopyTransactionId = async () => {
    handleCopyToClipboard(tx.tx_hash, translate(translations.transactionId));
  };

  const handleSaveMemo = (newMemo) => {
    setMemo(newMemo);
    TransactionHistory.setTransactionMemo(tx.tx_hash, newMemo);
  };

  const handleExportAsPdf = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    const Notification = NotificationService();
    const dismissLoading = Notification.loading(
      translate(translations.pdfExportGenerating)
    );

    try {
      const exportData = await prepareTransactionExportData(
        tx,
        chaintip,
        memo,
        walletHash
      );

      await TransactionExportService.exportAsPDF(
        exportData,
        `transaction-${tx.tx_hash.slice(0, 8)}`
      );
      dismissLoading();
      Notification.success(translate(translations.pdfExportSuccess));
    } catch (error) {
      dismissLoading();
      Notification.error(translate(translations.pdfExportError));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAsPng = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    const Notification = NotificationService();
    const dismissLoading = Notification.loading(
      translate(translations.pngExportGenerating)
    );

    try {
      const exportData = await prepareTransactionExportData(
        tx,
        chaintip,
        memo,
        walletHash
      );

      await TransactionExportService.exportAsPNG(
        exportData,
        `transaction-${tx.tx_hash.slice(0, 8)}`
      );
      dismissLoading();
      Notification.success(translate(translations.pngExportSuccess));
    } catch (error) {
      dismissLoading();
      Notification.error(translate(translations.pngExportError));
    } finally {
      setIsExporting(false);
    }
  };

  //Log.debug(tx, confirmations);

  return (
    <>
      <ExploreSearchBar />
      <div className="p-1">
        <div className="bg-neutral-700 rounded">
          <div className="font-semibold text-neutral-100 p-1.5">
            {translate(translations.transactionId)}
          </div>
          <div
            className="flex items-center justify-center rounded p-1 bg-primary-900"
            onClick={handleCopyTransactionId}
          >
            <div className="w-full p-2 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-100 border-2 border-primary rounded flex items-center justify-center active:bg-primary">
              <CopyOutlined className="mr-1" />
              <div className="font-mono text-xs flex flex-col items-center w-full">
                <span>{tx.tx_hash.slice(0, 32)}</span>
                <span>{tx.tx_hash.slice(32)}</span>
              </div>
            </div>
          </div>
        </div>

        <Card className="my-1 p-2">
          <div className="p-1">
            <div className="font-bold flex items-center justify-start">
              <span>{txDate}</span>
            </div>

            {isConfirmed ? (
              <div className="flex items-center font-bold text-neutral-500 dark:text-neutral-200 text-sm">
                <span>
                  <span className="flex items-center">
                    <CheckCircleOutlined className="text-primary mr-1" />
                    {translate(translations.confirmedInBlock)} #{tx.height} (
                    {confirmations} {translate(translations.blocks)})
                  </span>
                </span>
              </div>
            ) : (
              <div className="flex items-center font-bold text-neutral-500 dark:text-neutral-200 text-sm">
                <HourglassOutlined className="text-neutral-500 dark:text-neutral-200 mr-1" />
                {translate(translations.pendingConfirmation)}
              </div>
            )}

            <div className="py-1">
              <LinkExternal to={getTxExplorerUrl(tx.tx_hash, bchNetwork)}>
                <span className="flex items-center text-sm font-bold text-primary-700">
                  View on external explorer{" "}
                  <ArrowRightOutlined className="ml-1" />
                </span>
              </LinkExternal>
            </div>
          </div>

          <div
            className={`p-1 text-neutral-600 dark:text-neutral-100 text-sm ${memo ? "" : "underline"}`}
          >
            <Editable
              value={memo}
              placeholder={translate(translations.setMemo)}
              onConfirm={handleSaveMemo}
              confirmOnBlur
            />
          </div>
        </Card>

        {isExperimental && (
          <div className="my-2 flex gap-1">
            <Button
              icon={FilePdfOutlined}
              label={translate(translations.exportPDF)}
              onClick={handleExportAsPdf}
              disabled={isExporting}
              rounded="lg"
              fullWidth
              inverted
            />
            <Button
              icon={FileImageOutlined}
              label={translate(translations.exportPNG)}
              onClick={handleExportAsPng}
              disabled={isExporting}
              rounded="lg"
              fullWidth
              inverted
            />
          </div>
        )}

        <div className="mt-1.5">
          <div className="rounded mb-2" onClick={(e) => e.stopPropagation()}>
            <div className="p-1.5 bg-neutral-600 rounded-t">
              <span className="font-semibold text-neutral-25 flex items-center">
                {translate(translations.outputs)}
              </span>
            </div>
            <div className="bg-primary-700 dark:text-neutral-100 border border-primary-900">
              {tx.vout.map((output, i) => (
                <OutputListItem key={output.n} output={output} i={i} />
              ))}
            </div>
          </div>
          <Accordion title={translate(translations.inputs)}>
            {tx.vin.map((input, i) => (
              <InputListItem
                key={`${input.tx_hash}:${input.vout}`}
                input={input}
                i={i}
              />
            ))}
          </Accordion>
        </div>
      </div>
    </>
  );
}

function OutputListItem({
  output,
  i,
}: {
  output: TransactionOutput;
  i: number;
}) {
  const bchNetwork = useSelector(selectBchNetwork);

  const zebraCss =
    i % 2 === 0
      ? "bg-primary-100 dark:bg-primarydark-100 dark:text-neutral-100"
      : "bg-primary-50 dark:bg-primarydark-50 dark:text-neutral-100";

  const asmSplit = output.scriptPubKey.asm.split(" ");
  const isOpReturn = asmSplit[0] === "OP_RETURN";
  const opReturnData = hexToUtf8(asmSplit.slice(2).join()); // OP_RETURN OP_PUSHDATA_X ...

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
        amount: output.token!.amount,
        nftCount: output.token.nft ? 1 : 0,
      }
    : undefined;

  return (
    <div className={`p-1.5 ${zebraCss}`}>
      <div className="flex text-sm items-center">
        {isOpReturn ? (
          <div className="font-mono font-bold text-neutral-700 dark:text-neutral-200">
            OP_RETURN
          </div>
        ) : (
          <Address
            address={output.scriptPubKey.addresses![0]}
            format={addressFormat}
            className="tracking-tight"
          />
        )}
      </div>
      <div className="flex justify-between">
        <div>
          <span className="text-xs tracking-tighter mr-1.5 opacity-70">
            #{output.n}
          </span>
          {isOpReturn ? (
            <span className="font-mono">{opReturnData}</span>
          ) : (
            <span>
              <span className="font-mono">
                <Satoshi value={output.valueSatoshis} />
              </span>
              <span className="mx-1 text-neutral-500">/</span>
              <span className="text-sm opacity-80">
                <Satoshi value={output.valueSatoshis} flip />
              </span>
            </span>
          )}
        </div>
        {token && (
          <span className="flex items-center justify-end">
            <span
              style={{ color: token.color }}
              className="font-mono text-xs tracking-tighter font-bold mr-0.5"
            >
              {token.symbol}
            </span>
            <span className="flex items-baseline gap-x-0.5 text-sm">
              {token.amount > 0 && <TokenAmount token={token} />}
              {token.nftCount > 0 && <TokenAmount token={token} nft />}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}

function InputListItem({ input, i }) {
  const bchNetwork = useSelector(selectBchNetwork);
  const zebraCss =
    i % 2 === 0
      ? "bg-primary-100 dark:bg-primarydark-100 dark:text-neutral-100"
      : "bg-primary-50 dark:bg-primarydark-50 dark:text-neutral-100";

  const [inputTx, setInputTx] = useState<TransactionEntity | null>(null);

  const isCoinbase = !!input.coinbase;
  const coinbaseText = isCoinbase && hexToUtf8(input.coinbase);

  useEffect(
    function resolveInput() {
      const resolve = async () => {
        const resolvedTx = await TransactionManagerService().resolveTransaction(
          input.tx_hash,
          bchNetwork
        );
        setInputTx(resolvedTx);
      };

      // coinbase tx_hash is not a valid tx_hash
      if (!isCoinbase) {
        resolve();
      }
    },
    [input.tx_hash, bchNetwork, isCoinbase]
  );

  const ResolvedInput = useCallback(() => {
    if (inputTx === null) {
      return isCoinbase ? (
        <div className={`p-1.5 ${zebraCss} truncate font-bold font-mono`}>
          &lt;COINBASE&gt; {coinbaseText}
        </div>
      ) : (
        <div className={`p-1.5 ${zebraCss} truncate tracking-tight`}>
          <Link
            className="font-mono text-xs"
            to={`/explore/tx/${input.tx_hash}`}
          >
            {input.tx_hash}:{input.vout}
          </Link>
        </div>
      );
    }

    const output = inputTx.vout.find((out) => out.n === input.vout);

    return (
      <Link to={`/explore/tx/${input.tx_hash}`}>
        <OutputListItem output={output} i={i} />
      </Link>
    );
  }, [
    inputTx,
    input.tx_hash,
    zebraCss,
    i,
    input.vout,
    coinbaseText,
    isCoinbase,
  ]);

  return <ResolvedInput />;
}
