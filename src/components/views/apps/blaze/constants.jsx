import { DateTime } from "luxon";

import { BCH_PODCAST_LIVE_URL, SELENE_ASSETS_URL } from "@/util/apps";

// Re-export shared constants for backward compatibility
export { SELENE_ASSETS_URL, BCH_PODCAST_LIVE_URL };

export const BLAZE_2025_SHOW_CARD_DATE = new Date("2025-10-25T14:00:00+00:00");
export const BLAZE_2025_WORKSHOP_1_DATE = new Date("2025-10-25T14:00:00+00:00");
export const BLAZE_2025_WORKSHOP_2_DATE = new Date("2025-11-01T14:00:00+00:00");
export const BLAZE_2025_WORKSHOP_3_DATE = new Date("2025-11-08T18:00:00+00:00");

export const BLAZE_2025_END_DATE = new Date("2025-11-28T00:00:00+02:00");

export const BLAZE_2025_HIDE_CARD_DATE = DateTime.fromJSDate(
  BLAZE_2025_END_DATE
).plus({
  weeks: 2,
});

export const BLAZE_EVENTS = [
  {
    id: 0,
    name: "Blaze Hackathon",
    startTime: new Date("2025-10-17T14:00:00+00:00"),
    endTime: new Date("2025-10-17T13:59:59+00:00"),
    thumbnail: "hacking-begins.jpg",
  },
  {
    id: 1,
    name: "Information Session",
    startTime: new Date("2025-10-18T14:00:00+00:00"),
    endTime: new Date("2025-10-18T16:00:00+00:00"),
    thumbnail: "hacking-begins.jpg",
  },
  {
    id: 2,
    name: "Workshop 1 - Mathieu Geukens",
    startTime: new Date("2025-10-25T14:00:00+00:00"),
    endTime: new Date("2025-10-25T16:00:00+00:00"),
    thumbnail: "workshop-1.jpg",
  },
  {
    id: 3,
    name: "Workshop 2 - Mainnet-Pat",
    startTime: new Date("2025-11-01T14:00:00+00:00"),
    endTime: new Date("2025-11-01T16:00:00+00:00"),
    thumbnail: "workshop-2.jpg",
  },
  {
    id: 4,
    name: "Workshop 3 - Kallisti",
    startTime: new Date("2025-11-08T14:00:00+00:00"),
    endTime: new Date("2025-11-08T16:00:00+00:00"),
    thumbnail: "workshop-3.jpg",
  },
  {
    id: 5,
    name: "Hackathon Underway!",
    startTime: new Date("2025-11-15T14:00:00+00:00"),
    endTime: new Date("2025-11-20T16:00:00+00:00"),
    thumbnail: "hacking-begins.jpg",
  },
  {
    id: 6,
    name: "Final Sprint",
    startTime: new Date("2025-11-22T14:00:00+00:00"),
    endTime: new Date("2025-11-23T16:00:00+00:00"),
    thumbnail: "sprint-checkin.jpg",
  },
  {
    id: 7,
    name: "Hackathon Showcase",
    startTime: new Date("2025-11-29T14:00:00+00:00"),
    endTime: new Date("2025-11-29T21:00:00+00:00"),
    thumbnail: "hackathon-showcase.jpg",
  },
];
