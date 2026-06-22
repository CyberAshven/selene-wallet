import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeftOutlined, SyncOutlined } from "@ant-design/icons";

import {
  selectBchNetwork,
  selectCurrencySettings,
  selectInstantPaySettings,
  selectIsOfflineMode,
} from "@/redux/preferences";
import { selectSyncState } from "@/redux/sync";
import {
  selectActiveWalletBalance,
  selectActiveWalletHash,
} from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import NotificationService from "@/kernel/app/NotificationService";
import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";
import TransactionBuilderService from "@/kernel/bch/TransactionBuilderService";
import TransactionManagerService from "@/kernel/bch/TransactionManagerService";
import TransactionHistoryService from "@/kernel/wallet/TransactionHistoryService";

import translations from "@/views/wallet/translations";
import Button from "@/atoms/Button";
import CurrencyFlip from "@/atoms/CurrencyFlip";
import Satoshi from "@/atoms/Satoshi";
import SlideToAction from "@/atoms/SlideToAction";
import CountdownTimer from "@/components/atoms/CountdownTimer";

import { useCurrencyFlip } from "@/hooks/useCurrencyFlip";

import { Haptic } from "@/util/haptic";
import { JppV2Client, PaymentRequestResponse } from "@/util/payment_protocol";

import { translate } from "@/util/translations";

const Log = LogService("WalletViewPay");
const jppClient = new JppV2Client();

export default function WalletViewPay() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const sync = useSelector(selectSyncState);
  const walletHash = useSelector(selectActiveWalletHash);
  const { spendable_balance } = useSelector(selectActiveWalletBalance);
  const { isInstantPayEnabled, instantPayThreshold } = useSelector(
    selectInstantPaySettings
  );
  const isOfflineMode = useSelector(selectIsOfflineMode);
  const { localCurrency } = useSelector(selectCurrencySettings);
  const bchNetwork = useSelector(selectBchNetwork);

  const [message, setMessage] = useState("");
  const [detailedMessage, setDetailedMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentRequestResponse | null>(
    null
  );
  const [isInstantPayCanceled, setIsInstantPayCanceled] = useState(false);

  // Calculate the total satoshi amount required.
  const calculateTotalSats = () => {
    if (!paymentData) {
      return 0;
    }

    return paymentData.instructions[0].outputs.reduce((total, output) => {
      return total + output.amount;
    }, 0);
  };

  const totalSats = calculateTotalSats();

  // Get the request URL from our query parameters.
  const requestUri = searchParams.get("r");
  if (!requestUri) {
    throw new Error("Invalid or missing request URI");
  }

  const isInsufficientFunds = spendable_balance <= 0;
  const handleFlipCurrency = useCurrencyFlip();

  const handleExpire = () => {
    setMessage(translate(translations.invalidInvoice));
    setDetailedMessage(translate(translations.invoiceExpired));
  };

  const confirmSend = useCallback(
    async (isInstantPay: boolean = false) => {
      // We want to support two different error messages
      // 1. One succinct one for the top bar (always "Transaction Failed").
      // 2. One more detailed one which *may* not have translations (this comes from the thrown error).
      try {
        if (isSending || !paymentData) {
          return;
        }

        setIsSending(true);

        const Security = SecurityService();
        const authAction = isInstantPay
          ? AuthActions.InstantPay
          : AuthActions.SendTransaction;

        const isAuthorized = await Security.authorize(authAction);

        if (!isAuthorized) {
          if (isInstantPay) {
            setIsInstantPayCanceled(true);
          }
          return;
        }

        if (isInsufficientFunds) {
          throw new Error(translate(translations.insufficientFunds));
        }

        if (!sync.isConnected) {
          NotificationService().disconnected();
          throw new Error(translate(translations.unableWhileDisconnected));
        }

        // Format the outputs into correct format for the Transaction Builder.
        // NOTE: This is more to satisfy Typescript as Tx Builder expects BigInt type.
        const outputsFormatted = paymentData.instructions[0].outputs.map(
          (out) => {
            return {
              address: out.address,
              // NOTE: This amount is already in Sats.
              amount: BigInt(out.amount),
            };
          }
        );

        // Build the transaction.
        const TransactionBuilder = TransactionBuilderService(walletHash);
        const transaction = TransactionBuilder.buildP2pkhTransaction({
          recipients: outputsFormatted,
        });

        // Handle wallet out of sync error.
        if (transaction === null) {
          throw new Error("Transaction Failed: Wallet out of sync?");
        }

        // Handle insufficient funds error (indicated by "bigint" type).
        if (typeof transaction === "bigint") {
          throw new Error(translate(translations.insufficientFunds));
        }

        // Respond to the payment URL with the signed transaction.
        const paymentResponse = await jppClient.payment(
          paymentData.paymentUrl,
          {
            chain: "BCH",
            transactions: [{ tx: transaction.tx_hex }],
          }
        );

        // Rebroadcast to guarantee mempool presence. If it succeeds,
        // the payment server failed to broadcast and we saved the user.
        // If Electrum rejects (already in mempool), fall back to
        // register-only — the rejection confirms the tx exists.
        const TransactionManager = TransactionManagerService();
        let tx;
        try {
          tx = await TransactionManager.sendTransaction(
            {
              tx_hash: transaction.tx_hash,
              hex: transaction.tx_hex,
            },
            bchNetwork
          );
        } catch {
          tx = await TransactionManager.registerTransaction({
            tx_hash: transaction.tx_hash,
            hex: transaction.tx_hex,
          });
          TransactionManager.applyOptimisticUtxoUpdate(walletHash, tx);
        }

        // Show a success notification and route the user to the success page.
        await Haptic.success();

        // Update blockhash/height when confirmed
        TransactionManager.resolveTransaction(tx.tx_hash, bchNetwork).catch(
          (e) => Log.warn("resolveTransaction failed", tx.tx_hash, e)
        );

        if (paymentResponse.memo.length > 0) {
          TransactionHistoryService(
            walletHash,
            localCurrency,
            bchNetwork
          ).setTransactionMemo(tx.tx_hash, paymentResponse.memo);
        }
        navigate("/wallet/send/success", {
          state: {
            tx_hash: tx.tx_hash,
            tx,
            prefillMemo: paymentResponse.memo || "",
          },
          replace: true,
        });
      } catch (error) {
        await Haptic.error();
        Log.debug(error);
        setMessage(translate(translations.transactionFailed));
        setDetailedMessage(`${error}`);
      } finally {
        setIsSending(false);
      }
    },
    [
      isInsufficientFunds,
      isSending,
      navigate,
      paymentData,
      sync.isConnected,
      walletHash,
      localCurrency,
      bchNetwork,
    ]
  );

  // Handle instant pay.
  // NOTE: Some of the logic below is to prevent a race-condition whereby a user can land on this page prior to Electrum being connected.
  //       The intent is to allow Selene to be invoked by a "bitcoincash:?r=${url}" URL and "wait" for connection before triggering instant pay.
  useEffect(
    function handleInstantPay() {
      // If instant pay is not enabled, return to prevent further execution.
      if (!isInstantPayEnabled) {
        return;
      }

      if (isInstantPayCanceled) {
        navigate(-1);
        return;
      }

      // If we are already sending, return to prevent further execution.
      if (isSending) {
        return;
      }

      // If we are not yet synced, return to prevent further execution.
      if (!sync.isConnected) {
        return;
      }

      // If the payment data is not yet available, return to prevent further execution.
      if (!paymentData) {
        return;
      }

      // If we are within the instant pay threshold, send the tx.
      if (totalSats > 0 && totalSats <= instantPayThreshold) {
        confirmSend(true);
      }
    },
    [
      isInstantPayEnabled,
      isInstantPayCanceled,
      isSending,
      sync.isConnected,
      paymentData,
      totalSats,
      instantPayThreshold,
      confirmSend,
      navigate,
    ]
  );

  // Fetch the payment request.
  useEffect(
    function handlePaymentRequest() {
      const fetchPaymentRequest = async () => {
        try {
          if (isOfflineMode) {
            NotificationService().disconnected();
            navigate("/");
            return;
          }

          setIsLoading(true);
          setPaymentData(await jppClient.paymentRequest(requestUri));
        } catch (error) {
          setMessage(translate(translations.invalidInvoice));
          setDetailedMessage(`${error}`);
        } finally {
          setIsLoading(false);
        }
      };

      fetchPaymentRequest();
    },
    [requestUri, isOfflineMode, navigate]
  );

  return (
    <div className="flex flex-col justify-start h-full">
      <div className="tracking-wide text-center text-white">
        {message !== "" ? (
          <div className="bg-error p-2">
            <div className="text-xl font-bold">{message}</div>
          </div>
        ) : (
          <div className="bg-primary px-2 py-1">
            <div className="text-lg font-bold">
              {translate(translations.paymentTo)}
            </div>
            <div className="text-sm py-1">
              <span>{new URL(requestUri).hostname}</span>
            </div>
          </div>
        )}
      </div>

      {isLoading || isSending || !paymentData ? (
        <div className="mb-32 flex items-center justify-center w-full h-full text-center">
          <SyncOutlined className="text-7xl" spin />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="w-full text-center text-neutral-700 p-2 my-2">
            Expires in&nbsp;
            <CountdownTimer
              expiryDate={paymentData.expires}
              onExpire={handleExpire}
            />
          </div>
          <div className="flex flex-col mx-2 justify-center">
            <div className="h-full bg-primary/80 text-neutral-900 rounded-md p-4">
              {!message ? (
                <>
                  <div className="p-2 bg-neutral-100 rounded-md mb-3 text-center font-semibold">
                    {paymentData.memo}
                  </div>
                  <div
                    className="p-4 text-center bg-neutral-100 rounded-md cursor-pointer"
                    onClick={handleFlipCurrency}
                  >
                    <div className="font-semibold text-xl mb-1 text-neutral-900">
                      <Satoshi value={totalSats} />
                    </div>
                    <div className="text-lg flex items-center justify-center gap-x-2 text-neutral-800">
                      <Satoshi value={totalSats} flip />
                      <CurrencyFlip className="text-xl" />
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4 px-2">
                  <div className="flex items-center justify-center">
                    {detailedMessage || message}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col justify-end shrink my-6">
        <div className="flex w-full justify-around items-center px-2 gap-x-2">
          <div className="mx-2">
            <Button
              icon={ArrowLeftOutlined}
              iconSize="lg"
              label={translate(translations.back)}
              onClick={() => navigate(-1)}
            />
          </div>
          <div className="flex-1">
            <span className="font-bold">
              <SlideToAction
                label={translate(translations.slideToConfirm)}
                onSlide={() => confirmSend(false)}
                disabled={!!message || !paymentData}
              />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
