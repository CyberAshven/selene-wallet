import { useState } from "react";

import Button from "@/atoms/Button";
import Modal from "@/atoms/Modal";
import {
  cancelButtonProps,
  confirmButtonProps,
} from "@/composite/modals/modalButtonStyles";

import common from "@/translations/common";
import { translate } from "@/util/translations";

interface PromptModalProps {
  title?: string;
  message?: string;
  inputType?: "text" | "password";
  inputMode?: "numeric" | "text";
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  pattern?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function PromptModal({
  title = undefined,
  message = undefined,
  inputType = "text",
  inputMode = "text",
  placeholder = undefined,
  submitLabel = translate(common.ok),
  cancelLabel = translate(common.cancel),
  pattern = undefined,
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSubmit(value);
  };

  return (
    <Modal className="max-w-sm mx-4">
      <div className="p-4">
        {title && (
          <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2">
            {title}
          </h2>
        )}

        {message && (
          <p className="text-neutral-800 dark:text-neutral-200 mb-4">
            {message}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <input
            type={inputType}
            autoFocus
            inputMode={inputMode}
            pattern={pattern}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full p-3 mb-4 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 text-center text-xl tracking-widest"
          />

          <div className="flex gap-3">
            <Button
              {...confirmButtonProps}
              fullWidth
              submit
              disabled={!value.trim()}
              label={submitLabel}
            />
            <Button
              {...cancelButtonProps}
              fullWidth
              label={cancelLabel}
              onClick={onCancel}
            />
          </div>
        </form>
      </div>
    </Modal>
  );
}
