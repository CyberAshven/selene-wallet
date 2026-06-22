import { useContext, useState } from "react";
import { useSelector } from "react-redux";
import {
  AlertOutlined,
  PropertySafetyOutlined,
  QrcodeOutlined,
  SendOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

import {
  selectCurrencySettings,
  selectInstantPaySettings,
  selectIsExperimental,
  selectShouldForceTokenAddress,
  selectShouldUseLegacyBip21,
} from "@/redux/preferences";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";
import CurrencyService from "@/kernel/bch/CurrencyService";

import Accordion from "@/atoms/Accordion";
import Checkbox from "@/atoms/Checkbox";
import CurrencySymbol from "@/atoms/CurrencySymbol";
import { SatoshiInput } from "@/atoms/SatoshiInput";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function PaymentSettings() {
  const { handleSettingsUpdate } = useContext(SettingsContext);
  const { isInstantPayEnabled, instantPayThreshold } = useSelector(
    selectInstantPaySettings
  );
  const { localCurrency, shouldPreferLocalCurrency } = useSelector(
    selectCurrencySettings
  );

  const isExperimental = useSelector(selectIsExperimental);

  const shouldForceTokenAddress = useSelector(selectShouldForceTokenAddress);
  const shouldUseLegacyBip21 = useSelector(selectShouldUseLegacyBip21);

  const Currency = CurrencyService(localCurrency);

  const [instantPaySatInput, setInstantPaySatInput] =
    useState(instantPayThreshold);

  const handleInstantPayInput = (satInput) => {
    const instantPaySettingsKey = shouldPreferLocalCurrency
      ? "instantPayThresholdFiat"
      : "instantPayThreshold";

    const instantPaySettingsValue = shouldPreferLocalCurrency
      ? Currency.satsToFiat(satInput)
      : satInput;

    setInstantPaySatInput(satInput);
    handleSettingsUpdate(instantPaySettingsKey, instantPaySettingsValue);
  };

  return (
    <Accordion
      icon={SendOutlined}
      title={translate(translations.paymentSettings)}
    >
      <Accordion.Child
        icon={ThunderboltOutlined}
        label={translate(translations.allowInstantPay)}
      >
        <Checkbox
          checked={isInstantPayEnabled}
          onChange={async (event) => {
            const { checked: isChecked } = event.target;
            const Security = SecurityService();
            const isAuthorized =
              isInstantPayEnabled === true ||
              (await Security.authorize(AuthActions.InstantPay)) ||
              (await Security.authorize(AuthActions.SendTransaction));

            if (isAuthorized) {
              handleSettingsUpdate("allowInstantPay", isChecked);
            }
          }}
        />
      </Accordion.Child>
      <Accordion.Child
        icon={PropertySafetyOutlined}
        label={translate(translations.instantPayLimit)}
        description={translate(translations.instantPayExplanation)}
      >
        <span className="text-neutral-600 flex items-center dark:text-neutral-300">
          <CurrencySymbol className="font-bold text-lg mr-1" />
          <SatoshiInput
            satoshis={instantPaySatInput}
            className="p-2 w-28 rounded flex-1 dark:bg-neutral-900 dark:text-neutral-100 dark:border-primarydark-400 border border-primary"
            onChange={handleInstantPayInput}
          />
        </span>
      </Accordion.Child>
      <Accordion.Child
        icon={QrcodeOutlined}
        label={translate(translations.useLegacyBip21)}
        description={translate(translations.useLegacyBip21Description)}
      >
        <Checkbox
          checked={shouldUseLegacyBip21}
          onChange={(event) => {
            handleSettingsUpdate("useLegacyBip21", event.target.checked);
          }}
        />
      </Accordion.Child>
      {isExperimental && (
        <Accordion.Child
          icon={AlertOutlined}
          label={translate(translations.allowTokensToNonTokenAddresses)}
        >
          <Checkbox
            checked={shouldForceTokenAddress}
            onChange={(event) => {
              handleSettingsUpdate("forceTokenAddress", event.target.checked);
            }}
          />
        </Accordion.Child>
      )}
    </Accordion>
  );
}
