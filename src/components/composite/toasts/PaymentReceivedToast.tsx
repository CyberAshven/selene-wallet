import translations from "@/views/wallet/translations";
import Satoshi from "@/atoms/Satoshi";
import TokenAmount from "@/atoms/TokenAmount";
import TokenIcon from "@/atoms/TokenIcon";

import { logos } from "@/util/logos";

import { translate } from "@/util/translations";

import ToastCard from "./ToastCard";

interface PaymentReceivedToastProps {
  amount: bigint;
  token?: { category: string };
  onDismiss: () => void;
}

export default function PaymentReceivedToast({
  amount,
  token = undefined,
  onDismiss,
}: PaymentReceivedToastProps) {
  const icon = token ? (
    <TokenIcon category={token.category} size={64} />
  ) : (
    <img
      src={logos.selene.img}
      style={{ width: "64px", height: "64px" }}
      alt=""
    />
  );

  const body = (
    <div className="flex flex-col">
      {token ? (
        <>
          <div>
            <TokenAmount token={token} />
          </div>
          <div className="text-primary-900 dark:text-primarydark-400 text-sm">
            +<Satoshi value={amount} fiat={false} />
          </div>
        </>
      ) : (
        <>
          <div className="text-primary-900 dark:text-primarydark-400">
            +<Satoshi value={amount} />
          </div>
          <div className="text-neutral-700 dark:text-neutral-300 font-mono text-sm">
            <Satoshi value={amount} flip />
          </div>
        </>
      )}
    </div>
  );

  return (
    <ToastCard
      icon={icon}
      header={translate(translations.paymentReceived)}
      body={body}
      onDismiss={onDismiss}
    />
  );
}
