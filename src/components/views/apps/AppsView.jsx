import { useSelector } from "react-redux";
import {
  LaptopOutlined,
  LineChartOutlined,
  ProductOutlined,
  QrcodeOutlined,
} from "@ant-design/icons";

import { selectIsExperimental } from "@/redux/preferences";

import ExploreApp from "@/views/explore/ExploreApp";
import translations from "@/views/explore/translations";
import ViewHeader from "@/layout/ViewHeader";

import { translate } from "@/util/translations";

export default function AppsView() {
  const isExperimental = useSelector(selectIsExperimental);

  return (
    <>
      <ViewHeader icon={ProductOutlined} title="Apps" back="/explore" />
      <div className="p-1 flex flex-col gap-2">
        <ExploreApp
          icon={LineChartOutlined}
          name={translate(translations.statistics)}
          to="/apps/stats"
        />
        {isExperimental && <ExperimentalApps />}
      </div>
    </>
  );
}

function ExperimentalApps() {
  return (
    <>
      <ExploreApp
        icon={LaptopOutlined}
        name="A Fifth Of Gaming"
        to="/apps/afog"
      />
      <ExploreApp
        icon={QrcodeOutlined}
        name="QR Code Generator"
        to="/apps/qrgen"
      />
    </>
  );
}
