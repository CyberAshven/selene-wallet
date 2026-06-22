import { useContext } from "react";
import {
  BgColorsOutlined,
  BorderOuterOutlined,
  FormatPainterOutlined,
  QrcodeOutlined,
  SettingFilled,
  UndoOutlined,
} from "@ant-design/icons";

import Accordion from "@/atoms/Accordion";
import Button from "@/atoms/Button";
import Select from "@/components/atoms/Select";

import { logos } from "@/util/logos";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function QrCodeSettings() {
  const { handleSettingsUpdate, preferences } = useContext(SettingsContext);

  const logoKey = preferences.qrCodeLogo.toLowerCase();

  const handleResetQrColors = () => {
    handleSettingsUpdate("qrCodeLogo", "selene");
    handleSettingsUpdate("qrCodeForeground", "#000000");
    handleSettingsUpdate("qrCodeBackground", "#ffffff");
  };

  return (
    <Accordion
      icon={QrcodeOutlined}
      title={translate(translations.qrCodeSettings)}
    >
      <Accordion.Child
        icon={BorderOuterOutlined}
        label={translate(translations.logo)}
      >
        <div className="flex items-center">
          {logoKey !== "none" && (
            <img src={logos[logoKey].img} className="w-8 h-8 mx-2" alt="" />
          )}
          <Select
            className="w-24 flex-1"
            value={preferences.qrCodeLogo || ""}
            onChange={(event) =>
              handleSettingsUpdate("qrCodeLogo", event.target.value)
            }
          >
            {Object.keys(logos).map((l) => (
              <option key={l} value={l}>
                {logos[l].name}
              </option>
            ))}
          </Select>
        </div>
      </Accordion.Child>
      <Accordion.Child
        icon={FormatPainterOutlined}
        label={translate(translations.foregroundColor)}
      >
        <div className="flex items-center w-1/2">
          <SettingFilled
            className="text-3xl px-2"
            style={{ color: preferences.qrCodeForeground }}
          />
          <input
            type="color"
            className="rounded h-10 w-24 m-0 p-2 w-full dark:bg-neutral-1000 bg-primary-100"
            value={preferences.qrCodeForeground || ""}
            onChange={(event) =>
              handleSettingsUpdate("qrCodeForeground", event.target.value)
            }
          />
        </div>
      </Accordion.Child>
      <Accordion.Child
        icon={BgColorsOutlined}
        label={translate(translations.backgroundColor)}
      >
        <div className="flex items-center w-1/2">
          <SettingFilled
            className="text-3xl px-2"
            style={{ color: preferences.qrCodeBackground }}
          />
          <input
            type="color"
            className="rounded h-10 w-24 m-0 p-2 w-full dark:bg-neutral-1000 bg-primary-100"
            value={preferences.qrCodeBackground || ""}
            onChange={(event) =>
              handleSettingsUpdate("qrCodeBackground", event.target.value)
            }
          />
        </div>
      </Accordion.Child>
      <Accordion.Child>
        <Button
          onClick={handleResetQrColors}
          icon={UndoOutlined}
          label={translate(translations.resetColors)}
        />
      </Accordion.Child>
    </Accordion>
  );
}
