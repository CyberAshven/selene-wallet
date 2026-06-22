import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  SnippetsFilled,
} from "@ant-design/icons";

import translations from "@/views/wallet/translations";
import LoadingToast from "@/composite/toasts/LoadingToast";
import PaymentReceivedToast from "@/composite/toasts/PaymentReceivedToast";
import ToastCard from "@/composite/toasts/ToastCard";
import TokenReceivedToast from "@/composite/toasts/TokenReceivedToast";

import { Haptic } from "@/util/haptic";

import { translate } from "@/util/translations";

// --------------------------------
// Types

interface ToastEntry {
  id: string;
  content: (onDismiss: () => void) => ReactNode;
  duration: number;
}

interface ToastState extends ToastEntry {
  isDismissing: boolean;
}

const FADE_OUT_MS = 300;

// --------------------------------
// Module-level refs to the provider's push/dismiss functions

let pushToast: ((entry: ToastEntry) => void) | null = null;
let dismissToast: ((id: string) => void) | null = null;

let nextId = 0;
function generateId(): string {
  nextId += 1;
  return `toast-${nextId}`;
}

// --------------------------------
// Service API — callable from anywhere

export default function NotificationService() {
  return {
    spawn,
    error,
    success,
    loading,
    paymentReceived,
    tokenReceived,
    clipboardCopy,
    disconnected,
    authFail,
    invalidScan,
    expiredPayment,
  };

  // ----------------
  // Generic methods

  function spawn({
    icon = <InfoCircleOutlined className="text-4xl text-primary" />,
    header,
    body,
    variant = "default",
    id,
    duration = 3000,
  }: {
    icon?: ReactNode;
    header: ReactNode;
    body?: ReactNode;
    variant?: "default" | "success" | "error";
    id?: string;
    duration?: number;
  }) {
    push({
      id: id ?? generateId(),
      duration,
      content: (onDismiss) => (
        <ToastCard
          icon={icon}
          header={header}
          body={body}
          variant={variant}
          onDismiss={onDismiss}
        />
      ),
    });
  }

  function error(
    header: string,
    body?: ReactNode,
    options?: { id?: string; duration?: number }
  ) {
    Haptic.error();
    spawn({
      icon: <CloseCircleOutlined className="text-4xl text-error" />,
      header,
      body,
      variant: "error",
      ...options,
    });
  }

  function success(
    header: string,
    body?: ReactNode,
    options?: { id?: string; duration?: number }
  ) {
    Haptic.success();
    spawn({
      icon: <CheckCircleOutlined className="text-4xl text-primary" />,
      header,
      body,
      variant: "success",
      ...options,
    });
  }

  function loading(message: string): () => void {
    const id = generateId();
    push({
      id,
      duration: Infinity,
      content: (onDismiss) => (
        <LoadingToast message={message} onDismiss={onDismiss} />
      ),
    });
    return () => dismiss(id);
  }

  // ----------------
  // Domain methods

  function paymentReceived(amount: bigint, token?: { category: string }) {
    const id = generateId();
    push({
      id,
      duration: 3000,
      content: (onDismiss) => (
        <PaymentReceivedToast
          amount={amount}
          token={token}
          onDismiss={onDismiss}
        />
      ),
    });
  }

  function tokenReceived(
    token: {
      category: string;
      symbol: string;
      nft_commitment?: string;
      amount?: bigint;
    },
    isNft = false,
    nftName?: string,
    nftDescription?: string
  ) {
    const id = generateId();
    push({
      id,
      duration: 3000,
      content: (onDismiss) => (
        <TokenReceivedToast
          token={token}
          isNft={isNft}
          nftName={nftName}
          nftDescription={nftDescription}
          onDismiss={onDismiss}
        />
      ),
    });
  }

  function clipboardCopy(header: string, payload: ReactNode) {
    spawn({
      icon: <SnippetsFilled className="text-4xl text-primary" />,
      header,
      body: <span className="flex text-sm break-all">{payload}</span>,
      id: "clipboardCopy",
      duration: 2400,
    });
  }

  function disconnected() {
    error(
      translate(translations.notConnected),
      translate(translations.unableWhileDisconnected),
      {
        id: "disconnected",
      }
    );
  }

  function authFail(actionText: string) {
    error(
      translate(translations.authFail),
      <span>
        {actionText ? `"${actionText}"` : ""}{" "}
        {translate(translations.notApproved)}
      </span>
    );
  }

  function invalidScan(content: string) {
    error(
      translate(translations.invalidQrCode),
      <span className="flex flex-col text-sm break-all">
        <span className="mb-1">{translate(translations.invalidQrMessage)}</span>
        <span className="font-mono opacity-60 italic">{content}</span>
      </span>,
      { id: "invalidScan", duration: 3000 }
    );
  }

  function expiredPayment() {
    error(translate(translations.paymentExpired), undefined, {
      id: "expiredPayment",
      duration: 3000,
    });
  }
}

// --------------------------------
// Internal push/dismiss helpers

function push(entry: ToastEntry) {
  if (!pushToast) {
    throw new Error("NotificationProvider not mounted");
  }
  pushToast(entry);
}

function dismiss(id: string) {
  if (dismissToast) {
    dismissToast(id);
  }
}

// --------------------------------
// React provider — mount once at app root

export function NotificationProvider() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  // Remove a toast from state (final cleanup after fade-out)
  const remove = useCallback(function remove(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Begin fade-out, then remove after transition
  const handleDismiss = useCallback(
    function handleDismiss(id: string) {
      // Clear any pending auto-dismiss timer
      const timer = timersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timersRef.current.delete(id);
      }

      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isDismissing: true } : t))
      );
      setTimeout(() => remove(id), FADE_OUT_MS);
    },
    [remove]
  );

  const handlePush = useCallback(
    function handlePush(entry: ToastEntry) {
      setToasts((prev) => {
        // Dedup: replace existing toast with same ID
        const filtered = prev.filter((t) => t.id !== entry.id);
        return [...filtered, { ...entry, isDismissing: false }];
      });

      // Clear existing timer for this ID
      const existing = timersRef.current.get(entry.id);
      if (existing) {
        clearTimeout(existing);
      }

      // Set auto-dismiss timer
      if (entry.duration !== Infinity) {
        const timer = setTimeout(() => {
          handleDismiss(entry.id);
        }, entry.duration);
        timersRef.current.set(entry.id, timer);
      }
    },
    [handleDismiss]
  );

  // Register/cleanup module-level refs
  useEffect(
    function registerRefs() {
      pushToast = handlePush;
      dismissToast = handleDismiss;
      return () => {
        pushToast = null;
        dismissToast = null;
      };
    },
    [handlePush, handleDismiss]
  );

  // Cleanup timers on unmount
  useEffect(function cleanupTimers() {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  // #root fallback: pre-auth screens where #container isn't mounted
  const rootNode =
    document.querySelector("#container") ?? document.querySelector("#root")!;

  return createPortal(
    <div className="absolute top-0 left-0 right-0 z-[60] flex flex-col items-center gap-2 p-4 pointer-events-none">
      {toasts.map((entry) => (
        <div
          key={entry.id}
          className="w-full max-w-md pointer-events-auto transition-opacity duration-300 transform-gpu"
          style={{ opacity: entry.isDismissing ? 0 : 1 }}
        >
          {entry.content(() => handleDismiss(entry.id))}
        </div>
      ))}
    </div>,
    rootNode
  );
}
