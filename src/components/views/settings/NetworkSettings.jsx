import { useContext, useState } from "react";
import { useSelector } from "react-redux";
import {
  ApiOutlined,
  CloudServerOutlined,
  DisconnectOutlined,
  PlusCircleFilled,
} from "@ant-design/icons";

import { selectBchNetwork, selectIsOfflineMode } from "@/redux/preferences";
import {
  selectElectrumServer,
  syncDisconnect,
  syncReconnect,
} from "@/redux/sync";

import ElectrumService from "@/kernel/bch/ElectrumService";

import Accordion from "@/atoms/Accordion";
import Button from "@/atoms/Button";
import Select from "@/components/atoms/Select";

import {
  DEFAULT_ELECTRUM_PORT,
  electrum_servers,
  ElectrumServer,
} from "@/util/network";

import { translate } from "@/util/translations";
import translations from "./translations";

import { SettingsContext } from "./SettingsContext";

export default function NetworkSettings() {
  const { handleSettingsUpdate, preferences, dispatch } =
    useContext(SettingsContext);

  const [shouldShowElectrumServerInput, setShouldShowElectrumServerInput] =
    useState(false);
  const [electrumServerInput, setElectrumServerInput] = useState("");
  const [hasServerInputError, setHasServerInputError] = useState(false);

  const bchNetwork = useSelector(selectBchNetwork);
  const isOfflineMode = useSelector(selectIsOfflineMode);

  const Electrum = ElectrumService(bchNetwork);
  const handleElectrumServerChoice = async (server) => {
    handleSettingsUpdate("electrumServer", server);
    dispatch(syncReconnect(server));
  };

  const handleAddElectrumServer = async (event) => {
    event.preventDefault();

    const serverInput = new ElectrumServer(electrumServerInput).toString();
    try {
      const isSuccess = await Electrum.connect(serverInput, false);
      if (isSuccess) {
        electrum_servers[bchNetwork].unshift(serverInput);
        setShouldShowElectrumServerInput(false);
        setElectrumServerInput("");
        handleElectrumServerChoice(electrum_servers[bchNetwork][0]);
      } else {
        setHasServerInputError(true);
      }
    } catch (e) {
      setHasServerInputError(true);
    }
  };

  const handleSetOfflineMode = async (event) => {
    const { checked } = event.target;

    handleSettingsUpdate("offlineMode", checked);

    if (checked) {
      dispatch(syncDisconnect());
    } else {
      setTimeout(() => {
        dispatch(syncReconnect());
      }, 100);
    }
  };

  const electrumServer = useSelector(selectElectrumServer);
  const currentServer =
    bchNetwork !== "mainnet" || electrumServer !== preferences.electrumServer
      ? electrumServer
      : preferences.electrumServer;

  const serverInputClasses = hasServerInputError
    ? "border border-error text-error"
    : "";

  return (
    <Accordion icon={ApiOutlined} title={translate(translations.network)}>
      <Accordion.Child
        icon={CloudServerOutlined}
        label={translate(translations.translatedElectrumServer)}
      >
        <div className="flex items-center w-3/4">
          <Select
            className="w-full mr-2"
            value={currentServer}
            disabled={isOfflineMode === true}
            onChange={(event) => {
              handleElectrumServerChoice(event.target.value);
            }}
          >
            {electrum_servers[bchNetwork].map((server) => {
              const parts = ElectrumServer.toParts(server);
              return (
                <option key={server} value={server}>
                  {parts.port !== DEFAULT_ELECTRUM_PORT ? server : parts.host}
                </option>
              );
            })}
          </Select>
          {!isOfflineMode && (
            <Button
              icon={PlusCircleFilled}
              iconSize="2xl"
              labelColor="text-neutral-500"
              borderClasses=""
              padding="0"
              onClick={() => setShouldShowElectrumServerInput(true)}
            />
          )}
        </div>
      </Accordion.Child>
      {shouldShowElectrumServerInput && (
        <Accordion.Child
          icon={ApiOutlined}
          label={translate(translations.customServer)}
        >
          <form
            onSubmit={handleAddElectrumServer}
            className="flex items-center w-3/4"
          >
            <input
              className={`p-2 bg-white rounded w-full mr-2 ${serverInputClasses}`}
              type="text"
              value={electrumServerInput}
              onChange={(event) => {
                setHasServerInputError(false);
                setElectrumServerInput(event.target.value);
              }}
            />
            <Button
              submit
              icon={PlusCircleFilled}
              iconSize="2xl"
              labelColor="text-primary-700"
              borderClasses=""
              padding="0"
            />
          </form>
        </Accordion.Child>
      )}

      <Accordion.Child
        icon={DisconnectOutlined}
        label={translate(translations.offlineMode)}
      >
        <input
          type="checkbox"
          checked={isOfflineMode}
          onChange={handleSetOfflineMode}
        />
      </Accordion.Child>
    </Accordion>
  );
}
