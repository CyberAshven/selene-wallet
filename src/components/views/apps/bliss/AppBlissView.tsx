import { useSelector } from "react-redux";
import { Outlet } from "react-router";
import {
  BankOutlined,
  DeploymentUnitOutlined,
  MoneyCollectOutlined,
} from "@ant-design/icons";

import { selectActiveWallet } from "@/redux/wallet";

import NavTab from "@/components/layout/NavTab";
import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";

import { translate } from "@/util/translations";
import translations from "./translations";

function AppBlissView() {
  const wallet = useSelector(selectActiveWallet);
  // const now = useRealTime(1000);
  // const isTokenHuntAvailable =
  //   now.valueOf() >= BLISS_2026_TOKEN_HUNT_START_DATE.valueOf();

  return (
    <FullColumn>
      <ViewHeader icon={BankOutlined} title={"BLISS 2026"} close="/explore" />
      {/* <div className="flex">
        <NavTab
          to="/apps/bliss/about"
          label={"About"}
          icon={DeploymentUnitOutlined}
          activeIcon={DeploymentUnitOutlined}
        />
        <NavTab
          to="/apps/bliss/tickets"
          label={translate(translations.tickets)}
          icon={MoneyCollectOutlined}
          activeIcon={MoneyCollectOutlined}
        />
        {isTokenHuntAvailable && (
          <NavTab
            to="/apps/bliss/tokenHunt"
            label={"Token Hunt"}
            icon={MoneyCollectOutlined}
            activeIcon={MoneyCollectOutlined}
          />
        )}
      </div> */}
      <Outlet context={wallet} />
    </FullColumn>
  );
}

export default AppBlissView;
