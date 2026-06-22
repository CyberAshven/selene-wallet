import { Interval } from "luxon";
import { LinkOutlined } from "@ant-design/icons";

import FullColumn from "@/layout/FullColumn";
import Card from "@/components/atoms/Card";
import { EmbeddedVideoCard } from "@/components/atoms/EmbeddedVideo";
import LinkExternal from "@/components/atoms/LinkExternal";

import { translate } from "@/util/translations";
import translations from "../translations";

import { BLAZE_EVENTS, SELENE_ASSETS_URL } from "../constants.jsx";

const BLAZE_INFORMATION_STREAM_URL =
  "https://www.youtube.com/watch?v=EufKujsTQGc";
const BLAZE_DORAHACKS_URL =
  "https://dorahacks.io/hackathon/bchblaze2025/detail";

const interval = Interval.fromDateTimes(
  BLAZE_EVENTS[0].startTime,
  new Date("2025-11-29T21:00:00+00:00")
);

function BlazeAboutView() {
  return (
    <div className="p-2 flex flex-col gap-y-2">
      <Card className="p-2">
        <div className="rounded-md bg-primary-50 dark:bg-neutral-700 p-2">
          <h1 className="font-bliss text-2xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-t from-neutral-600 to-[#f20e38]">
            BCH BLAZE
          </h1>
          <h2 className="text-center">Online Hackathon</h2>
          <h3 className="text-md text-center font-semibold">
            {interval.toLocaleString({
              dateStyle: "long",
            })}
          </h3>
        </div>
        <div className="p-2">{translate(translations.intro)}</div>
        <div className="mt-1 rounded-md flex flex-col border dark:border-primarydark-400 border-primary-700 bg-white dark:bg-neutral-1000">
          <LinkExternal to={BLAZE_DORAHACKS_URL}>
            <div className="text-primary-700 dark:text-primarydark flex items-center gap-2 w-full p-3 border-b border-[#ececec] last:border-b-0">
              <LinkOutlined />{" "}
              <span className="flex-1 font-bold">
                DoraHacks Sign Up & Information
              </span>{" "}
              <span>→</span>
            </div>
          </LinkExternal>
        </div>
      </Card>

      <Card>
        <h1 className="font-bliss text-2xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-t from-neutral-600 to-[#f20e38] p-2">
          BLAZE SCHEDULE
        </h1>

        <div className="rounded-md overflow-hidden">
          <LinkExternal to={`${SELENE_ASSETS_URL}Schedule.png`}>
            <img
              src={`${SELENE_ASSETS_URL}Schedule.png`}
              className="w-full h-64"
            />
          </LinkExternal>
        </div>
      </Card>

      <Card>
        <h1 className="font-bliss text-2xl text-center font-bold bg-clip-text text-transparent bg-gradient-to-t from-neutral-600 to-[#f20e38] p-2">
          BLAZE INFO SESSION
        </h1>
        <EmbeddedVideoCard url={BLAZE_INFORMATION_STREAM_URL} />
      </Card>
    </div>
  );
}

export default BlazeAboutView;
