import { useSelector } from "react-redux";

import { selectBchNetwork } from "@/redux/preferences";
import { selectActiveWalletHash } from "@/redux/wallet";

import TokenManagerService from "@/kernel/wallet/TokenManagerService";

export function useTokenData(tokenId: string, withAmounts: boolean = false) {
  const walletHash = useSelector(selectActiveWalletHash);
  const bchNetwork = useSelector(selectBchNetwork);
  const TokenManager = TokenManagerService(walletHash, bchNetwork);

  const amounts = withAmounts
    ? TokenManager.calculateTokenAmounts(tokenId)
    : {};

  const tokenData = {
    ...TokenManager.getToken(tokenId),
    ...amounts,
  };

  return tokenData;
}
