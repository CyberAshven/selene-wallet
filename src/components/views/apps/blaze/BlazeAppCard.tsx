import { Link } from "react-router";
import { Interval } from "luxon";
import { ArrowRightOutlined } from "@ant-design/icons";

import useRealTime from "@/hooks/useRealTime";

import {
  BCH_PODCAST_LIVE_URL,
  BLAZE_EVENTS,
  SELENE_ASSETS_URL,
} from "./constants.jsx";

const pad = (value: number) => value.toString().padStart(2, "0");

function BlazeAppCard() {
  const now = useRealTime(1000);

  const filtered = BLAZE_EVENTS.filter(
    (e) => now.valueOf() < e?.endTime.valueOf()
  );
  const nextEvent = filtered[0] || BLAZE_EVENTS[BLAZE_EVENTS.length - 1];

  const isDuring =
    now.valueOf() >= nextEvent.startTime.valueOf() &&
    now.valueOf() <= nextEvent.endTime.valueOf();

  const interval = Interval.fromDateTimes(now, nextEvent.startTime);

  const days = Math.floor(interval.length("hours") / 24);
  const hours = pad(Math.floor(interval.length("hours") % 24));
  const minutes = pad(Math.floor(interval.length("minutes") % 60));
  const seconds = pad(Math.floor(interval.length("seconds") % 60));

  return (
    <Link
      to={isDuring ? BCH_PODCAST_LIVE_URL : "/apps/blaze"}
      className="bg-black h-full flex flex-col"
    >
      <img
        src={`${SELENE_ASSETS_URL}${nextEvent.thumbnail}`}
        className="w-full"
      />
      <div className="bg-black text-neutral-50 p-6 flex justify-between items-center h-full">
        <div className="h-fit">
          <div className="font-bold text-xl mb-2">
            <span className="font-bliss">BCH BLAZE</span>
          </div>

          <div className="leading-[1rem]">
            <span>{nextEvent.name}</span>
          </div>

          <div className="leading-[1rem] mt-4">
            {isDuring ? (
              "Live!"
            ) : (
              <span>
                <span>Starts in: </span>
                <span className="font-mono">
                  {days}d:
                  {hours}h:
                  {minutes}m:
                  {seconds}s
                </span>
              </span>
            )}
          </div>
        </div>
        <ArrowRightOutlined className="text-xl" />
      </div>
    </Link>
  );
}

export default BlazeAppCard;
