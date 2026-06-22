import { Link, Outlet } from "react-router";
import { CompassOutlined, SettingOutlined } from "@ant-design/icons";

import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";

import { translate } from "@/util/translations";
import translations from "./translations";

//import ExploreSearchBar from "./ExploreSearchBar";

function ExploreViewAccessory() {
  return (
    <Link to="/settings" className="flex items-center justify-center">
      <SettingOutlined className="text-2xl ml-2" />
    </Link>
  );
}

export default function ExploreView() {
  return (
    <FullColumn>
      <ViewHeader
        icon={CompassOutlined}
        title={translate(translations.exploreBch)}
        accessory={ExploreViewAccessory}
      />
      {/*<ExploreSearchBar />*/}
      <Outlet />
    </FullColumn>
  );
}
