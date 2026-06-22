import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import {
  ArrowRightOutlined,
  AuditOutlined,
  CodeOutlined,
  CommentOutlined,
  DiscordFilled,
  DockerOutlined,
  FacebookFilled,
  HomeOutlined,
  InstagramOutlined,
  LinkOutlined,
  QuestionCircleOutlined,
  RedditCircleFilled,
  SendOutlined,
  XOutlined,
  YoutubeFilled,
} from "@ant-design/icons";
import { TelegramFilled } from "@/icons/TelegramFilled";

import { selectIsDarkMode } from "@/redux/preferences";

import { TokenEntity } from "@/kernel/wallet/TokenManagerService";

import translations from "@/views/assets/translations";
import Button from "@/atoms/Button";
import Card from "@/atoms/Card";
import LinkExternal from "@/atoms/LinkExternal";
import TokenAmount from "@/atoms/TokenAmount";
import TokenIcon from "@/atoms/TokenIcon";
import TokenSymbol from "@/atoms/TokenSymbol";

import { useClipboard } from "@/hooks/useClipboard";

import { truncateProse } from "@/util/string";
import { validateBchUri } from "@/util/uri";

import { translate } from "@/util/translations";

export default function TokenCard({
  token,
  detail = false,
  nftSelection = [],
}: {
  token: TokenEntity;
  detail?: boolean;
  nftSelection?: unknown[];
}) {
  const navigate = useNavigate();
  const { handleCopyToClipboard, getClipboardContents } = useClipboard();

  const isDarkMode = useSelector(selectIsDarkMode);

  const handleTokenSend = async () => {
    const { paste, spawnPasteToast } = await getClipboardContents();
    const { isBip21, address, query } = validateBchUri(paste);

    let navTo = "/wallet/send/";
    if (isBip21) {
      spawnPasteToast();
      navTo = [navTo, address, query].join("");
    }

    navigate(navTo, {
      state: {
        tokenCategories: [token.category],
        nftSelection,
      },
    });
  };

  const [shouldShowFullDescription, setShouldShowFullDescription] =
    useState(false);

  const uriIcons = {
    default: <LinkOutlined />,
    web: <LinkOutlined />,
    app: <HomeOutlined />,
    chat: <CommentOutlined />,
    registry: <AuditOutlined />,
    support: <QuestionCircleOutlined />,
    discord: <DiscordFilled />,
    facebook: <FacebookFilled />,
    docker: <DockerOutlined />,
    git: <CodeOutlined />,
    instagram: <InstagramOutlined />,
    twitter: <XOutlined />,
    x: <XOutlined />,
    telegram: <TelegramFilled />,
    reddit: <RedditCircleFilled />,
    youtube: <YoutubeFilled />,
  };

  //className="w-full my-1 border border-primary rounded bg-primary-100 dark:bg-neutral-800 dark:border-primarydark-400"
  return (
    <Card key={token.category} className="overflow-auto">
      <div className="flex p-2 bg-primary-50 dark:bg-neutral-800">
        {detail ? (
          <div
            className="w-fit h-fit mr-1 border border-2 rounded-sm overflow-hidden shadow-sm"
            style={{ borderColor: token.color }}
          >
            <TokenIcon category={token.category} size={96} />
          </div>
        ) : (
          <div className="w-fit h-fit mr-1">
            <TokenIcon category={token.category} size={72} rounded />
          </div>
        )}
        <div className="flex-1">
          <div className="flex flex-col">
            <div className="flex items-center text-md py-1">
              <span className="pr-1 mr-1 border-r border-neutral-400/90">
                <TokenSymbol token={token} className="text-md font-bold" />
              </span>
              <span className="font-bold text-lg text-neutral-700 dark:text-neutral-100">
                {token.name || `Token ${token.category.slice(0, 6)}`}
              </span>
            </div>
            <div className="flex text-neutral-700 dark:text-neutral-100">
              <div className="flex-1">
                {token.nftCount > 0 && <TokenAmount token={token} nft />}
                {token.amount > 0 && (
                  <div className="flex flex-1 justify-between items-center">
                    <TokenAmount token={token} />
                  </div>
                )}
              </div>

              {token.amount > 0 && (
                <Button
                  icon={SendOutlined}
                  iconSize="lg"
                  label={translate(translations.send)}
                  labelSize="md"
                  borderClasses="border border-primary"
                  rounded="md"
                  shadow="sm"
                  padding="1.5"
                  onClick={handleTokenSend}
                />
              )}
            </div>
            {detail && (
              <div className="w-full flex flex-wrap gap-3 text-neutral-500 dark:text-primarydark-400 mt-1 text-[1.667em]">
                {token.uris &&
                  Object.entries(token.uris)
                    .filter(([k]) => !["icon", "image"].includes(k))
                    .map(([k, v]) => {
                      return (
                        <LinkExternal className="flex items-center" to={v}>
                          {uriIcons[k] || uriIcons.default}
                        </LinkExternal>
                      );
                    })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        {token.description && (
          <div
            className="p-1.5 text-md text-neutral-700 bg-primary-100 dark:text-neutral-100 dark:bg-neutral-700 rounded-sm"
            onClick={() => {
              if (detail) {
                setShouldShowFullDescription(!shouldShowFullDescription);
              }
            }}
          >
            {(detail && token.description.length <= 140) ||
            shouldShowFullDescription ? (
              token.description
            ) : (
              <>
                <div>{truncateProse(token.description)}</div>
                {detail && (
                  <div className="text-right text-sm cursor-pointer flex justify-end">
                    <span className="border-b border-dotted border-neutral-400 flex items-center shrink justify-end w-fit">
                      {translate(translations.seeMore)}
                      <ArrowRightOutlined className="ml-1" />
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div
        className="pt-0.5 px-0.5 border-t border-dashed border-neutral-300/80 font-mono text-xs text-neutral-400/70 dark:text-white/65 truncate"
        style={{ backgroundColor: `${token.color}${isDarkMode ? "80" : "20"}` }}
        onClick={(e) => {
          e.stopPropagation();
          handleCopyToClipboard(
            token.category,
            translate(translations.copiedTokenId)
          );
        }}
      >
        {token.category}
      </div>
    </Card>
  );
}
