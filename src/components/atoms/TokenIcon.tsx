import { useEffect, useState } from "react";

import BcmrService from "@/kernel/bch/BcmrService";

import Checksum from "@/atoms/Checksum";
import SeleneLogo from "@/atoms/SeleneLogo";

export default function TokenIcon({
  category,
  nft_commitment = undefined,
  size = 64,
  rounded = false,
  returnImage = false,
  toggleable = true,
}: {
  category: string;
  nft_commitment?: string;
  size?: number;
  rounded?: boolean;
  returnImage?: boolean;
  toggleable?: boolean;
}) {
  const [toggleState, setToggleState] = useState(0);
  const [icon, setIcon] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  useEffect(
    function resolveIcon() {
      const resolve = async () => {
        const Bcmr = BcmrService();

        const resolvedIcon = await Bcmr.resolveIcon(
          category,
          nft_commitment,
          returnImage
        );

        setIcon(resolvedIcon);

        if (resolvedIcon) {
          setToggleState(0);
        } else {
          setToggleState(nft_commitment ? 1 : 2);
        }

        setIsResolving(false);
      };

      resolve();
    },
    [category, nft_commitment, returnImage]
  );

  const checksum = nft_commitment ? `${category}${nft_commitment}` : category;

  const handleSetToggle = (event) => {
    event.stopPropagation();

    let toggle = (toggleState + 1) % 3;
    if (!nft_commitment && toggle === 1) {
      toggle += 1;
    }

    setToggleState(toggle);
  };

  const categoryColor = `#${category.slice(0, 6)}`;

  // [icon, category+nft_commitment, category]
  const toggleStateRenderables = [
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
      className={`${rounded ? "rounded-full" : ""} overflow-hidden`}
    >
      {!isResolving &&
        (icon === null ? (
          <div className="flex items-center justify-center w-full h-full">
            <SeleneLogo cashtokens className="saturate-30 opacity-90" />
          </div>
        ) : (
          <img src={icon} className="w-full h-full object-cover" />
        ))}
    </div>,
    <div
      className="border-2 border-neutral-600 rounded-sm overflow-hidden"
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
    >
      <Checksum data={checksum} canvasSize={size} />
    </div>,
    <div
      className="border-2 rounded-sm overflow-hidden"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderColor: categoryColor,
      }}
    >
      <Checksum data={category} canvasSize={size} />
    </div>,
  ];

  return (
    <div onClick={toggleable ? handleSetToggle : undefined}>
      {isResolving && icon === null
        ? toggleStateRenderables[nft_commitment ? 1 : 2]
        : toggleStateRenderables[toggleState]}
    </div>
  );
}
