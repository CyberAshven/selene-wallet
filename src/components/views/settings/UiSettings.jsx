import { useContext } from "react";
import { useSelector } from "react-redux";
import {
  CompassOutlined,
  ControlOutlined,
  MobileOutlined,
  StockOutlined,
  SunFilled,
  SyncOutlined,
} from "@ant-design/icons";

import { selectDevicePlatform } from "@/redux/device";
import { selectUiSettings, ThemeMode } from "@/redux/preferences";

import Accordion from "@/atoms/Accordion";
import Select from "@/components/atoms/Select";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function UiSettings() {
  const { handleSettingsUpdate } = useContext(SettingsContext);
  const {
    shouldDisplayExploreTab,
    shouldDisplayExchangeRate,
    shouldDisplaySyncCounter,
    shouldConstrainViewport,
    themeMode,
  } = useSelector(selectUiSettings);

  const platform = useSelector(selectDevicePlatform);

  return (
    <Accordion
      icon={ControlOutlined}
      title={translate(translations.uiSettings)}
    >
      <Accordion.Child
        icon={SunFilled}
        label={translate(translations.themeMode)}
      >
        <Select
          onChange={(e) => handleSettingsUpdate("themeMode", e.target.value)}
          value={themeMode}
        >
          <option value={ThemeMode.System}>
            {translate(translations.themeModeSystem)}
          </option>
          <option value={ThemeMode.Light}>
            {translate(translations.themeModeLight)}
          </option>
          <option value={ThemeMode.Dark}>
            {translate(translations.themeModeDark)}
          </option>
        </Select>
      </Accordion.Child>
      <Accordion.Child
        icon={StockOutlined}
        label={translate(translations.displayExchangeRate)}
      >
        <input
          type="checkbox"
          checked={shouldDisplayExchangeRate}
          onChange={(event) =>
            handleSettingsUpdate("displayExchangeRate", event.target.checked)
          }
        />
      </Accordion.Child>
      <Accordion.Child
        icon={CompassOutlined}
        label={translate(translations.displayExploreTab)}
      >
        <input
          type="checkbox"
          checked={shouldDisplayExploreTab}
          onChange={(event) =>
            handleSettingsUpdate("displayExploreTab", event.target.checked)
          }
        />
      </Accordion.Child>

      <Accordion.Child
        icon={SyncOutlined}
        label={translate(translations.displaySyncCounter)}
      >
        <input
          type="checkbox"
          checked={shouldDisplaySyncCounter}
          onChange={(event) =>
            handleSettingsUpdate("displaySyncCounter", event.target.checked)
          }
        />
      </Accordion.Child>

      {platform === "web" &&
        document.querySelector("html").clientWidth > 480 && (
          <Accordion.Child
            icon={MobileOutlined}
            label={translate(translations.constrainViewport)}
          >
            <input
              type="checkbox"
              checked={shouldConstrainViewport}
              onChange={(event) =>
                handleSettingsUpdate(
                  "shouldConstrainViewport",
                  event.target.checked
                )
              }
            />
          </Accordion.Child>
        )}
    </Accordion>
  );
}
