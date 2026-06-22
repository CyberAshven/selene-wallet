/* eslint-disable react/jsx-props-no-spreading */
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { animated, useSpring } from "@react-spring/web";
import {
  CheckCircleFilled,
  DisconnectOutlined,
  SyncOutlined,
} from "@ant-design/icons";

import {
  selectIsExperimental,
  selectIsOfflineMode,
  selectShouldDisplaySyncCounter,
} from "@/redux/preferences";
import {
  selectIsConnected,
  selectIsSyncing,
  selectSyncCount,
  syncHotRefresh,
  syncReconnect,
} from "@/redux/sync";
import { selectActiveWalletHash } from "@/redux/wallet";

import NotificationService from "@/kernel/app/NotificationService";

import { useLongPress } from "@/hooks/useLongPress";

export default function SyncIndicator() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const walletHash = useSelector(selectActiveWalletHash);
  const isConnected = useSelector(selectIsConnected);
  const isOfflineMode = useSelector(selectIsOfflineMode);
  const isSyncing = useSelector(selectIsSyncing);
  const isExperimental = useSelector(selectIsExperimental);

  const [disconnectSprings, disconnectApi] = useSpring(() => ({
    from: { opacity: 0.0333 },
    to: { opacity: 0.667 },
    loop: true,
    delay: 3333,
    config: {
      mass: 33,
      tension: 50,
      friction: 10,
    },
  }));

  // connection icon starts bright and dims out
  const [connectSprings, connectApi] = useSpring(() => ({
    from: { opacity: 0.5, scale: 0.75 },
    to: { opacity: 0.25, scale: 0.65 },
    immediate: true,
    config: {
      mass: 0.6,
      tension: 80,
      friction: 50,
    },
  }));

  const handlePointerDown = useCallback(
    (event) => {
      if (!event) {
        return;
      }

      if (isConnected) {
        connectApi.start({
          from: { opacity: 0.8, scale: 0.85 },
          to: { opacity: 0.2, scale: 0.65 },
        });

        dispatch(syncHotRefresh({ force: false }));
      } else {
        disconnectApi.start();
        NotificationService().disconnected();
        dispatch(syncReconnect());
      }
    },
    [isConnected, dispatch, disconnectApi, connectApi]
  );

  const handleLongPress = useCallback(() => {
    if (!isExperimental) {
      return;
    }

    navigate(`/settings/wallet/${walletHash}/scan`);
  }, [isExperimental, navigate, walletHash]);

  const longPressEvents = useLongPress(
    handleLongPress,
    handlePointerDown,
    1000
  );

  return (
    <div
      className="cursor-pointer w-10 h-10 flex justify-center items-center"
      data-testid="sync-indicator"
      data-syncing={isSyncing ? "true" : "false"}
      {...longPressEvents}
    >
      {isOfflineMode && (
        <DisconnectOutlined className="text-neutral-500 text-2xl text-center" />
      )}
      {!isConnected && !isOfflineMode && (
        <DisconnectedIcon springs={{ ...disconnectSprings }} />
      )}
      {isConnected &&
        (isSyncing ? (
          <div className="flex flex-col items-center">
            <SyncOutlined className="text-info text-xl text-neutral-500" spin />
            <SyncCounter />
          </div>
        ) : (
          <ConnectedIcon springs={{ ...connectSprings }} />
        ))}
    </div>
  );
}

function SyncCounter() {
  const shouldDisplaySyncCounter = useSelector(selectShouldDisplaySyncCounter);
  const syncCount = useSelector(selectSyncCount);
  return shouldDisplaySyncCounter ? (
    <div className="text-xs text-neutral-500 mt-0.5">{syncCount}</div>
  ) : null;
}

/* eslint-disable react/prop-types */
function DisconnectedIcon({ springs }) {
  return (
    <animated.div style={springs}>
      <DisconnectOutlined className="text-error text-2xl text-center" />
    </animated.div>
  );
}

function ConnectedIcon({ springs }) {
  return (
    <animated.div style={springs}>
      <CheckCircleFilled className="text-primary text-3xl text-center" />
    </animated.div>
  );
}
