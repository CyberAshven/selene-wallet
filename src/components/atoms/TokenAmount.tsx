import { useSelector } from "react-redux";
import { EyeInvisibleOutlined } from "@ant-design/icons";

import { selectPrivacySettings } from "@/redux/preferences";

import { TokenEntity } from "@/kernel/wallet/TokenManagerService";
import { TokenHistoryEntity } from "@/kernel/wallet/TransactionHistoryService";

import NumberFormat from "@/atoms/NumberFormat";

interface TokenAmountProps {
  token: TokenEntity | TokenHistoryEntity;
  nft?: boolean;
}

export default function TokenAmount({ token, nft = false }: TokenAmountProps) {
  const receiveStyle = "text-primary-700 dark:text-primary-300";
  const sendStyle = "text-error";

  const tokenColor = token.color;

  const decimals = token.decimals || token.token?.decimals || 0;

  const { shouldHideBalance } = useSelector(selectPrivacySettings);

  return shouldHideBalance ? (
    <div className="text-xs flex items-center font-mono">
      <span
        className="relative bottom-[1px] mr-1"
        style={{ color: tokenColor }}
      >
        &#9679;
      </span>
      <EyeInvisibleOutlined className="opacity-80" />
    </div>
  ) : (
    <>
      {nft && (
        <div className="flex items-center">
          <span
            className="relative bottom-[1px] mr-0.5"
            style={{ color: tokenColor }}
          >
            &#9635;
          </span>
          {token.nft_amount ? (
            <span className={token.nft_amount > 0 ? receiveStyle : sendStyle}>
              <span>
                {token.nft_amount > 0 && "+"}
                {token.nft_amount}
              </span>
            </span>
          ) : (
            <span>{token.nftCount}</span>
          )}
        </div>
      )}
      {!nft && (
        <div className="flex items-center font-mono">
          <span
            className="relative bottom-[1px] pr-0.5"
            style={{ color: tokenColor }}
          >
            &#9679;
          </span>
          {token.fungible_amount ? (
            <span
              className={token.fungible_amount > 0 ? receiveStyle : sendStyle}
            >
              <span>{token.fungible_amount > 0 && "+"}</span>
              <NumberFormat
                number={token.fungible_amount}
                scalar={-decimals}
                decimals={decimals}
              />
            </span>
          ) : (
            <NumberFormat
              number={token.amount || token.token_amount}
              scalar={-decimals}
              decimals={decimals}
            />
          )}
        </div>
      )}
    </>
  );
}
