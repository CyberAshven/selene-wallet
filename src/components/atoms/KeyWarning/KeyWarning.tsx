import { Link } from "react-router";
import { WarningFilled } from "@ant-design/icons";

import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import { translate } from "@/util/translations";
import translations from "./translations";

export default function KeyWarning({ walletHash }: { walletHash: string }) {
  const wallet = WalletManagerService().getWalletMeta(walletHash);

  const isKeyViewed = wallet.key_viewed_at !== null;
  const hasWalletBalance = wallet.balance > 0;

  const borderClasses = hasWalletBalance
    ? "border-error border-4"
    : "border-warn border-2";

  return isKeyViewed ? null : (
    <div className="mb-2 p-2">
      <Link to={`/settings/wallet/${wallet.walletHash}`}>
        <div
          className={`alert alert-warn p-2 shadow bg-warn/90 text-black rounded-lg text-center ${borderClasses}`}
        >
          <div className="text-xl flex items-center justify-center">
            <span className="font-bold text-error text-5xl flex items-center justify-center">
              <WarningFilled />
            </span>
            <span className="text-neutral-25 font-semibold">
              {translate(translations.backUpWallet)}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
