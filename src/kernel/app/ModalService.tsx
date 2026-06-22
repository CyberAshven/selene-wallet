import { ReactNode, useCallback, useEffect, useState } from "react";

import ConfirmModal from "@/composite/modals/ConfirmModal";
import PromptModal from "@/composite/modals/PromptModal";

// --------------------------------
// Types

interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  showCancel?: boolean;
}

interface PromptOptions {
  title?: string;
  message?: string;
  inputType?: "text" | "password";
  inputMode?: "numeric" | "text";
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  pattern?: string;
}

type ModalEntry =
  | { type: "confirm"; options: ConfirmOptions; resolve: (v: boolean) => void }
  | {
      type: "prompt";
      options: PromptOptions;
      resolve: (v: string | null) => void;
    };

// --------------------------------
// Module-level ref to the provider's push function

let pushModal: ((entry: ModalEntry) => void) | null = null;

// --------------------------------
// Service API — callable from anywhere

export default function ModalService() {
  return {
    showConfirm(options: ConfirmOptions): Promise<boolean> {
      if (!pushModal) {
        throw new Error("ModalProvider not mounted");
      }
      return new Promise((resolve) => {
        pushModal({ type: "confirm", options, resolve });
      });
    },

    showPrompt(options: PromptOptions): Promise<string | null> {
      if (!pushModal) {
        throw new Error("ModalProvider not mounted");
      }
      return new Promise((resolve) => {
        pushModal({ type: "prompt", options, resolve });
      });
    },
  };
}

// --------------------------------
// React provider — mount once at app root

export function ModalProvider() {
  const [modals, setModals] = useState<ModalEntry[]>([]);

  const push = useCallback(function push(entry: ModalEntry) {
    setModals((prev) => [...prev, entry]);
  }, []);

  const dismiss = useCallback(function dismiss() {
    setModals((prev) => prev.slice(1));
  }, []);

  // Register/cleanup module-level ref
  useEffect(
    function registerPush() {
      pushModal = push;
      return () => {
        pushModal = null;
      };
    },
    [push]
  );

  // FIFO: first pushed = first shown, dismiss reveals next in queue
  const current = modals.length > 0 ? modals[0] : null;

  if (!current) return null;

  switch (current.type) {
    case "confirm":
      return (
        <ConfirmModal
          {...current.options}
          onConfirm={() => {
            dismiss();
            current.resolve(true);
          }}
          onCancel={() => {
            dismiss();
            current.resolve(false);
          }}
        />
      );

    case "prompt":
      return (
        <PromptModal
          {...current.options}
          onSubmit={(value) => {
            dismiss();
            current.resolve(value);
          }}
          onCancel={() => {
            dismiss();
            current.resolve(null);
          }}
        />
      );

    default:
      return null;
  }
}
