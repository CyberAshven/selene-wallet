import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useRouteError } from "react-router";
import { BugOutlined } from "@ant-design/icons";

import { resetPreferences } from "@/redux/preferences";
import { selectActiveWallet } from "@/redux/wallet";

import ConsoleService from "@/kernel/app/ConsoleService";
import JanitorService from "@/kernel/app/JanitorService";
import LogService from "@/kernel/app/LogService";
import ModalService from "@/kernel/app/ModalService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import Accordion from "@/components/atoms/Accordion";
import Button from "@/components/atoms/Button";
import SeleneLogo from "@/components/atoms/SeleneLogo";
import ShowMnemonic from "@/components/atoms/ShowMnemonic";

import { translate } from "@/util/translations";

import translations from "./ErrorBoundaryTranslations";

const Log = LogService("ErrorBoundary");

function restartApp() {
  window.location.assign("/");
}

interface StartupErrorBoundaryProps {
  error: Error | null;
}

interface ErrorBoundaryProps {
  startupError?: Error | null;
}

// Startup error mode: minimal context (no Router, no Redux)
function StartupErrorBoundary({ error }: StartupErrorBoundaryProps) {
  const handleNuclearWipe = async () => {
    const isConfirmed = await ModalService().showConfirm({
      title: translate(translations.resetAll),
      message: translate(translations.nuclearWipeConfirm),
      isDanger: true,
    });
    if (!isConfirmed) {
      return;
    }

    await JanitorService().nuclearWipe();
    restartApp();
  };

  const handleExportLogs = () => ConsoleService().exportLogs();

  return (
    <>
      <div className="text-2xl p-1 bg-neutral-900 text-neutral-300 font-bold flex items-center">
        <span>
          <SeleneLogo className="h-14 mr-2" />
        </span>
        <span className="flex-1">{translate(translations.somethingWrong)}</span>
      </div>
      <div className="p-2">
        <div className="bg-neutral-200 p-2 rounded my-1">
          <div className="text-xl font-bold mb-2">
            {translate(translations.hereCanTry)}:
          </div>
          <div className="flex items-center gap-x-1 flex-wrap">
            <Button
              className="bg-primary rounded text-white p-1 flex-1"
              onClick={restartApp}
              label={translate(translations.restartApp)}
            />
            <Button
              className="bg-red-600 rounded text-white p-1 flex-1"
              onClick={handleNuclearWipe}
              label={translate(translations.resetAll)}
            />
            <Button
              className="bg-primary rounded text-white p-1"
              onClick={handleExportLogs}
              label={translate(translations.exportLogs)}
            />
          </div>
        </div>
        <Accordion
          icon={BugOutlined}
          title={translate(translations.errorMessage)}
        >
          <Accordion.Child icon={null} label="">
            <div className="font-mono p-2 w-full">{error?.message}</div>
          </Accordion.Child>
        </Accordion>
      </div>
    </>
  );
}

// Route error mode: full Redux/Router available
function RouteErrorBoundary() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const error = useRouteError();
  Log.error(String(error));

  const wallet = useSelector(selectActiveWallet);

  const handleRebuildWallet = async () => {
    await WalletManagerService().clearWalletData(wallet.walletHash);

    navigate(`/settings/wallet/wizard/import/build/${wallet.walletHash}`);
  };

  const handleResetPreferences = () => {
    dispatch(resetPreferences());
  };

  const handleSendDiagnosticInfo = () => ConsoleService().exportLogs();

  return (
    <>
      <div className="text-2xl p-1 bg-neutral-900 text-neutral-300 font-bold flex items-center">
        <span>
          <SeleneLogo className="h-14 mr-2" />
        </span>
        <span className="flex-1">{translate(translations.somethingWrong)}</span>
      </div>
      <div className="p-2">
        <div className="bg-neutral-200 p-2 rounded my-1">
          <div className="text-xl font-bold mb-2">
            {translate(translations.hereCanTry)}:
          </div>
          <div className="flex items-center gap-x-1">
            <Button
              className="bg-primary rounded text-white p-1 flex-1"
              onClick={restartApp}
              label={translate(translations.restartApp)}
            />
            <Button
              className="bg-primary rounded text-white p-1 flex-1"
              onClick={handleResetPreferences}
              label={translate(translations.resetSettings)}
            />
            <Button
              className="bg-primary rounded text-white p-1 flex-1"
              onClick={handleRebuildWallet}
              label={translate(translations.rebuildWallet)}
            />
            <Button
              className="bg-primary rounded text-white p-1"
              onClick={handleSendDiagnosticInfo}
              label={translate(translations.exportLogs)}
            />
          </div>
        </div>
        <Accordion
          icon={BugOutlined}
          title={translate(translations.errorMessage)}
        >
          <Accordion.Child icon={null} label="">
            <div className="font-mono p-2 w-full">{String(error)}</div>
            {/*<div className="font-mono">{error.stack}</div>*/}
          </Accordion.Child>
        </Accordion>
        <ShowMnemonic walletHash={wallet.walletHash} />
      </div>
    </>
  );
}

// ErrorBoundary: two modes based on context
// - startupError prop: startup mode (no Redux/Router)
// - no prop: route error mode (full Redux/Router)
export default function ErrorBoundary({
  startupError,
}: ErrorBoundaryProps = {}) {
  if (startupError) {
    return <StartupErrorBoundary error={startupError} />;
  }

  return <RouteErrorBoundary />;
}
