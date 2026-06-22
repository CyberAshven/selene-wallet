import { useContext } from "react";
import { useSelector } from "react-redux";
import {
  AreaChartOutlined,
  DeliveredProcedureOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from "@ant-design/icons";

import { selectPrivacySettings } from "@/redux/preferences";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";

import Accordion from "@/atoms/Accordion";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function PrivacySettings() {
  const { handleSettingsUpdate } = useContext(SettingsContext);
  const { shouldHideBalance, isDailyCheckInEnabled, shouldResolveBcmr } =
    useSelector(selectPrivacySettings);

  return (
    <Accordion
      icon={EyeInvisibleOutlined}
      title={translate(translations.privacySettings)}
    >
      <Accordion.Child
        icon={shouldHideBalance ? EyeInvisibleOutlined : EyeOutlined}
        label={translate(translations.hideAvailableBalance)}
      >
        <input
          type="checkbox"
          checked={shouldHideBalance}
          onChange={async (event) => {
            const { checked: isChecked } = event.target;
            const isAuthorized =
              shouldHideBalance === false ||
              (await SecurityService().authorize(AuthActions.RevealBalance));

            if (isAuthorized) {
              handleSettingsUpdate("hideAvailableBalance", isChecked);
            }
          }}
        />
      </Accordion.Child>
      <Accordion.Child
        icon={AreaChartOutlined}
        label={translate(translations.sendDailyCheckIn)}
      >
        <input
          type="checkbox"
          checked={isDailyCheckInEnabled}
          onChange={(event) => {
            const { checked: isChecked } = event.target;
            handleSettingsUpdate("enableDailyCheckIn", isChecked);
          }}
        />
      </Accordion.Child>
      <Accordion.Child
        icon={DeliveredProcedureOutlined}
        label={translate(translations.autoResolveBcmr)}
      >
        <input
          type="checkbox"
          checked={shouldResolveBcmr}
          onChange={(event) => {
            const { checked: isChecked } = event.target;
            handleSettingsUpdate("autoResolveBcmr", isChecked);
          }}
        />
      </Accordion.Child>
    </Accordion>
  );
}
