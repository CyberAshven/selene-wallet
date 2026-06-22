import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useOutletContext } from "react-router";
import { SyncOutlined } from "@ant-design/icons";

import { selectBchNetwork, selectPrivacySettings } from "@/redux/preferences";

import DatabaseService from "@/kernel/app/DatabaseService";
import TokenManagerService from "@/kernel/wallet/TokenManagerService";

import KeyWarning from "@/atoms/KeyWarning/KeyWarning";
import SeleneLogo from "@/atoms/SeleneLogo";
import TokenCard from "@/composite/TokenCard";

import { translate } from "@/util/translations";
import translations from "./translations";

//const Log = LogService("AssetsViewTokens");

export default function AssetsViewTokens() {
  const { walletHash } = useOutletContext();
  const bchNetwork = useSelector(selectBchNetwork);
  const { shouldResolveBcmr } = useSelector(selectPrivacySettings);

  const navigate = useNavigate();

  const TokenManager = useMemo(
    () => TokenManagerService(walletHash, bchNetwork),
    [walletHash, bchNetwork]
  );

  const tokenCategories = useMemo(() => {
    return TokenManager.getTokenCategories();
  }, [TokenManager]);

  const sortIdentities = useCallback((a, b) => {
    // sort tokens with metadata above tokens without metadata
    const hasMetadata = (w) => w.token && w.symbol !== w.category.slice(0, 6);

    if (hasMetadata(a) && !hasMetadata(b)) {
      return -1;
    }

    if (hasMetadata(b) && !hasMetadata(a)) {
      return 1;
    }

    return a.symbol.localeCompare(b.symbol);
  }, []);

  const initTokenData = () =>
    tokenCategories
      .map((category) => TokenManager.getToken(category))
      .map((token) => ({
        ...token,
        ...TokenManager.calculateTokenAmounts(token.category),
      }))
      .sort(sortIdentities);

  const [tokenData, setTokenData] = useState(initTokenData());

  const [isResolvingTokenData, setIsResolvingTokenData] = useState(false);

  useEffect(
    function resolveTokenMetadata() {
      const resolve = async () => {
        const resolvedData = (
          await Promise.allSettled(
            tokenCategories.map(async (category) => {
              let token;
              if (!shouldResolveBcmr) {
                token = TokenManager.getToken(category);
              } else {
                setIsResolvingTokenData(true);
                token = await TokenManager.resolveTokenData(category);
              }

              const amounts = TokenManager.calculateTokenAmounts(category);
              return { ...token, ...amounts };
            })
          )
        )
          .filter((d) => d.status === "fulfilled")
          .map((d) => d.value)
          .sort(sortIdentities);

        setTokenData(resolvedData);
        setIsResolvingTokenData(false);
      };

      resolve();

      return () => {
        // ensure resolved metadata persists in app db
        DatabaseService().flushDatabase("app");
      };
    },
    [tokenCategories, TokenManager, sortIdentities, shouldResolveBcmr]
  );

  //Log.debug(tokenData);

  const handleTokenNavigate = (tokenId) => {
    navigate(`/assets/tokens/${tokenId}`);
  };

  return (
    <div className="p-1">
      <KeyWarning walletHash={walletHash} />
      {tokenData.length === 0 ? (
        <div className="text-center py-4 rounded text-2xl text-neutral-700/90 dark:text-neutral-200 my-4">
          {translate(translations.noTokens)}
          <div className="flex justify-center items-center mt-4">
            <SeleneLogo className="h-32" cashtokens />
          </div>
        </div>
      ) : (
        <>
          {isResolvingTokenData && (
            <div className="flex justify-center items-center p-1">
              <SyncOutlined className="text-lg mr-1" spin />
              {translate(translations.downloadingTokenData)}
            </div>
          )}
          <div className="flex flex-col gap-y-1">
            {tokenData.map((token) => (
              <div
                key={token.category}
                onClick={() => handleTokenNavigate(token.category)}
              >
                <TokenCard token={token} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
