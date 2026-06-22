import { useContext } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  AccountBookOutlined,
  DollarCircleOutlined,
  EuroCircleOutlined,
  TransactionOutlined,
} from "@ant-design/icons";

import {
  selectCurrencySettings,
  selectIsPrerelease,
} from "@/redux/preferences";
import { syncCauldronConnect } from "@/redux/sync";

import Accordion from "@/atoms/Accordion";
import Select from "@/components/atoms/Select";

import { currencyList } from "@/util/currency";
import { VALID_DENOMINATIONS } from "@/util/sats";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function CurrencySettings() {
  const { handleSettingsUpdate } = useContext(SettingsContext);
  const dispatch = useDispatch();

  const {
    shouldPreferLocalCurrency,
    localCurrency,
    denomination,
    isStablecoinMode,
  } = useSelector(selectCurrencySettings);

  const isPrerelease = useSelector(selectIsPrerelease);

  const selectedCurrency = isStablecoinMode ? "USD" : localCurrency || "";

  const handleToggleStablecoinMode = (event) => {
    const isChecked = event.target.checked;
    handleSettingsUpdate("stablecoinMode", event.target.checked);

    if (isChecked) {
      setTimeout(() => dispatch(syncCauldronConnect()), 200);
    }
  };

  return (
    <Accordion
      icon={DollarCircleOutlined}
      title={translate(translations.currencySettings)}
    >
      <Accordion.Child
        icon={EuroCircleOutlined}
        label={translate(translations.localCurrency)}
      >
        <Select
          className="w-fit"
          value={selectedCurrency}
          disabled={isStablecoinMode}
          onChange={(event) =>
            handleSettingsUpdate("localCurrency", event.target.value)
          }
        >
          {currencyList
            .filter(
              (c) =>
                VALID_DENOMINATIONS.find(
                  (d) => d.toLowerCase() === c.currency.toLowerCase()
                ) === undefined
            )
            .map((c) => (
              <option key={c.currency} value={c.currency}>
                {c.currency} {c.symbol}
              </option>
            ))}
        </Select>
      </Accordion.Child>
      <Accordion.Child
        icon={TransactionOutlined}
        label={translate(translations.preferLocalCurrency)}
      >
        <input
          type="checkbox"
          checked={shouldPreferLocalCurrency}
          onChange={(event) =>
            handleSettingsUpdate("preferLocalCurrency", event.target.checked)
          }
        />
      </Accordion.Child>
      <Accordion.Child
        icon={AccountBookOutlined}
        label={translate(translations.denominateInSats)}
      >
        <Select
          className="w-24"
          value={denomination}
          onChange={(event) =>
            handleSettingsUpdate(
              "denomination",
              event.target.value.toLowerCase()
            )
          }
        >
          {VALID_DENOMINATIONS.map((d) => (
            <option key={d} id={d} value={d.toLowerCase()}>
              {d}
            </option>
          ))}
        </Select>
      </Accordion.Child>
      {(isPrerelease || isStablecoinMode) && (
        <Accordion.Child
          icon={DollarCircleOutlined}
          label={translate(translations.enableStablecoinMode)}
          description={translate(translations.stablecoinModeExplanation)}
        >
          <input
            type="checkbox"
            checked={isStablecoinMode}
            onChange={handleToggleStablecoinMode}
          />
        </Accordion.Child>
      )}
    </Accordion>
  );
}
