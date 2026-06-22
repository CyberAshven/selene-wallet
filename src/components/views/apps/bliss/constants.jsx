import { DateTime } from "luxon";

import { BCH_PODCAST_LIVE_URL, SELENE_ASSETS_URL } from "@/util/apps";

// Re-export shared constants for backward compatibility
export { SELENE_ASSETS_URL, BCH_PODCAST_LIVE_URL };

export const BLISS_2026_START_DATE = new Date("2026-05-15T09:00:00+02:00");
export const BLISS_2026_END_DATE = new Date("2026-05-17T23:00:00+02:00");
export const BLISS_2026_GRACE_PERIOD = DateTime.fromJSDate(
  BLISS_2026_END_DATE
).plus({
  weeks: 3,
});
export const BLISS_2026_TOKEN_HUNT_START_DATE = new Date(
  "2026-05-14T12:00:00+02:00"
);

export const BLISS_ABOUT_VIDEO_URL =
  "https://www.youtube.com/watch?v=ddVj8LepAPs&pp=0gcJCX4JAYcqIYzv";
export const LAYLA_VIDEO_URL = "https://www.youtube.com/watch?v=adF_Y7y5eiI";
export const BLISS_HOME_URL = "https://bliss.cash";
export const TAPSWAP_TICKETS_URL =
  "https://tapswap.cash/trade/5a4f6b25243c1a2dabb2434e3d9e574f65c31764ce0e7eb4127a46fa74657691";

export const TICKETS_READ_MORE_URL = "https://bliss.cash/2025#tickets";
export const TAPSWAP_TUTORIAL_VIDEO_URL =
  "https://www.youtube.com/watch?v=kzbIJ6pDV8E";
