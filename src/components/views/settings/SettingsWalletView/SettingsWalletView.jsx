import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  ExportOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  LoginOutlined,
  MedicineBoxOutlined,
  SyncOutlined,
  ToolOutlined,
  WalletOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { WalletConnectFilled } from "@/icons/WalletConnectFilled";

import { selectLocale } from "@/redux/device";
import { selectIsExperimental } from "@/redux/preferences";
import {
  selectActiveWalletHash,
  walletBoot,
  walletSetName,
} from "@/redux/wallet";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import WalletSettings from "@/views/settings/WalletSettings";
import ViewHeader from "@/layout/ViewHeader";
import Accordion from "@/atoms/Accordion";
import Button from "@/atoms/Button";
import Card from "@/atoms/Card";
import Editable from "@/atoms/Editable";
import KeyWarning from "@/atoms/KeyWarning/KeyWarning";
import Satoshi from "@/atoms/Satoshi";
import ShowMnemonic from "@/atoms/ShowMnemonic";

import { translate } from "@/util/translations";
import translations from "./translations";

export default function SettingsWalletView() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { walletHash } = useParams();

  const WalletManager = WalletManagerService();
  const [wallet, setWallet] = useState(WalletManager.getWalletMeta(walletHash));

  useEffect(
    function reloadWalletMeta() {
      setWallet(WalletManagerService().getWalletMeta(walletHash));
    },
    [walletHash]
  );

  const activeWalletHash = useSelector(selectActiveWalletHash);
  const isActiveWallet = wallet.walletHash === activeWalletHash;

  const locale = useSelector(selectLocale);

  const shouldShowAdvancedOptions =
    wallet.key_viewed_at !== null && isActiveWallet;

  const isExperimental = useSelector(selectIsExperimental);

  const [isActivating, setIsActivating] = useState(false);

  // user must tap "delete wallet" button multiple times to confirm
  const [deleteConfirm, setDeleteConfirm] = useState(0);
  const deleteRef = useRef(setTimeout(() => {}, 0));
  const isDeleteDisabled = deleteConfirm === 2 && wallet.key_viewed_at === null;

  // handler for "Delete Wallet" button
  const handleDeleteWallet = async () => {
    setDeleteConfirm((deleteConfirm + 1) % 4);

    // on 4th press, delete wallet and "reboot" app
    if (deleteConfirm === 3) {
      const isAuthorized = await SecurityService().authorize();
      if (!isAuthorized) {
        return;
      }

      await WalletManager.deleteWallet(wallet.walletHash);
      dispatch(walletBoot({ walletHash: "" })).then(() => navigate("/"));
    } else {
      // if user hesitates, reset the counter
      clearTimeout(deleteRef.current);
      deleteRef.current = setTimeout(
        () => {
          setDeleteConfirm(0);
        },
        3250 + deleteConfirm * 600
      ); // give them time to read the prompts though
    }
  };

  // handler for "Activate Wallet" button
  const handleActivateWallet = async () => {
    const isAuthorized = await SecurityService().authorize(
      AuthActions.WalletActivate
    );

    if (!isAuthorized) {
      return;
    }

    setIsActivating(true);

    dispatch(walletBoot({ walletHash: wallet.walletHash })).then(async () => {
      navigate("/");
    });
  };

  // handler for wallet name edit button
  const handleEditConfirm = async (input) => {
    await WalletManager.setWalletName(wallet.walletHash, input);

    if (wallet.walletHash === activeWalletHash) {
      dispatch(walletSetName(input));
    }

    setWallet(WalletManager.getWalletMeta(wallet.walletHash));
  };

  // handler for "rebuild wallet" button
  const handleRebuildWallet = () => {
    navigate(`/settings/wallet/wizard/import/build/${wallet.walletHash}`);
  };

  const handleExportWallet = async () => {
    const { uri } = await Filesystem.getUri({
      path: `/selene/wallets/${wallet.walletHash}.wallet.json`,
      directory: Directory.Library,
    });

    await Share.share({
      dialogTitle: `Export Wallet (${wallet.name})`,
      url: uri,
    });
  };

  /*
   const handleImportWallet = () => {
    // spawn file picker
  };
  */

  const activateButtonIcon = useCallback(() => {
    let Icon;
    if (isActivating) {
      Icon = LoadingOutlined;
    } else if (wallet.walletHash === activeWalletHash) {
      Icon = CheckCircleOutlined;
    } else {
      Icon = LoginOutlined;
    }

    return <Icon className="text-white text-2xl mr-2" />;
  }, [wallet.walletHash, activeWalletHash, isActivating]);

  const activateButtonLabel = isActiveWallet
    ? translate(translations.walletActive)
    : translate(translations.activateWallet);

  const deleteButtonIcon = useCallback(() => {
    return deleteConfirm > 0 ? (
      <WarningFilled className="text-2xl mr-1 text-yellow-300" />
    ) : (
      <DeleteOutlined className="text-2xl mr-1" />
    );
  }, [deleteConfirm]);

  const deleteButtonLabel =
    /* eslint-disable no-nested-ternary */
    deleteConfirm === 0
      ? translate(translations.deleteWallet)
      : deleteConfirm === 1
        ? translate(translations.areYouSure)
        : deleteConfirm === 2
          ? translate(translations.ensureRecoveryPhrase)
          : `${translate(translations.confirmDelete)} "${wallet.name}"`;
  /* eslint-enable no-nested-ternary */

  return (
    <>
      <ViewHeader
        icon={WalletOutlined}
        title={translate(translations.walletSettings)}
      />
      <div className="p-1" key={walletHash}>
        <Card className="p-2">
          <div className="text-2xl flex justify-center items-center py-2 text-neutral-700 dark:text-neutral-100 font-bold">
            <Editable
              onConfirm={handleEditConfirm}
              value={wallet.name}
              confirmOnBlur
            />
          </div>
          <div className="flex gap-x-2 justify-between">
            <div className="flex-1 flex flex-col justify-around">
              <div>
                <div className="text-md text-neutral-600 dark:text-neutral-200 font-semibold">
                  {translate(translations.created)}
                </div>
                <div className="text-neutral-500 dark:text-neutral-100 text-sm">
                  {new Date(wallet.created_at).toLocaleString(locale)}
                </div>
              </div>
              <div>
                <div className="text-md text-neutral-600 dark:text-neutral-200 font-semibold">
                  {translate(translations.lastKnownBalance)}
                </div>
                <div className="flex gap-x-1 text-sm">
                  <span>
                    <Satoshi value={wallet.balance} />
                  </span>
                  <span>/</span>
                  <span>
                    <Satoshi value={wallet.balance} flip />
                  </span>
                </div>
              </div>
            </div>

            <div className="flex-2 flex flex-col gap-y-2 justify-around">
              <Button
                icon={activateButtonIcon}
                label={activateButtonLabel}
                labelColor="text-white"
                rounded="lg"
                bgColor="bg-primary"
                borderClasses="border border-2 border-primary-400"
                onClick={handleActivateWallet}
                disabled={isActiveWallet}
                padding="2.5"
                fullWidth
              />
              <Button
                icon={deleteButtonIcon}
                label={deleteButtonLabel}
                labelColor={`text-error ${isDeleteDisabled ? "saturate-[.60]" : ""}`}
                bgColor="bg-neutral-25"
                activeBgColor="text-error-dark"
                borderClasses="border border-2 border-error"
                rounded="lg"
                onClick={handleDeleteWallet}
                disabled={isDeleteDisabled}
                padding="2.5"
                fullWidth
              />
            </div>
          </div>
        </Card>

        <WalletSettings />
        <KeyWarning walletHash={wallet.walletHash} />
        <ShowMnemonic key={wallet.walletHash} walletHash={wallet.walletHash} />
        {shouldShowAdvancedOptions && (
          <Accordion
            icon={ToolOutlined}
            title={translate(translations.advancedOptions)}
          >
            <Accordion.Child icon={null} label="">
              <Link
                className="w-full text-left flex items-center"
                to={`/settings/wallet/${wallet.walletHash}/additionalInformation`}
              >
                <InfoCircleOutlined className="text-xl mr-1" />
                {translate(translations.additionalWalletInformation)}
              </Link>
            </Accordion.Child>
            <Accordion.Child icon={null} label="">
              <Link
                className="w-full text-left flex items-center"
                to="/apps/walletconnect"
              >
                <WalletConnectFilled className="text-xl mr-1" />
                WalletConnect
              </Link>
            </Accordion.Child>
            {isExperimental && (
              <Accordion.Child icon={null} label="">
                <Link
                  className="w-full text-left flex items-center"
                  to="/apps/cauldron"
                >
                  <ExperimentOutlined className="text-xl mr-1" />
                  Cauldron DEX
                </Link>
              </Accordion.Child>
            )}
            {isExperimental && (
              <Accordion.Child icon={null} label="">
                <Link className="w-full text-left flex items-center" to="scan">
                  <SyncOutlined className="text-xl mr-1" />
                  {translate(translations.addressScanTool)}
                </Link>
              </Accordion.Child>
            )}
            <Accordion.Child icon={null} label="">
              <button
                type="button"
                className="w-full text-left flex items-center"
                onClick={handleRebuildWallet}
              >
                <MedicineBoxOutlined className="text-xl mr-1" />
                {translate(translations.rebuildWallet)}
              </button>
            </Accordion.Child>
            {/*isExperimental && (
                <Accordion.Child icon={null} label="">
                  <button
                    type="button"
                    className="w-full text-left flex items-center"
                    onClick={handleImportWallet}
                  >
                    <ImportOutlined className="text-xl mr-1" />
                    {translate(translations.importWallet)}
                  </button>
                </Accordion.Child>
              )*/}
            {isExperimental && (
              <Accordion.Child icon={null} label="">
                <button
                  type="button"
                  className="w-full text-left flex items-center"
                  onClick={handleExportWallet}
                >
                  <ExportOutlined className="text-xl mr-1" />
                  {translate(translations.exportWallet)}
                </button>
              </Accordion.Child>
            )}
          </Accordion>
        )}
      </div>
    </>
  );
}
