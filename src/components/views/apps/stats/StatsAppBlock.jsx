import { useEffect } from "react";
import { Link } from "react-router";
import { useQuery } from "@apollo/client";

import { THIRTY_SECONDS } from "@/util/time";

import { translate } from "@/util/translations";
import translations from "./translations";

import DailyTarget from "./DailyTarget";
import GET_ACTIVE_BITCOINERS_SUMMARY from "./getActiveBitcoinersSummary";

const { seleneActiveUsers } = translations;

export default function StatsAppBlock() {
  const {
    loading: isLoading,
    data,
    startPolling,
    stopPolling,
  } = useQuery(GET_ACTIVE_BITCOINERS_SUMMARY);

  useEffect(() => {
    startPolling(THIRTY_SECONDS);

    return stopPolling;
  }, [startPolling, stopPolling]);

  const isDataUnavailable = isLoading || !data;

  const {
    dailyActiveCount,
    dailyActivePreviousCount,
    weeklyActiveCount,
    weeklyActivePreviousCount,
    monthlyActiveCount,
    monthlyActivePreviousCount,
    yearlyActiveCount,
    yearlyActivePreviousCount,
  } = data?.activeBitcoinersSummary || {};

  const dailyChange = dailyActiveCount - dailyActivePreviousCount;
  const dailyChangePercentage =
    ((100 / dailyActivePreviousCount) * dailyChange)?.toFixed(1) || 0;
  const isDailyActiveIncrease = dailyChange >= 0;

  const weeklyChange = weeklyActiveCount - weeklyActivePreviousCount;
  const weeklyChangePercentage =
    ((100 / weeklyActivePreviousCount) * weeklyChange)?.toFixed(1) || 0;
  const isWeeklyActiveIncrease = weeklyChange >= 0;

  const monthlyChange = monthlyActiveCount - monthlyActivePreviousCount;
  const monthlyChangePercentage =
    ((100 / monthlyActivePreviousCount) * monthlyChange)?.toFixed(1) || 0;
  const isMonthlyActiveIncrease = monthlyChange >= 0;

  const yearlyChange = yearlyActiveCount - yearlyActivePreviousCount;
  const yearlyChangePercentage =
    ((100 / yearlyActivePreviousCount) * yearlyChange)?.toFixed(1) || 0;
  const isYearlyActiveIncrease = yearlyChange >= 0;

  return (
    <div className="p-2 rounded bg-primary-50 flex justify-between items-center border border-primary-300 dark:bg-neutral-800 dark:border-primarydark-200">
      <Link to="#d">
        <div className="p-1 mx-1">
          <div className="font-bold text-neutral-600 dark:text-neutral-200">
            24h
          </div>
          <div
            className={`${isDailyActiveIncrease ? "text-success" : "text-error"} text-lg font-semibold`}
          >
            {isDataUnavailable ? "-" : dailyActiveCount}
          </div>
          <div
            className={`text-xs ${isDailyActiveIncrease ? "text-success" : "text-error"}`}
          >
            {isDailyActiveIncrease ? "↑" : "↓"} {isDailyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : dailyChange} (
            {isDailyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : dailyChangePercentage}%)
          </div>
        </div>
      </Link>

      <Link to="#w">
        <div className="p-1 mx-1">
          <div className="font-bold text-neutral-600 dark:text-neutral-200">
            7d
          </div>
          <div
            className={`${isWeeklyActiveIncrease ? "text-primary" : "text-error"} text-lg font-semibold`}
          >
            {isDataUnavailable ? "-" : weeklyActiveCount}
          </div>
          <div
            className={`text-xs ${isWeeklyActiveIncrease ? "text-primary" : "text-error"}`}
          >
            {isWeeklyActiveIncrease ? "↑" : "↓"} {isWeeklyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : weeklyChange} (
            {isWeeklyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : weeklyChangePercentage}%)
          </div>
        </div>
      </Link>

      <Link to="#m">
        <div className="p-1 mx-1">
          <div className="font-bold text-neutral-600 dark:text-neutral-200">
            30d
          </div>
          <div
            className={`${isMonthlyActiveIncrease ? "text-primary" : "text-error"} text-lg font-semibold`}
          >
            {isDataUnavailable ? "-" : monthlyActiveCount}
          </div>
          <div
            className={`text-xs ${isMonthlyActiveIncrease ? "text-primary" : "text-error"}`}
          >
            {isMonthlyActiveIncrease ? "↑" : "↓"}{" "}
            {isMonthlyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : monthlyChange} (
            {isMonthlyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : monthlyChangePercentage}%)
          </div>
        </div>
      </Link>

      <Link to="#y">
        <div className="p-1 mx-1">
          <div className="font-bold text-neutral-600 dark:text-neutral-200">
            1y
          </div>
          <div
            className={`${isYearlyActiveIncrease ? "text-primary" : "text-error"} text-lg font-semibold`}
          >
            {isDataUnavailable ? "-" : yearlyActiveCount}
          </div>
          <div
            className={`text-xs ${isYearlyActiveIncrease ? "text-primary" : "text-error"}`}
          >
            {isYearlyActiveIncrease ? "↑" : "↓"} {isYearlyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : yearlyChange} (
            {isYearlyActiveIncrease && "+"}
            {isDataUnavailable ? "-" : yearlyChangePercentage}%)
          </div>
        </div>
      </Link>
    </div>
  );
}
