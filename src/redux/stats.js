import { createAsyncThunk } from "@reduxjs/toolkit";
import { DateTime } from "luxon";

import { selectDeviceInfo } from "@/redux/device";
import {
  selectIsOfflineMode,
  selectLastCheckIn,
  selectPrivacySettings,
  setPreference,
} from "@/redux/preferences";
import { selectGenesisHeight } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";

const Log = LogService("redux/stats");

// triggerCheckIn: run a daily check in, if current time UTC is on a date later than previous check in
// TODO: check-in interval should be enforced server-side per device ID
export const triggerCheckIn = createAsyncThunk(
  "stats/submitCheckIn",
  async (payload, thunkApi) => {
    const isOfflineMode = selectIsOfflineMode(thunkApi.getState());
    if (isOfflineMode) {
      Log.log("stats/submitCheckIn blocked by offline mode");
      return;
    }

    const { isDailyCheckInEnabled } = selectPrivacySettings(
      thunkApi.getState()
    );

    if (!isDailyCheckInEnabled) {
      Log.log("stats/submitCheckIn blocked by user preference");
      return;
    }

    const genesis_height = selectGenesisHeight(thunkApi.getState());

    if (!genesis_height) {
      Log.debug("stats/submitCheckIn blocked - no genesis height");
      return;
    }

    const lastCheckIn = selectLastCheckIn(thunkApi.getState());

    const now = DateTime.utc();
    const defaultLastCheckInMoment = now
      .minus({ days: 1 })
      .startOf("day")
      .plus({ seconds: 1 });

    const lastCheckInMoment =
      lastCheckIn === ""
        ? defaultLastCheckInMoment
        : DateTime.fromISO(lastCheckIn).startOf("day").plus({ seconds: 1 });

    const nextCheckIn = lastCheckInMoment.plus({ days: 1 }).startOf("day");

    const isShouldCheckIn = lastCheckIn === "" || now > nextCheckIn;

    if (!isShouldCheckIn) {
      Log.debug(
        "stats/submitCheckIn skipped - nextCheckIn is",
        nextCheckIn.toString()
      );
      return;
    }

    const { deviceIdHash } = selectDeviceInfo(thunkApi.getState());

    Log.debug("sending checkin", {
      lastCheckIn,
      deviceIdHash,
    });

    const nowFormatted = now.toFormat("yyyyLLdd"); // LL is month, 2 digit padded

    const [{ gql }, { default: apolloClient }] = await Promise.all([
      import("@apollo/client"),
      import("@/apolloClient"),
    ]);

    const SEND_DAILY_CHECK_IN = gql`
      mutation SendCheckIn($hashedDeviceId: String!, $date: String!) {
        sendCheckIn(hashedDeviceId: $hashedDeviceId, date: $date) {
          status
        }
      }
    `;

    const result = await apolloClient.mutate({
      mutation: SEND_DAILY_CHECK_IN,
      variables: {
        hashedDeviceId: deviceIdHash,
        date: nowFormatted,
      },
    });

    if (result) {
      Log.debug("check-in successful");
      thunkApi.dispatch(
        setPreference({ key: "lastCheckIn", value: nowFormatted })
      );
    }
  }
);
