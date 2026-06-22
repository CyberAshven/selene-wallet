import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Outlet, useLocation } from "react-router";
import {
  BankOutlined,
  DeploymentUnitOutlined,
  MoneyCollectOutlined,
  SettingOutlined,
} from "@ant-design/icons";

import { setPreference } from "@/redux/preferences";
import { selectActiveWallet } from "@/redux/wallet";

import FullColumn from "@/layout/FullColumn";
import NavTab from "@/layout/NavTab";
import ViewHeader from "@/layout/ViewHeader";

import { translate } from "@/util/translations";
import translations from "./translations";

function AssetsViewAccessory() {
  return (
    <Link to="/settings" className="flex items-center justify-center">
      <SettingOutlined className="text-2xl ml-2" />
    </Link>
  );
}

export default function AssetsView() {
  const dispatch = useDispatch();
  const location = useLocation();

  const wallet = useSelector(selectActiveWallet);

  useEffect(
    function updateLastAssetsPath() {
      const pathSplit = location.pathname.split("/");
      if (pathSplit.length > 2) {
        const path = pathSplit.slice(0, 3).join("/");
        dispatch(
          setPreference({
            key: "lastAssetsPath",
            value: path,
          })
        );
      }
    },
    [location, dispatch]
  );

  return (
    <FullColumn>
      <ViewHeader
        icon={BankOutlined}
        title={translate(translations.assets)}
        accessory={AssetsViewAccessory}
      />
      <FullColumn>
        <div className="flex">
          <NavTab
            to="/assets/tokens"
            label={translate(translations.tokens)}
            icon={DeploymentUnitOutlined}
            activeIcon={DeploymentUnitOutlined}
          />
          <NavTab
            to="/assets/coins"
            label={translate(translations.coins)}
            icon={MoneyCollectOutlined}
            activeIcon={MoneyCollectOutlined}
          />
        </div>
        <Outlet context={wallet} />
      </FullColumn>
    </FullColumn>
  );
}
