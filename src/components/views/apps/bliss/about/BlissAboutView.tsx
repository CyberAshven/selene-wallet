import { Interval } from "luxon";
import { LinkOutlined } from "@ant-design/icons";

import Card from "@/atoms/Card";
import { EmbeddedVideoCard } from "@/atoms/EmbeddedVideo";
import LinkExternal from "@/atoms/LinkExternal";

import { translate } from "@/util/translations";
import translations from "../translations";

import {
  BLISS_2026_END_DATE,
  BLISS_2026_START_DATE,
  BLISS_ABOUT_VIDEO_URL,
  BLISS_HOME_URL,
  LAYLA_VIDEO_URL,
} from "../constants.jsx";

const interval = Interval.fromDateTimes(
  BLISS_2026_START_DATE,
  BLISS_2026_END_DATE
);

function BlissAboutView() {
  return (
    <div className="p-2 flex flex-col gap-y-2">
      <Card className="p-2">
        <div className="rounded-md bg-primary-50 dark:bg-neutral-700 p-2">
          <h1 className="font-bliss text-2xl text-center bg-[linear-gradient(to_bottom,_rgb(232,_7,_140),_rgb(160,_137,_191))] bg-clip-text text-transparent">
            BLISS 2026: Layla
          </h1>
          <h2 className="text-center">Ljubljana, Slovenia</h2>
          <h3 className="text-md text-center font-semibold">
            {interval.toLocaleString({
              dateStyle: "long",
            })}
          </h3>
        </div>
        <div className="p-2">{translate(translations.intro)}</div>
        <div className="mt-1 rounded-md flex flex-col border dark:border-primarydark-400 border-primary-700 bg-white dark:bg-neutral-1000">
          <LinkExternal to={BLISS_HOME_URL}>
            <div className="text-primary-700 dark:text-primarydark flex items-center gap-2 w-full p-3 border-b border-[#ececec] last:border-b-0">
              <LinkOutlined />
              <span className="flex-1 font-bold">bliss.cash</span>
              <span>→</span>
            </div>
          </LinkExternal>
        </div>
      </Card>

      <Card className="p-2">
        <h2 className="font-bold text-xl text-center p-2">
          {translate(translations.about)}
        </h2>
        <EmbeddedVideoCard url={BLISS_ABOUT_VIDEO_URL} />
      </Card>

      <Card className="p-2">
        <h2 className="font-bold text-xl text-center p-2">
          {translate(translations.laylaUpgrade)}
        </h2>
        <EmbeddedVideoCard url={LAYLA_VIDEO_URL} />
      </Card>
    </div>
  );
}

export default BlissAboutView;
