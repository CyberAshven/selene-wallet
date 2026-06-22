import ReactPlayer from "react-player/youtube";
import { useSelector } from "react-redux";
import PlayCircleFilled from "@ant-design/icons/PlayCircleFilled";

import { selectDevicePlatform } from "@/redux/device";

import { useNavigateExternal } from "@/hooks/useNavigateExternal";

// --------------------------------

/** Extract YouTube video ID from various URL formats. */
function getYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];
  let result: string | null = null;
  patterns.forEach((pattern) => {
    if (!result) {
      const match = url.match(pattern);
      if (match) result = match[1];
    }
  });
  return result;
}

// --------------------------------

interface Props {
  url: string;
}

/**
 * iOS fallback: YouTube iframes fail on WKWebView (Error 153) because
 * the capacitor:// origin doesn't send valid Referer headers.
 * Show a thumbnail + play button that opens in Safari View Controller.
 */
function IosThumbnail({ url }: Props) {
  const navigateExternal = useNavigateExternal();
  const videoId = getYouTubeId(url);
  const thumbnail = videoId
    ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    : null;

  if (!thumbnail) return null;

  return (
    <button
      type="button"
      className="relative w-full aspect-video bg-black cursor-pointer group"
      onClick={() => navigateExternal(url)}
    >
      <img
        src={thumbnail}
        alt="Video thumbnail"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
        <PlayCircleFilled
          className="text-white drop-shadow-lg"
          style={{ fontSize: 64 }}
        />
      </div>
    </button>
  );
}

// --------------------------------

function EmbeddedVideoCardWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="aspect-video rounded-lg overflow-hidden">{children}</div>
  );
}

export default function EmbeddedVideo({ url }: Props) {
  const platform = useSelector(selectDevicePlatform);

  if (platform === "ios") {
    return (
      <div className="w-full flex justify-center">
        <IosThumbnail url={url} />
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <ReactPlayer url={url} width="100%" />
    </div>
  );
}

export function EmbeddedVideoCard({ url }: Props) {
  const platform = useSelector(selectDevicePlatform);

  if (platform === "ios") {
    return (
      <div className="aspect-video rounded-lg overflow-hidden">
        <IosThumbnail url={url} />
      </div>
    );
  }

  return (
    <ReactPlayer url={url} width="100%" wrapper={EmbeddedVideoCardWrapper} />
  );
}
