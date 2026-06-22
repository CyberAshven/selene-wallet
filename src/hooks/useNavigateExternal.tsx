import { useSelector } from "react-redux";
import { Browser } from "@capacitor/browser";

import { selectDevicePlatform } from "@/redux/device";

import ModalService from "@/kernel/app/ModalService";

import translations from "@/views/settings/translations";

import { translate } from "@/util/translations";

export function useNavigateExternal() {
  const platform = useSelector(selectDevicePlatform);

  return async (to: string) => {
    const shouldProceed = await ModalService().showConfirm({
      title: translate(translations.externalLinkTitle),
      message: `${translate(translations.externalLinkMessage)}\n\n${to}`,
    });

    if (!shouldProceed) {
      return;
    }

    if (platform === "web") {
      window.open(to);
    } else {
      await Browser.open({ url: to });
    }
  };
}
