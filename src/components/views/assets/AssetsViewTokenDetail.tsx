import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate, useParams } from "react-router";
import { DateTime } from "luxon";
import { CloseOutlined, SendOutlined } from "@ant-design/icons";

import { selectBchNetwork } from "@/redux/preferences";
import { selectActiveWallet } from "@/redux/wallet";

import TokenManagerService from "@/kernel/wallet/TokenManagerService";

import FullColumn from "@/layout/FullColumn";
import Button from "@/atoms/Button";
import TokenAmount from "@/atoms/TokenAmount";
import TokenIcon from "@/atoms/TokenIcon";
import TokenCard from "@/composite/TokenCard";

import { useClipboard } from "@/hooks/useClipboard";
import { useLongPress } from "@/hooks/useLongPress";
import { useTokenData } from "@/hooks/useTokenData";

import { truncateProse } from "@/util/string";
import { compareNftCommitments, resolveNftType } from "@/util/token";
import { validateBchUri } from "@/util/uri";

import { translate } from "@/util/translations";
import translations from "./translations";

import NftDetailModal from "./NftDetailModal";

// --------------------------------

export default function AssetsViewTokenDetail() {
  const { tokenId: paramsTokenId } = useParams();
  const { walletHash } = useSelector(selectActiveWallet);
  const bchNetwork = useSelector(selectBchNetwork);

  const navigate = useNavigate();
  const { getClipboardContents } = useClipboard();

  const TokenManager = useMemo(
    () => TokenManagerService(walletHash, bchNetwork),
    [walletHash, bchNetwork]
  );

  const tokenId = paramsTokenId || "";

  const tokenData = useTokenData(tokenId, true);

  const [nftSelection, setNftSelection] = useState([]);
  const [modalNft, setModalNft] = useState(null);
  const [tokenHistory, setTokenHistory] = useState([]);

  useEffect(
    function resolveTokenHistory() {
      const resolve = async () => {
        const history = await TokenManager.resolveTokenHistory(tokenId);
        setTokenHistory(history);
      };
      resolve();
    },
    [TokenManager, tokenId]
  );

  const tokenUtxos = TokenManager.getTokenUtxos(tokenId);
  const nfts = tokenUtxos
    .filter((utxo) => utxo.nft_capability !== null)
    .sort((a, b) =>
      compareNftCommitments(
        tokenData.token?.nfts,
        a.nft_commitment || "",
        b.nft_commitment || "",
        tokenId
      )
    );

  // ----------------

  const handleTokenSend = async (nft) => {
    const { paste, spawnPasteToast } = await getClipboardContents();
    const { isBip21, address, query } = validateBchUri(paste);

    let navTo = "/wallet/send/";
    if (isBip21) {
      spawnPasteToast();
      navTo = [navTo, address, query].join("");
    }

    navigate(navTo, {
      state: {
        nftSelection: nft ? [nft] : nftSelection,
        tokenCategories: [tokenId],
      },
    });
  };

  const handleNftSelect = (utxo) => {
    setNftSelection((prev) => {
      const selectIndex = prev.findIndex(
        (nft) => nft.tx_hash === utxo.tx_hash && nft.tx_pos === utxo.tx_pos
      );
      if (selectIndex > -1) {
        return [...prev.slice(0, selectIndex), ...prev.slice(selectIndex + 1)];
      }
      return [...prev, utxo];
    });
  };

  const handleNftOpenDetail = (utxo) => {
    setModalNft(utxo);
  };

  const handleNftTap = (utxo) => {
    if (nftSelection.length > 0) {
      handleNftSelect(utxo);
    } else {
      handleNftOpenDetail(utxo);
    }
  };

  const handleNftLongPress = (utxo) => {
    if (nftSelection.length > 0) {
      handleNftOpenDetail(utxo);
    } else {
      handleNftSelect(utxo);
    }
  };

  const handleSelectionCancel = () => setNftSelection([]);
  const handleSelectionConfirm = handleTokenSend;

  // ----------------

  return (
    <FullColumn key={tokenData.category} className="justify-between">
      <div className="p-1">
        <TokenCard token={tokenData} detail nftSelection={nftSelection} />

        {nfts.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1 justify-around dark:text-neutral-100">
            {nfts.map((utxo) => {
              const isSelected =
                nftSelection.findIndex(
                  (nft) =>
                    nft.tx_hash === utxo.tx_hash && nft.tx_pos === utxo.tx_pos
                ) > -1;

              return (
                <NftCard
                  key={`${utxo.tx_hash}:${utxo.tx_pos}`}
                  utxo={utxo}
                  tokenData={tokenData}
                  isSelected={isSelected}
                  onTap={handleNftTap}
                  onLongPress={handleNftLongPress}
                />
              );
            })}
          </div>
        ) : (
          <div className="border rounded-sm border-neutral-300 shadow-inner dark:text-neutral-100 mt-2">
            {tokenHistory.map(
              (h, i) =>
                i < 50 && (
                  <div key={h.tx_hash} className="py-1">
                    <Link to={`/explore/tx/${h.tx_hash}`}>
                      <div className="flex text-sm p-1">
                        <div className="flex-1">
                          {(h.height <= 0 || !h.time
                            ? DateTime.fromISO(h.time_seen)
                            : DateTime.fromSeconds(h.time)
                          ).toLocaleString(
                            DateTime.DATETIME_SHORT_WITH_SECONDS
                          )}
                        </div>
                        <div className="text-right">
                          {h.nft_amount !== 0 && <TokenAmount token={h} nft />}
                          {h.fungible_amount !== 0n && (
                            <div className="font-mono">
                              <span className="text-sm font-mono flex items-center justify-end">
                                <TokenAmount
                                  token={{ ...h, ...tokenData.token }}
                                />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {h.memo && (
                        <div className="text-sm text-neutral-500 ml-4">
                          {translate(translations.memo)}: {h.memo}
                        </div>
                      )}
                    </Link>
                  </div>
                )
            )}
          </div>
        )}
      </div>

      {nftSelection.length > 0 && (
        <SelectionDisplay
          selection={nftSelection}
          onConfirm={handleSelectionConfirm}
          onCancel={handleSelectionCancel}
        />
      )}

      {modalNft && (
        <NftDetailModal
          category={tokenId}
          nft_commitment={modalNft.nft_commitment}
          nft_capability={modalNft.nft_capability}
          nftData={
            tokenData.token?.nfts
              ? resolveNftType(
                  tokenData.token.nfts,
                  modalNft.nft_commitment,
                  tokenData.category
                ).nftType || null
              : null
          }
          onClose={() => setModalNft(null)}
          onSend={() => handleTokenSend(modalNft)}
          nfts={nfts}
          modalNft={modalNft}
          onNavigate={setModalNft}
        />
      )}
    </FullColumn>
  );
}

// --------------------------------

/* eslint-disable react/prop-types */
function NftCard({ utxo, tokenData, isSelected, onTap, onLongPress }) {
  const longPressEvents = useLongPress(
    () => onLongPress(utxo),
    () => onTap(utxo)
  );

  const parsed = resolveNftType(
    tokenData.token?.nfts,
    utxo.nft_commitment,
    tokenData.category
  );
  const nftData = parsed.nftType || null;

  const bgClass = isSelected
    ? "bg-primary dark:bg-primary-700"
    : "bg-primary-100 dark:bg-primarydark-50";

  const borderClass = isSelected
    ? "border-primary dark:border-primary-900"
    : "";

  return (
    <div
      className={`border rounded-t rounded-b-sm items-center w-full sm:max-w-[49%] ${borderClass} ${bgClass}`}
      style={isSelected ? {} : { borderColor: tokenData.color }}
      {...longPressEvents}
    >
      <div
        style={isSelected ? {} : { backgroundColor: `${tokenData.color}AA` }}
        className={`truncate text-white font-semibold px-0.5 text-stroke ${bgClass}`}
      >
        {nftData && nftData.name && (
          <span className="px-0.5">{nftData.name}</span>
        )}
      </div>
      <div className="flex">
        <TokenIcon
          category={utxo.token_category}
          nft_commitment={utxo.nft_commitment}
          toggleable={false}
        />
        <div className="flex flex-col justify-between w-full">
          <div className="flex truncate px-1">
            {nftData && nftData.description ? (
              <span className="text-sm text-neutral-700 dark:text-neutral-100/90 text-wrap">
                {truncateProse(nftData.description)}
              </span>
            ) : (
              utxo.nft_commitment && (
                <span className="text-xs font-mono text-neutral-500 dark:text-neutral-200 break-all text-wrap">
                  {utxo.nft_commitment}
                </span>
              )
            )}
          </div>
        </div>
      </div>
      {parsed.fields.length > 0 && (
        <div className="px-1 text-xs">
          {parsed.fields.map((field) => (
            <div key={field.name} className="flex justify-between py-0.5">
              <span className="text-neutral-500 dark:text-neutral-400">
                {field.name}
              </span>
              <span className="font-mono text-neutral-700 dark:text-neutral-200">
                {field.displayValue}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------

/* eslint-disable react/prop-types */
function SelectionDisplay({ selection, onConfirm, onCancel }) {
  const selectedAmount = selection.length;

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="sticky bottom-0 bg-primary-900 w-full border-t-2 border-neutral-900 dark:border-primarydark-500 rounded-t shadow mt-1">
      <div className="text-neutral-700 rounded-t bg-neutral-100 dark:bg-neutral-1000 dark:text-neutral-100 shadow-lg px-2 py-1">
        <div className="flex relative justify-between">
          <div className="flex items-center justify-start flex-1">
            <Button
              onClick={handleCancel}
              icon={CloseOutlined}
              iconSize="lg"
              bgColor="transparent"
              activeBgColor="bg-primary-500 dark:active:bg-primarydark-400"
              borderClasses="border border-primary-400"
            />
          </div>
          <div className="text-center grow flex items-center justify-center font-bold text-xl p-6">
            {selectedAmount} {translate(translations.nftsSelected)}
          </div>
          <div className="flex items-center justify-end flex-1">
            <Button
              icon={SendOutlined}
              iconSize="xl"
              label="Send"
              padding="2"
              rounded="md"
              onClick={handleConfirm}
              bgColor="bg-primary-700"
              activeLabelColor="text-white"
              labelColor="text-neutral-200"
              borderClasses="border border-primary-700"
              inverted
            />
          </div>
        </div>
      </div>
    </div>
  );
}
