import {
  GlobalOutlined,
  LikeOutlined,
  MailOutlined,
  PlayCircleOutlined,
  QuestionCircleOutlined,
  XOutlined,
} from "@ant-design/icons";
import { TelegramFilled } from "@/icons/TelegramFilled";

import ExploreApp from "@/views/explore/ExploreApp";
import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";
import Card from "@/atoms/Card";
import EmbeddedVideo from "@/atoms/EmbeddedVideo";
import SeleneLogo from "@/atoms/SeleneLogo";

import { translate } from "@/util/translations";
import translations from "./translations";

const INTRODUCTION_VIDEO_URL = "https://youtu.be/AYE6dbuttr8";

export default function AppIntroVideoView() {
  return (
    <FullColumn>
      <ViewHeader
        title={translate(translations.introductionVideo)}
        icon={PlayCircleOutlined}
        close="/explore"
      />
      <div className="flex flex-col gap-2 p-1.5">
        <Card className="p-2">
          <EmbeddedVideo url={INTRODUCTION_VIDEO_URL} />
        </Card>
        <Card className="p-2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center text-xl font-bold">
              <SeleneLogo className="w-12 mr-1" />
              <span>Need Help?</span>
            </div>
            <ExploreApp
              icon={TelegramFilled}
              name={translate(translations.telegram)}
              to="https://t.me/SeleneWallet"
              external
            />
            <ExploreApp
              icon={MailOutlined}
              name={translate(translations.email)}
              to="mailto:support@selene.cash"
              external
            />
            <ExploreApp
              icon={GlobalOutlined}
              name={translate(translations.website)}
              to="https://selene.cash"
              external
            />
            <ExploreApp
              icon={XOutlined}
              name={translate(translations.xtwitter)}
              to="https://x.com/SeleneWallet"
              external
            />
          </div>
        </Card>
      </div>
    </FullColumn>
  );
}
