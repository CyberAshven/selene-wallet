import { useNavigate } from "react-router";
import { ImportOutlined, PlusCircleOutlined } from "@ant-design/icons";

import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import Button from "@/atoms/Button";

import { translate } from "@/util/translations";
import translations from "./translations";

export default function SettingsWalletWizardInit() {
  const navigate = useNavigate();

  const handleCreateWallet = async () => {
    const wallet = await WalletManagerService().createWallet(
      translate(translations.newWallet)
    );
    navigate(`/settings/wallet/${wallet.walletHash}`, { replace: true });
  };

  const handleImportWallet = () => {
    navigate(`/settings/wallet/wizard/import`, { replace: true });
  };

  return (
    <div className="flex flex-col gap-y-8">
      <Button
        label={translate(translations.createNewWallet)}
        labelSize="lg"
        labelColor="text-neutral-25"
        icon={PlusCircleOutlined}
        iconSize="2xl"
        bgColor="bg-primary-400"
        borderClasses="border border-primary-700"
        rounded
        onClick={handleCreateWallet}
        fullWidth
        inverted
      />
      <Button
        label={translate(translations.importWalletFromPhrase)}
        labelSize="lg"
        labelColor="text-neutral-25"
        icon={ImportOutlined}
        iconSize="2xl"
        rounded
        borderClasses="border border-primary-400"
        bgColor="bg-primary-700"
        onClick={handleImportWallet}
        fullWidth
      />
    </div>
  );
}
