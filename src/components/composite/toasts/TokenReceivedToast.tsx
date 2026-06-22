import translations from "@/views/wallet/translations";
import TokenAmount from "@/atoms/TokenAmount";
import TokenIcon from "@/atoms/TokenIcon";

import { truncateProse } from "@/util/string";

import { translate } from "@/util/translations";

import ToastCard from "./ToastCard";

interface TokenReceivedToastProps {
  token: {
    category: string;
    symbol: string;
    nft_commitment?: string;
    amount?: bigint;
  };
  isNft?: boolean;
  nftName?: string;
  nftDescription?: string;
  onDismiss: () => void;
}

export default function TokenReceivedToast({
  token,
  isNft = false,
  nftName = undefined,
  nftDescription = undefined,
  onDismiss,
}: TokenReceivedToastProps) {
  const icon = (
    <TokenIcon
      category={token.category}
      nft_commitment={token.nft_commitment}
      size={64}
      toggleable={false}
    />
  );

  const body = nftName ? (
    <div className="flex flex-col">
      <span className="font-semibold">{nftName}</span>
      {nftDescription && (
        <span className="text-sm text-neutral-500">
          {truncateProse(nftDescription)}
        </span>
      )}
    </div>
  ) : (
    <TokenAmount token={token} nft={isNft} />
  );

  return (
    <ToastCard
      icon={icon}
      header={`${token.symbol} ${translate(translations.received)}`}
      body={body}
      onDismiss={onDismiss}
    />
  );
}
