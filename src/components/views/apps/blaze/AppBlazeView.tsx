//import { BankOutlined, InfoCircleOutlined } from "@ant-design/icons";

//import NavTab from "@/components/layout/NavTab";
import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";

import BlazeAboutView from "./about/BlazeAboutView";

function AppBlazeView() {
  return (
    <FullColumn>
      <ViewHeader
        title={<span className="font-bliss">BCH BLAZE</span>}
        close="/explore"
      />
      {/*<div className="flex">
        <NavTab
          to="/apps/blaze/about"
          label={"About"}
          icon={InfoCircleOutlined}
          activeIcon={InfoCircleOutlined}
        />
        </div>*/}

      <FullColumn>
        <BlazeAboutView />
      </FullColumn>
    </FullColumn>
  );
}

export default AppBlazeView;
