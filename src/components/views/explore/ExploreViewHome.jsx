import { lazy, Suspense } from "react";
import {
  GlobalOutlined,
  LikeOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

import Card from "@/atoms/Card";
import Carousel from "@/atoms/Carousel";
import SeleneLogo from "@/atoms/SeleneLogo";

import useRealTime from "@/hooks/useRealTime";

import { translate } from "@/util/translations";
import translations from "./translations";

import BlazeAppCard from "../apps/blaze/BlazeAppCard";
import { BLAZE_2025_END_DATE } from "../apps/blaze/constants";
import BlissAppCard from "../apps/bliss/BlissAppCard";
import { BLISS_2026_END_DATE } from "../apps/bliss/constants";
import ExploreApp from "./ExploreApp";

const StatsGraphCard = lazy(() => import("@/apps/stats/StatsGraphCard"));

export default function ExploreViewHome() {
  const now = useRealTime(1000);
  const isBlazeOngoing = now.valueOf() <= BLAZE_2025_END_DATE.valueOf();
  const isBlissOngoing = now.valueOf() <= BLISS_2026_END_DATE.valueOf();

  return (
    <div className="p-1.5 flex flex-col gap-2">
      <Carousel autoRotateInterval={10000}>
        {isBlazeOngoing && <BlazeAppCard />}
        {isBlissOngoing && <BlissAppCard />}
        <Suspense>
          <StatsGraphCard />
        </Suspense>
      </Carousel>
      <Card className="p-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center text-xl font-bold">
            <SeleneLogo className="w-12 mr-1" />
            <span>{translate(translations.learnMore)}</span>
          </div>
          <ExploreApp
            icon={PlayCircleOutlined}
            name={translate(translations.introductionVideo)}
            to="/apps/intro"
          />
          <ExploreApp
            icon={GlobalOutlined}
            name={translate(translations.ecosystem)}
            to="https://minisatoshi.cash/ecosystem"
            external
          />
          <ExploreApp
            icon={QuestionCircleOutlined}
            name={translate(translations.faqs)}
            to="https://bitcoincashpodcast.com/faqs"
            external
          />
          <ExploreApp
            icon={LikeOutlined}
            name={translate(translations.socialMedia)}
            to="https://minisatoshi.cash/#_socials"
            external
          />
        </div>
      </Card>
    </div>
  );
}
