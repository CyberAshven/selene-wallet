import { Outlet } from "react-router";
import { BugOutlined } from "@ant-design/icons";

import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";

import { translate } from "@/util/translations";
import translations from "./translations";

export default function DebugView() {
  return (
    <FullColumn>
      <ViewHeader
        icon={BugOutlined}
        title={translate(translations.debug)}
        back={-1}
      />
      <Outlet />
    </FullColumn>
  );
}
