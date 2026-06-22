import { useCallback } from "react";
import { Clipboard } from "@capacitor/clipboard";
import { SnippetsOutlined } from "@ant-design/icons";

import NotificationService from "@/kernel/app/NotificationService";

import translations from "@/views/wallet/translations";

import { Haptic } from "@/util/haptic";

import { translate } from "@/util/translations";

export function useClipboard() {
  const handleCopyToClipboard = useCallback(
    async (
      string: string,
      header?: string,
      message?: string,
      isPrivate?: boolean
    ) => {
      await Clipboard.write({ string });
      NotificationService().clipboardCopy(
        header,
        message !== undefined ? message : !isPrivate && string
      );
    },
    []
  );

  const getClipboardContents = useCallback(async () => {
    // NOTE: Firefox does not support the Clipboard.read browser API yet!
    // https://developer.mozilla.org/en-US/docs/Web/API/Clipboard#clipboard_availability
    // Error: Reading from clipboard not supported in this browser
    // Firefox users must set "dom.events.asyncClipboard.read" to "true" in about:config
    try {
      const { value: paste } = await Clipboard.read();

      const spawnPasteToast = (displayText?: string) => {
        Haptic.success();
        NotificationService().spawn({
          icon: <SnippetsOutlined className="text-primary text-4xl" />,
          header: translate(translations.pastedFromClipboard),
          body: (
            <span className="flex break-all text-sm">
              {displayText || paste}
            </span>
          ),
        });
      };
      return { paste, spawnPasteToast };
    } catch (e) {
      return { paste: "", spawnPasteToast: () => {} };
    }
  }, []);

  return { getClipboardContents, handleCopyToClipboard };
}
