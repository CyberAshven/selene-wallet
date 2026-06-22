import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";

import { translate } from "@/util/translations";
import translations from "./translations";

import StatsGraphCard from "./StatsGraphCard";

export default function AppStatsView() {
  return (
    <FullColumn>
      <ViewHeader
        title={translate(translations.seleneActiveUsers)}
        close="/explore"
      />
      <div className="p-1 flex flex-col gap-1">
        <StatsGraphCard />
      </div>
    </FullColumn>
  );
}
