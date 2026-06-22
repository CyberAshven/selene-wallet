/* eslint-disable react/prop-types */
import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { DateTime } from "luxon";

import { Period } from "@/util/time";

import { translate } from "@/util/translations";

import translations from "./ActiveUsersChartTranslations";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function ActiveUsersChart({ data, period }) {
  const { activeBitcoiners } = data;

  // parse counts to numbers and adjust the last data point
  const counts = useMemo(
    () => activeBitcoiners.map((item) => Number.parseInt(item.count)),
    [activeBitcoiners]
  );

  const n = counts.length;
  const normalizedCounts = [...counts];
  while (normalizedCounts[0] === 0) {
    normalizedCounts.shift();
  }

  // remove leading zeroes from data (prevents skewed average for Yearly)
  const sum = normalizedCounts.reduce((acc, cur) => acc + cur, 0);
  const averageCount = Math.floor(sum / normalizedCounts.length);
  const normalizedDataPoints = [...counts.slice(0, n - 1), averageCount];

  // calculate maxCount from the updated dataPoints
  const maxCount = Math.max(...counts);
  const maxCountRoundedUpToNearest10 = Math.ceil(maxCount / 10) * 10;

  const chartData = useMemo(() => {
    // generate labels based on dates and period
    const labels = activeBitcoiners.map(({ date }) => {
      switch (period) {
        case Period.Weekly:
          return `${DateTime.fromISO(date).toLocaleString({
            month: "numeric",
            day: "numeric",
          })} - ${DateTime.fromISO(date).plus({ days: 6 }).toLocaleString({
            month: "numeric",
            day: "numeric",
          })}`;
        case Period.Monthly:
          return DateTime.fromISO(date).toLocaleString({
            month: "short",
          });
        case Period.Yearly:
          return DateTime.fromISO(date).toLocaleString({
            year: "numeric",
          });
        default: // Period.Daily
          return DateTime.fromISO(date).toLocaleString({
            month: "short",
            day: "numeric",
          });
      }
    });

    // chart data with dashed line between last two points
    const primaryColor = "rgba(148, 195, 82, 1)";
    const projectionColor = "rgba(211, 209, 201, 1)";

    return {
      labels,
      datasets: [
        {
          label: translate(translations.activeSeleneUsers),
          data: normalizedDataPoints,
          borderColor: primaryColor,
          backgroundColor: primaryColor,
          segment: {
            borderDash: (ctx) =>
              ctx.p0DataIndex === n - 2 ? [5, 5] : undefined,
          },
          borderWidth: 3,
        },
        {
          label: translate(translations.activeSeleneUsers),
          data: counts,
          borderColor: projectionColor,
          backgroundColor: projectionColor,
          segment: {
            borderDot: (ctx) =>
              ctx.p0DataIndex === n - 2 ? [5, 5] : undefined,
          },
          borderWidth: 3,
        },
      ],
    };
  }, [activeBitcoiners]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        display: false,
      },
      title: {
        display: false,
        text: "Chart.js Line Chart",
      },
    },
    scales: {
      y: {
        min: 0,
        max: maxCountRoundedUpToNearest10,
      },
    },
  };

  return (
    <div className="flex justify-center items-center">
      <Line options={options} data={chartData} />
    </div>
  );
}

export default ActiveUsersChart;
