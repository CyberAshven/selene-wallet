import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  AppstoreOutlined,
  CloseOutlined,
  LeftOutlined,
  LoadingOutlined,
  RightOutlined,
  SendOutlined,
} from "@ant-design/icons";

import { selectBchNetwork } from "@/redux/preferences";

import BcmrService from "@/kernel/bch/BcmrService";

import Button from "@/atoms/Button";
import Overlay from "@/atoms/Overlay";

import { useSwipe } from "@/hooks/useSwipe";

import { getNftCapabilityKey } from "@/util/token";

import { translate } from "@/util/translations";
import translations from "./translations";

// ----------------

const capabilityTranslations = {
  minting: translations.nftCapabilityMinting,
  mutable: translations.nftCapabilityMutable,
  none: translations.nftCapabilityNone,
};

// --------------------------------

interface NftUtxo {
  tx_hash: string;
  tx_pos: number;
  nft_commitment: string;
  nft_capability: string | null;
}

interface NftDetailModalProps {
  category: string;
  nft_commitment: string;
  nft_capability: string | null;
  nftData: {
    name?: string;
    description?: string;
    uris?: Record<string, string>;
    extensions?: Record<string, unknown>;
  } | null;
  onClose: () => void;
  onSend: () => void;
  nfts?: NftUtxo[];
  modalNft?: NftUtxo;
  onNavigate?: (utxo: NftUtxo) => void;
}

export default function NftDetailModal({
  category,
  nft_commitment,
  nft_capability,
  nftData,
  onClose,
  onSend,
  nfts = [],
  modalNft = undefined,
  onNavigate = undefined,
}: NftDetailModalProps) {
  const bchNetwork = useSelector(selectBchNetwork);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isAttributesVisible, setIsAttributesVisible] = useState(false);

  const currentIndex = modalNft
    ? nfts.findIndex(
        (u) => u.tx_hash === modalNft.tx_hash && u.tx_pos === modalNft.tx_pos
      )
    : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < nfts.length - 1;
  const handlePrev =
    hasPrev && onNavigate
      ? () => onNavigate(nfts[currentIndex - 1])
      : undefined;
  const handleNext =
    hasNext && onNavigate
      ? () => onNavigate(nfts[currentIndex + 1])
      : undefined;

  const swipeHandlers = useSwipe({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
  });

  useEffect(
    function resolveNftImage() {
      setIsImageLoaded(false);
      const resolve = async () => {
        const Bcmr = BcmrService(bchNetwork);
        const uri = await Bcmr.resolveIcon(category, nft_commitment, true);
        setImageUri(uri);
      };
      resolve();
    },
    [bchNetwork, category, nft_commitment]
  );

  const handleImageLoad = useCallback(() => {
    setIsImageLoaded(true);
  }, []);

  const capabilityKey = getNftCapabilityKey(nft_capability);
  const capabilityLabel = translate(capabilityTranslations[capabilityKey]);
  const categoryColor = `#${category.slice(0, 6)}`;

  const attributes =
    nftData?.extensions?.attributes &&
    typeof nftData.extensions.attributes === "object"
      ? Object.entries(nftData.extensions.attributes as Record<string, string>)
      : [];

  return (
    <Overlay onClose={onClose}>
      {/* Close button */}
      <button
        type="button"
        className="pointer-events-auto absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900/50 text-white cursor-pointer"
        onClick={onClose}
      >
        <CloseOutlined />
      </button>

      {/* Art — fills available space */}
      <div
        className="flex-1 flex items-center justify-center p-2 min-h-0"
        {...swipeHandlers}
        style={{ ...swipeHandlers.style }}
      >
        {hasPrev && (
          <button
            type="button"
            className="pointer-events-auto absolute left-2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900/30 text-white/60 cursor-pointer"
            onPointerUp={(e) => {
              e.stopPropagation();
              if (handlePrev) handlePrev();
            }}
          >
            <LeftOutlined />
          </button>
        )}
        {!isImageLoaded && (
          <LoadingOutlined className="text-2xl text-white/40 animate-spin" />
        )}
        {imageUri && (
          <img
            src={imageUri}
            className={`pointer-events-auto max-w-full max-h-full object-contain rounded-lg ${isImageLoaded ? "opacity-100" : "opacity-0 absolute"}`}
            style={{ border: `3px solid ${categoryColor}` }}
            onLoad={handleImageLoad}
          />
        )}
        {hasNext && (
          <button
            type="button"
            className="pointer-events-auto absolute right-2 z-20 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900/30 text-white/60 cursor-pointer"
            onPointerUp={(e) => {
              e.stopPropagation();
              if (handleNext) handleNext();
            }}
          >
            <RightOutlined />
          </button>
        )}
      </div>

      {/* Info panel */}
      <div
        className="pointer-events-auto bg-primary-200 dark:bg-neutral-800 border-t border-primary-700 dark:border-primarydark-200 rounded-t-xl px-4 pt-3 pb-5 max-h-[60%] flex flex-col"
        style={{
          borderTopColor: categoryColor,
          borderTopWidth: "3px",
        }}
      >
        <div className="flex items-center justify-between">
          {nftData && nftData.name ? (
            <h2 className="text-lg font-bold dark:text-neutral-50">
              {nftData.name}
            </h2>
          ) : (
            <div />
          )}
          {nfts.length > 1 && currentIndex >= 0 && (
            <span className="text-sm text-neutral-400 dark:text-neutral-500 tabular-nums shrink-0 ml-2">
              {currentIndex + 1} / {nfts.length}
            </span>
          )}
        </div>

        {nftData && nftData.description && (
          <p className="text-sm text-neutral-600 dark:text-neutral-300 mt-1">
            {nftData.description}
          </p>
        )}

        {isAttributesVisible && attributes.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5 mt-2 overflow-y-auto min-h-0 max-h-[7rem]">
            {attributes.map(([key, value]) => (
              <div
                key={key}
                className="bg-neutral-100 dark:bg-neutral-700 rounded px-2 py-1 text-center"
              >
                <div className="text-[10px] text-neutral-400 dark:text-neutral-400 uppercase tracking-wide leading-tight">
                  {key}
                </div>
                <div className="text-xs font-semibold dark:text-neutral-100 truncate leading-tight">
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {nft_capability && nft_capability !== "none" && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                style={{
                  backgroundColor: `${categoryColor}22`,
                  color: categoryColor,
                  border: `1px solid ${categoryColor}44`,
                }}
              >
                {capabilityLabel}
              </span>
            )}
            {attributes.length > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 cursor-pointer text-neutral-400 dark:text-neutral-500"
                onClick={() => setIsAttributesVisible((prev) => !prev)}
              >
                <AppstoreOutlined className="text-sm" />
                <span className="text-xs">
                  {isAttributesVisible
                    ? translate(translations.hideAttributes)
                    : translate(translations.showAttributes)}
                </span>
              </button>
            )}
          </div>
          <Button
            icon={SendOutlined}
            iconSize="lg"
            label={translate(translations.send)}
            labelSize="sm"
            padding="2"
            rounded="md"
            onClick={onSend}
            bgColor="bg-primary-700"
            activeLabelColor="text-white"
            labelColor="text-neutral-200"
            borderClasses="border border-primary-700"
            inverted
          />
        </div>
      </div>
    </Overlay>
  );
}
