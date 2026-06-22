import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate, useOutletContext } from "react-router";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";

import { selectBchNetwork, selectPrivacySettings } from "@/redux/preferences";

import DatabaseService from "@/kernel/app/DatabaseService";
import TokenManagerService from "@/kernel/wallet/TokenManagerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";

import FullColumn from "@/layout/FullColumn";
import TokenAmount from "@/atoms/TokenAmount";
import TokenIcon from "@/atoms/TokenIcon";

import { PRIZE_DESCRIPTIONS, TOKEN_DETAILS } from "./constants";

function BlissTokenHuntView() {
  const navigate = useNavigate();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [selectedTokenCategory, setSelectedTokenCategory] = useState<
    string | null
  >(null);
  const [selectedPrize, setSelectedPrize] = useState<number | null>(null);
  const wallet = useOutletContext<{ walletHash?: string }>();
  const bchNetwork = useSelector(selectBchNetwork);
  const { shouldResolveBcmr } = useSelector(selectPrivacySettings);

  const TokenManager = useMemo(
    () => TokenManagerService(wallet?.walletHash || "", bchNetwork),
    [wallet?.walletHash, bchNetwork]
  );

  const tokenCount = useMemo(() => {
    if (!wallet?.walletHash) return 1; // Minimum of 1

    const walletTokenCategories = TokenManager.getTokenCategories();
    const matchingCount = TOKEN_DETAILS.filter((tokenDetail) =>
      walletTokenCategories.includes(tokenDetail.categoryId)
    ).length;

    return Math.max(1, matchingCount); // Minimum of 1
  }, [wallet?.walletHash, TokenManager]);

  // Initialize token data with placeholder/sync data
  const initTokenData = useMemo(() => {
    return TOKEN_DETAILS.map((tokenDetail) => {
      const { categoryId, description, index } = tokenDetail;

      // Skip placeholder category IDs (containing XXXX)
      if (categoryId.includes("XXXX")) {
        const colorHex = `#${categoryId.slice(0, 6)}`;
        const symbol = categoryId.slice(0, 6);
        return {
          category: categoryId,
          color: colorHex,
          symbol,
          name: `Token ${symbol}`,
          amount: 0n,
          nftCount: 0,
          description,
          index,
          token: {
            category: categoryId,
            symbol,
            decimals: 0,
          },
        };
      }

      // Try to get token data synchronously first
      try {
        const token = TokenManager.getToken(categoryId);
        const amounts = TokenManager.calculateTokenAmounts(categoryId);
        return {
          ...token,
          ...amounts,
          description,
          index,
        };
      } catch (e) {
        // Token metadata not available, but might still exist in wallet
        // Try to get amounts anyway
        try {
          const amounts = TokenManager.calculateTokenAmounts(categoryId);
          const colorHex = `#${categoryId.slice(0, 6)}`;
          const symbol = categoryId.slice(0, 6);
          return {
            category: categoryId,
            color: colorHex,
            symbol,
            name: `Token ${symbol}`,
            ...amounts,
            description,
            index,
            token: {
              category: categoryId,
              symbol,
              decimals: 0,
            },
          };
        } catch (amountError) {
          // Token doesn't exist in wallet
          const colorHex = `#${categoryId.slice(0, 6)}`;
          const symbol = categoryId.slice(0, 6);
          return {
            category: categoryId,
            color: colorHex,
            symbol,
            name: `Token ${symbol}`,
            amount: 0n,
            nftCount: 0,
            description,
            index,
            token: {
              category: categoryId,
              symbol,
              decimals: 0,
            },
          };
        }
      }
    });
  }, [TokenManager]);

  const [tokenDataList, setTokenDataList] = useState(initTokenData);
  const [isResolvingTokenData, setIsResolvingTokenData] = useState(false);

  // Resolve token metadata asynchronously
  useEffect(
    function resolveTokenMetadata() {
      const resolve = async () => {
        const resolvedData = (
          await Promise.allSettled(
            TOKEN_DETAILS.map(async (tokenDetail) => {
              const { categoryId, description, index } = tokenDetail;

              // Skip placeholder category IDs (containing XXXX)
              if (categoryId.includes("XXXX")) {
                const colorHex = `#${categoryId.slice(0, 6)}`;
                const symbol = categoryId.slice(0, 6);
                return {
                  category: categoryId,
                  color: colorHex,
                  symbol,
                  name: `Token ${symbol}`,
                  amount: 0n,
                  nftCount: 0,
                  description,
                  index,
                  token: {
                    category: categoryId,
                    symbol,
                    decimals: 0,
                  },
                };
              }

              let token;
              if (!shouldResolveBcmr) {
                // Try to get from cache
                try {
                  token = TokenManager.getToken(categoryId);
                } catch (e) {
                  // Generate placeholder if not in cache
                  const amounts =
                    TokenManager.calculateTokenAmounts(categoryId);
                  const colorHex = `#${categoryId.slice(0, 6)}`;
                  const symbol = categoryId.slice(0, 6);
                  return {
                    category: categoryId,
                    color: colorHex,
                    symbol,
                    name: `Token ${symbol}`,
                    ...amounts,
                    description,
                    index,
                    token: {
                      category: categoryId,
                      symbol,
                      decimals: 0,
                    },
                  };
                }
              } else {
                setIsResolvingTokenData(true);
                try {
                  token = await TokenManager.resolveTokenData(categoryId);
                } catch (e) {
                  // If resolution fails, try to get from cache or generate placeholder
                  try {
                    token = TokenManager.getToken(categoryId);
                  } catch (e2) {
                    const amounts =
                      TokenManager.calculateTokenAmounts(categoryId);
                    const colorHex = `#${categoryId.slice(0, 6)}`;
                    const symbol = categoryId.slice(0, 6);
                    return {
                      category: categoryId,
                      color: colorHex,
                      symbol,
                      name: `Token ${symbol}`,
                      ...amounts,
                      description,
                      index,
                      token: {
                        category: categoryId,
                        symbol,
                        decimals: 0,
                      },
                    };
                  }
                }
              }

              const amounts = TokenManager.calculateTokenAmounts(categoryId);
              return {
                ...token,
                ...amounts,
                description,
                index,
              };
            })
          )
        )
          .filter((d) => d.status === "fulfilled")
          .map((d) => d.value);

        setTokenDataList(resolvedData);
        setIsResolvingTokenData(false);
      };

      resolve();

      return () => {
        // ensure resolved metadata persists in app db
        DatabaseService().flushDatabase("app");
      };
    },
    [TokenManager, shouldResolveBcmr]
  );

  const handleRedeemPrize = useCallback(() => {
    if (!wallet?.walletHash || !selectedPrize) return;

    const UtxoManager = UtxoManagerService(wallet.walletHash);
    const walletTokenCategories = TokenManager.getTokenCategories();

    // Get the first selectedPrize entries from TOKEN_DETAILS (not filtered by what user has)
    const requiredTokenDetails = TOKEN_DETAILS.slice(0, selectedPrize);

    // Count how many outputs are needed per category (allowing same category multiple times)
    const categoryOutputCounts = new Map<string, number>();
    for (const tokenDetail of requiredTokenDetails) {
      const count = categoryOutputCounts.get(tokenDetail.categoryId) || 0;
      categoryOutputCounts.set(tokenDetail.categoryId, count + 1);
    }

    // Select UTXOs to cover the total needed per category
    // One UTXO can cover multiple outputs if it has enough tokens
    const tokenSelection: Array<any> = [];
    const categoriesToSend: string[] = [];
    const selectedUtxoKeys = new Set<string>(); // Track which UTXOs we've selected

    for (const [categoryId, outputCount] of categoryOutputCounts.entries()) {
      // Check if user has this category
      if (!walletTokenCategories.includes(categoryId)) {
        console.warn(`User does not have token category ${categoryId}`);
        // Still add to categoriesToSend to maintain count, but we'll fail validation later
        for (let i = 0; i < outputCount; i++) {
          categoriesToSend.push(categoryId);
        }
        continue;
      }

      const categoryUtxos = UtxoManager.getCategoryUtxos(categoryId);

      // Get token decimals to calculate minimum raw amount for 1 token
      let decimals = 0;
      try {
        const tokenData = TokenManager.getToken(categoryId);
        decimals = tokenData.token?.decimals ?? tokenData.decimals ?? 0;
      } catch (e) {
        console.warn(
          `Could not get token data for ${categoryId}, defaulting to 0 decimals`,
          e
        );
      }

      // Calculate minimum raw amount: 1 token = 10^decimals
      const oneTokenRawAmount = BigInt(10 ** decimals);
      // Total amount needed: outputCount tokens
      const totalNeeded = oneTokenRawAmount * BigInt(outputCount);

      // Filter to non-NFT UTXOs with at least 1 token (accounting for decimals)
      const suitableUtxos = categoryUtxos.filter((utxo) => {
        const tokenAmount = BigInt(utxo.token_amount || 0);
        return tokenAmount >= oneTokenRawAmount && utxo.nft_capability === null;
      });

      if (suitableUtxos.length === 0) {
        console.warn(`No suitable UTXOs available for category ${categoryId}`);
        // Still add to categoriesToSend to maintain count, but we'll fail validation later
        for (let i = 0; i < outputCount; i++) {
          categoriesToSend.push(categoryId);
        }
        continue;
      }

      // Sort UTXOs by token_amount ascending to prefer smaller UTXOs first
      const sortedUtxos = [...suitableUtxos].sort((a, b) => {
        const aAmount = BigInt(a.token_amount || 0);
        const bAmount = BigInt(b.token_amount || 0);
        return aAmount < bAmount ? -1 : aAmount > bAmount ? 1 : 0;
      });

      // Select UTXOs until we have enough to cover the total needed
      // The same UTXO can be used if it has enough tokens for multiple outputs
      let totalSelected = 0n;
      const selectedUtxosForCategory: Array<any> = [];

      for (const utxo of sortedUtxos) {
        const tokenAmount = BigInt(utxo.token_amount || 0);
        const utxoKey = `${utxo.txid}:${utxo.tx_pos}`;

        // Only add each UTXO once to tokenSelection (even if it covers multiple outputs)
        if (!selectedUtxoKeys.has(utxoKey)) {
          selectedUtxosForCategory.push(utxo);
          selectedUtxoKeys.add(utxoKey);
        }

        totalSelected += tokenAmount;

        if (totalSelected >= totalNeeded) {
          break; // We have enough
        }
      }

      // Verify we have enough tokens
      if (totalSelected >= totalNeeded) {
        tokenSelection.push(...selectedUtxosForCategory);
        // Add the category to categoriesToSend once per output needed
        // This ensures we create one recipient per required output
        for (let i = 0; i < outputCount; i++) {
          categoriesToSend.push(categoryId);
        }
      } else {
        console.warn(
          `Insufficient tokens for category ${categoryId}: need ${totalNeeded.toString()}, have ${totalSelected.toString()}`
        );
        // Still add to categoriesToSend to maintain count, but we'll fail validation later
        for (let i = 0; i < outputCount; i++) {
          categoriesToSend.push(categoryId);
        }
      }
    }

    // Verify we have enough tokens selected (should match the number of required outputs)
    if (categoriesToSend.length < selectedPrize) {
      console.error("Not enough tokens available for redemption", {
        selectedPrize,
        categoriesToSendLength: categoriesToSend.length,
        requiredTokenDetails: requiredTokenDetails.length,
        categoryOutputCounts: Array.from(categoryOutputCounts.entries()),
      });
      return;
    }

    // Verify each selected UTXO actually has at least 1 token (accounting for decimals)
    const invalidUtxos = tokenSelection.filter((utxo) => {
      const tokenAmount = BigInt(utxo.token_amount || 0);
      // Get decimals for this token category
      let decimals = 0;
      try {
        const tokenData = TokenManager.getToken(utxo.token_category);
        decimals = tokenData.token?.decimals ?? tokenData.decimals ?? 0;
      } catch (e) {
        // Default to 0 if we can't get token data
      }
      const oneTokenRawAmount = BigInt(10 ** decimals);
      return tokenAmount < oneTokenRawAmount;
    });

    if (invalidUtxos.length > 0) {
      console.error("Selected UTXOs with insufficient tokens", invalidUtxos);
      return;
    }

    console.log("Redeeming prize with token selection:", {
      selectedPrize,
      tokenSelection: tokenSelection.map((utxo) => ({
        category: utxo.token_category,
        amount: utxo.token_amount?.toString(),
        amountBigInt: utxo.token_amount,
        txid: utxo.txid,
        tx_pos: utxo.tx_pos,
        fullUtxo: utxo,
      })),
      categoriesToSend,
      requiredTokenDetails: requiredTokenDetails.map((td) => ({
        categoryId: td.categoryId,
        index: td.index,
      })),
    });

    // Log each category's UTXOs for debugging
    for (const tokenDetail of requiredTokenDetails) {
      const categoryUtxos = UtxoManager.getCategoryUtxos(
        tokenDetail.categoryId
      );
      console.log(
        `UTXOs for category ${tokenDetail.categoryId}:`,
        categoryUtxos.map((utxo) => ({
          txid: utxo.txid,
          tx_pos: utxo.tx_pos,
          token_amount: utxo.token_amount?.toString(),
          nft_capability: utxo.nft_capability,
        }))
      );
    }

    // Navigate to Send screen with tokenSelection
    navigate("/wallet/send", {
      state: {
        tokenSelection,
        tokenCategories: categoriesToSend,
      },
    });
  }, [wallet?.walletHash, selectedPrize, TokenManager, navigate]);

  return (
    <FullColumn>
      <div className="px-2 py-2">
        {rulesOpen ? (
          <div className="bg-neutral-700 rounded-lg px-2 py-2 my-1 text-neutral-50 dark:bg-neutral-200 dark:border dark:border-neutral-200 h-[650px] overflow-y-auto">
            <div className="px-2.5 py-1 w-full">
              <h1 className="font-bliss text-2xl text-[#e8078c] bg-[linear-gradient(to_bottom,_rgb(232,_7,_140),_rgb(160,_137,_191))] bg-clip-text text-transparent text-center mb-4">
                BLISS Token Hunt
              </h1>
              <div>
                There are 10 Token Hunt fungible tokens (plus the special "All
                Star" token) to collect by completing various challenges at or
                related to BLISS 2026. Collect a set of 3 or more different
                tokens & cash them in for an exclusive BLISS prize!
              </div>
              <br />
              <div>
                Tokens may of course be traded, bartered, bought/sold or gifted
                among attendees (or non-attendees!) as they please. Some tokens
                are harder to acquire than others - so be savvy!
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setRulesOpen(false);
                    setSelectedPrize(null);
                  }}
                  className="w-full px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                >
                  Understood! Hide rules.
                </button>
              </div>
            </div>
          </div>
        ) : selectedTokenCategory ? (
          (() => {
            const token = tokenDataList.find(
              (t) => t.category === selectedTokenCategory
            );
            if (!token) return null;
            const hasToken = token.amount > 0n || token.nftCount > 0;
            const originalIndex = tokenDataList.findIndex(
              (t) => t.category === token.category
            );

            return (
              <div className="bg-neutral-700 rounded-lg px-2 py-2 my-1 text-neutral-50 dark:bg-neutral-200 dark:border dark:border-neutral-200 h-[650px] overflow-y-auto">
                <div className="px-2.5 py-1 w-full">
                  <h1 className="font-bliss text-2xl text-[#e8078c] bg-[linear-gradient(to_bottom,_rgb(232,_7,_140),_rgb(160,_137,_191))] bg-clip-text text-transparent text-center mb-4">
                    Token Hunt
                  </h1>
                  <div className="flex items-center mb-4">
                    <div className="w-fit h-fit mr-3">
                      <TokenIcon category={token.category} size={72} rounded />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center text-md mb-1">
                        <span className="flex items-center justify-center w-8 mr-2 font-bold text-lg text-neutral-50 dark:text-neutral-800">
                          #
                          {typeof token.index !== "undefined"
                            ? token.index
                            : originalIndex}
                        </span>
                        <span
                          className="font-mono text-md font-bold pr-1.5 mr-1.5 border-r border-neutral-400/90"
                          style={{ color: token.color }}
                        >
                          {token.token?.symbol || token.symbol}
                        </span>
                        <span className="font-bold text-lg text-neutral-50 dark:text-neutral-800">
                          {token.name || `Token ${token.category.slice(0, 6)}`}
                        </span>
                      </div>
                      <div className="flex text-neutral-50 dark:text-neutral-800">
                        <div className="flex-1">
                          {token.nftCount > 0 && (
                            <TokenAmount token={token as any} nft />
                          )}
                          {token.amount > 0 && (
                            <TokenAmount token={token as any} />
                          )}
                          {!hasToken && (
                            <span className="text-sm">Quantity: 0</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  {token.description && (
                    <div className="mb-4 text-md text-neutral-50 dark:text-neutral-800">
                      {token.description}
                    </div>
                  )}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTokenCategory(null);
                        setSelectedPrize(null);
                      }}
                      className="w-full px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                    >
                      Back to grid
                    </button>
                  </div>
                </div>
              </div>
            );
          })()
        ) : selectedPrize ? (
          <div className="bg-neutral-700 rounded-lg px-2 py-2 my-1 text-neutral-50 dark:bg-neutral-200 dark:border dark:border-neutral-200 h-[650px] overflow-y-auto">
            <div className="px-2.5 py-1 w-full">
              <h1 className="font-bliss text-2xl text-[#e8078c] bg-[linear-gradient(to_bottom,_rgb(232,_7,_140),_rgb(160,_137,_191))] bg-clip-text text-transparent text-center mb-4">
                Token Hunt
              </h1>
              <div className="mb-4">
                <h2 className="font-bliss text-xl mb-2 text-neutral-50 dark:text-neutral-800">
                  {selectedPrize} Tokens Prize
                </h2>
                <div className="text-md text-neutral-50 dark:text-neutral-800">
                  {
                    PRIZE_DESCRIPTIONS.find(
                      (p) => p.numberTokensRequired === selectedPrize
                    )?.description
                  }
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={handleRedeemPrize}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                  Redeem {selectedPrize} tokens
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPrize(null)}
                  className="w-full px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark transition-colors"
                >
                  Back to grid
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {isResolvingTokenData && (
              <div className="flex justify-center items-center p-1 mt-2">
                <SyncOutlined className="text-lg mr-1" spin />
                <span>Loading token data...</span>
              </div>
            )}

            <div className="bg-neutral-700 rounded-lg px-2 py-2 my-1 text-neutral-50 dark:bg-neutral-200 dark:border dark:border-neutral-200 h-[650px] overflow-y-auto">
              <div className="px-2.5 py-1 w-full">
                <h1 className="font-bliss text-2xl text-[#e8078c] bg-[linear-gradient(to_bottom,_rgb(232,_7,_140),_rgb(160,_137,_191))] bg-clip-text text-transparent text-center mb-4">
                  Token Hunt
                </h1>
                {/* Grid of token icons (4x3) with Rules square */}
                <div className="grid grid-cols-4 gap-2">
                  {/* Token icons */}
                  {tokenDataList.map((token) => {
                    const hasToken = token.amount > 0n || token.nftCount > 0;
                    const opacity = hasToken ? "opacity-100" : "opacity-50";
                    const originalIndex = tokenDataList.findIndex(
                      (t) => t.category === token.category
                    );

                    const handleTokenClick = () => {
                      setSelectedTokenCategory(token.category);
                      setRulesOpen(false);
                      setSelectedPrize(null);
                    };

                    return (
                      <div
                        key={token.category}
                        className={`relative border rounded transition-all duration-300 cursor-pointer aspect-square flex items-center justify-center ${
                          hasToken
                            ? "border-green-500 bg-green-500 dark:bg-green-600 dark:border-green-600"
                            : "border-primary bg-primary-50 dark:bg-neutral-800 dark:border-primarydark-400"
                        } ${opacity}`}
                        onClick={handleTokenClick}
                      >
                        {hasToken && (
                          <CheckCircleOutlined className="absolute top-0 right-0 pt-[5px] pr-[5px] text-green-600 dark:text-green-300 text-lg z-10" />
                        )}
                        <div className="absolute top-1 left-1 font-bold text-xs text-neutral-600 dark:text-neutral-300">
                          #
                          {typeof token.index !== "undefined"
                            ? token.index
                            : originalIndex}
                        </div>
                        <div className="pointer-events-none">
                          <TokenIcon
                            category={token.category}
                            size={64}
                            rounded
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Rules square (bottom right position) */}
                  <div
                    className="relative border rounded transition-all duration-300 cursor-pointer aspect-square flex items-center justify-center border-primary bg-primary-50 dark:bg-neutral-800 dark:border-primarydark-400"
                    onClick={() => {
                      setRulesOpen(true);
                      setSelectedTokenCategory(null);
                      setSelectedPrize(null);
                    }}
                  >
                    <div className="absolute top-1 left-1 font-bold text-xs text-neutral-600 dark:text-neutral-300">
                      Rules
                    </div>
                    <div className="text-center px-2">
                      <div className="text-lg font-bold text-neutral-700 dark:text-neutral-100">
                        Rules
                      </div>
                    </div>
                  </div>
                </div>

                {/* Horizontal rule */}
                <hr className="border-white/30 dark:border-neutral-600 my-4" />

                {/* Prizes section */}
                <h2 className="font-bliss text-lg mb-2 text-neutral-50 dark:text-neutral-800 text-center">
                  Prizes
                </h2>
                <div className="grid grid-cols-4 gap-2">
                  {PRIZE_DESCRIPTIONS.map((prize) => {
                    const hasEnoughTokens =
                      tokenCount >= prize.numberTokensRequired;
                    const opacity = hasEnoughTokens
                      ? "opacity-100"
                      : "opacity-50";

                    const handlePrizeClick = () => {
                      setSelectedPrize(prize.numberTokensRequired);
                      setRulesOpen(false);
                      setSelectedTokenCategory(null);
                    };

                    return (
                      <div
                        key={prize.numberTokensRequired}
                        className={`relative border rounded transition-all duration-300 cursor-pointer aspect-square flex items-center justify-center ${
                          hasEnoughTokens
                            ? "border-green-500 bg-green-500 dark:bg-green-600 dark:border-green-600"
                            : "border-primary bg-primary-50 dark:bg-neutral-800 dark:border-primarydark-400"
                        } ${opacity}`}
                        onClick={handlePrizeClick}
                      >
                        <div className="text-center px-2">
                          <div
                            className={`text-sm font-bold ${hasEnoughTokens ? "text-white" : "text-neutral-700 dark:text-neutral-100"}`}
                          >
                            {hasEnoughTokens
                              ? `${prize.numberTokensRequired} Tokens - Available!`
                              : `Acquire ${prize.numberTokensRequired} Tokens`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </FullColumn>
  );
}

export default BlissTokenHuntView;
