/* eslint-disable no-unsafe-optional-chaining */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ApolloProvider, useQuery } from "@apollo/client";
import { SyncOutlined } from "@ant-design/icons";

import Button from "@/atoms/Button";
import Card from "@/atoms/Card";
import SeleneLogo from "@/atoms/SeleneLogo";

import { ONE_SECOND, Period } from "@/util/time";
import apolloClient from "@/apolloClient";

import { translate } from "@/util/translations";

import ActiveUsersChart from "./ActiveUsersChart";
import GET_ACTIVE_BITCOINERS from "./getActiveBitcoiners";
import translations from "./GlobalAdoptionSummaryTranslations";
import StatsAppBlock from "./StatsAppBlock";

function StatsGraphCard() {
  const navigate = useNavigate();
  const { hash: locationHash } = useLocation();

  const periodHashMap = {
    "#d": Period.Daily,
    "#w": Period.Weekly,
    "#m": Period.Monthly,
    "#y": Period.Yearly,
  };

  const period = periodHashMap[locationHash || "#d"];

  const {
    loading: isLoading,
    data,
    startPolling,
    stopPolling,
  } = useQuery(GET_ACTIVE_BITCOINERS, {
    variables: {
      period,
    },
  });

  useEffect(
    function initializePolling() {
      startPolling(ONE_SECOND * 60);

      return stopPolling;
    },
    [startPolling, stopPolling]
  );

  const isReady = !isLoading && data && data.activeBitcoiners;

  return (
    <Card className="rounded-none w-full border-0 shadow-none p-2">
      <div className="flex items-center mb-1.5">
        <SeleneLogo className="w-12 mr-1" />
        <div>
          <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {translate(translations.globalAdoption)}
          </span>
          <div className="text-lg font-bold text-neutral-700 dark:text-neutral-200">
            {translate(translations.activeSeleneUsers)}
          </div>
        </div>
      </div>

      <div className="my-1">
        <StatsAppBlock />
      </div>

      <div className="bg-primary-50 dark:bg-primarydark-50 my-2 p-2 rounded border border-primary-300 dark:border-primarydark-200">
        {!isReady && (
          <div className="flex items-center justify-center">
            <SyncOutlined className="text-4xl" spin />
          </div>
        )}
        {isReady && <ActiveUsersChart data={data} period={period} />}
      </div>

      <div className="w-full flex flex-wrap justify-around items-center py-0.5">
        <Button
          label={translate(translations.daily)}
          labelSize="md"
          rounded="lg"
          padding="2"
          onClick={() => navigate("#d")}
        />
        <Button
          label={translate(translations.weekly)}
          labelSize="md"
          rounded="lg"
          padding="2"
          onClick={() => navigate("#w")}
        />
        <Button
          label={translate(translations.monthly)}
          labelSize="md"
          rounded="lg"
          padding="2"
          onClick={() => navigate("#m")}
        />
        <Button
          label={translate(translations.yearly)}
          labelSize="md"
          rounded="lg"
          padding="2"
          onClick={() => navigate("#y")}
        />
      </div>
    </Card>
  );
}

export default function StatsGraphCardWithProvider() {
  return (
    <ApolloProvider client={apolloClient}>
      <StatsGraphCard />
    </ApolloProvider>
  );
}
