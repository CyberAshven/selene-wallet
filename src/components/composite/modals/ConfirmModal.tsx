import { ReactNode } from "react";

import Button from "@/atoms/Button";
import Modal from "@/atoms/Modal";
import {
  cancelButtonProps,
  confirmButtonProps,
  dangerButtonProps,
} from "@/composite/modals/modalButtonStyles";

import common from "@/translations/common";
import { translate } from "@/util/translations";

interface ConfirmModalProps {
  title?: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title = undefined,
  message,
  confirmLabel = translate(common.ok),
  cancelLabel = translate(common.cancel),
  isDanger = false,
  showCancel = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal className="max-w-sm max-h-[60%] mx-4">
      <div className="p-4 flex flex-col min-h-0">
        {title && (
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {title}
          </h2>
        )}

        <div className="text-neutral-800 dark:text-neutral-200 mb-6 whitespace-pre-line break-words overflow-y-auto min-h-0">
          {message}
        </div>

        <div className="flex gap-3">
          <Button
            {...(isDanger ? dangerButtonProps : confirmButtonProps)}
            fullWidth
            label={confirmLabel}
            onClick={onConfirm}
          />
          {showCancel && (
            <Button
              {...cancelButtonProps}
              fullWidth
              label={cancelLabel}
              onClick={onCancel}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
