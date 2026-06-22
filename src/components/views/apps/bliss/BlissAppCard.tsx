import { Link } from "react-router";
import { DateTime, Interval } from "luxon";
import { ArrowRightOutlined } from "@ant-design/icons";

import useRealTime from "@/hooks/useRealTime";

import { translate } from "@/util/translations";
import translations from "./translations";

import {
  BCH_PODCAST_LIVE_URL,
  BLISS_2026_END_DATE,
  BLISS_2026_START_DATE,
  SELENE_ASSETS_URL,
} from "./constants.jsx";

const pad = (value: number) => value.toString().padStart(2, "0");

function BlissAppCard() {
  const now = useRealTime(1000);

  const isBefore = now.valueOf() < BLISS_2026_START_DATE.valueOf();

  const isDuring =
    now.valueOf() >= BLISS_2026_START_DATE.valueOf() &&
    now.valueOf() <= BLISS_2026_END_DATE.valueOf();

  const isAfter = now.valueOf() > BLISS_2026_END_DATE.valueOf();

  const interval = Interval.fromDateTimes(now, BLISS_2026_START_DATE);

  const days = Math.floor(interval.length("hours") / 24);
  const hours = pad(Math.floor(interval.length("hours") % 24));
  const minutes = pad(Math.floor(interval.length("minutes") % 60));
  const seconds = pad(Math.floor(interval.length("seconds") % 60));

  let description = translate(translations.startingIn);

  if (isAfter) {
    description = translate(translations.watchVideos);
  } else if (isDuring) {
    description = translate(translations.watchLive);
  }

  return (
    <Link
      to={isDuring ? BCH_PODCAST_LIVE_URL : "/apps/bliss/about"}
      className="block relative"
    >
      <img
        src={`${SELENE_ASSETS_URL}bliss-layla.png`}
        className="w-full object-cover object-top max-h-96"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm text-neutral-50 p-6 flex justify-between items-center">
        <div className="h-fit">
          <div className="font-bold text-xl mb-2">
            <span className="font-bliss">BLISS 2026</span>
          </div>

          <div className="leading-[1rem]">
            {description}{" "}
            {isBefore && (
              <span className="font-mono">
                {days}d:
                {hours}h:
                {minutes}m:
                {seconds}s
              </span>
            )}
          </div>

          <div className="leading-[1rem] mt-4">
            {isBefore && (
              <span>{translate(translations.ticketsAvailableNow)}</span>
            )}
          </div>
        </div>
        <ArrowRightOutlined className="text-xl" />
      </div>
    </Link>
  );
}

export default BlissAppCard;
