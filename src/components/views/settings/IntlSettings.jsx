import { useContext } from "react";
import { FlagOutlined, GlobalOutlined } from "@ant-design/icons";

import Accordion from "@/atoms/Accordion";
import Select from "@/components/atoms/Select";

import { sameAsDevice } from "@/translations/common";
import { languageList, translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function IntlSettings() {
  const { handleSettingsUpdate, preferences } = useContext(SettingsContext);
  return (
    <Accordion
      icon={GlobalOutlined}
      title={translate(translations.localizationSettings)}
    >
      <Accordion.Child
        icon={FlagOutlined}
        label={translate(translations.language)}
      >
        <Select
          className="w-48 w-2/3"
          value={preferences.languageCode || ""}
          onChange={(event) => {
            handleSettingsUpdate("languageCode", event.target.value);
          }}
        >
          {languageList.map(({ flag, code, name }) => (
            <option key={code} value={code}>
              {code
                ? `${flag} ${code.toUpperCase()} - ${name}`
                : translate(sameAsDevice)}
            </option>
          ))}
        </Select>
      </Accordion.Child>
    </Accordion>
  );
}
