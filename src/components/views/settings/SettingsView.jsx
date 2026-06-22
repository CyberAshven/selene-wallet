import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { SettingOutlined } from "@ant-design/icons";

import {
  selectActiveWalletHash,
  selectPreferences,
  setPreference,
} from "@/redux/preferences";

import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";
import Button from "@/atoms/Button";
import KeyWarning from "@/atoms/KeyWarning/KeyWarning";
import SeleneLogo from "@/atoms/SeleneLogo";

import { SELENE_WALLET_VERSION } from "@/util/version";

import { translate } from "@/util/translations";
import translations from "./translations";

import CurrencySettings from "./CurrencySettings";
import IntlSettings from "./IntlSettings";
import NetworkSettings from "./NetworkSettings";
import PaymentSettings from "./PaymentSettings";
import PrivacySettings from "./PrivacySettings";
import QrCodeSettings from "./QrCodeSettings";
import SecuritySettings from "./SecuritySettings";
import { SettingsContext } from "./SettingsContext";
import UiSettings from "./UiSettings";
import WalletSettings from "./WalletSettings";

export default function SettingsView() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const preferences = useSelector(selectPreferences);

  const handleSettingsUpdate = useCallback(
    (key, value) => {
      dispatch(setPreference({ key, value }));
    },
    [dispatch]
  );

  const settingsContext = useMemo(
    () => ({
      handleSettingsUpdate,
      preferences,
      dispatch,
    }),
    [dispatch, preferences, handleSettingsUpdate]
  );

  const activeWalletHash = useSelector(selectActiveWalletHash);

  return (
    <FullColumn>
      <ViewHeader
        icon={SettingOutlined}
        title={translate(translations.settings)}
      />
      <div data-testid="settings-view" className="p-1">
        <SettingsContext.Provider value={settingsContext}>
          <KeyWarning walletHash={activeWalletHash} />
          <WalletSettings />
          <SecuritySettings />
          <CurrencySettings />
          <PaymentSettings />
          <QrCodeSettings />
          <UiSettings />
          <NetworkSettings />
          <PrivacySettings />
          <IntlSettings />
        </SettingsContext.Provider>
      </div>
      <div className="flex gap-x-2 justify-center items-center p-1 pb-4 mx-1">
        <Button
          onClick={() => navigate("/credits")}
          label={
            <span className="font-semibold">
              Selene Wallet v{SELENE_WALLET_VERSION}
            </span>
          }
          icon={SeleneLogo}
          iconClasses="w-[44px] h-[44px]"
          padding="1"
          inverted
          fullWidth
        />
      </div>
    </FullColumn>
  );
}
