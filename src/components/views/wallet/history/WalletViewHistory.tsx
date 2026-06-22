import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { DateTime } from "luxon";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  FilterOutlined,
  HistoryOutlined,
  HourglassOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  SyncOutlined,
} from "@ant-design/icons";

import {
  selectBchNetwork,
  selectCurrencySettings,
  selectIsExperimental,
  selectPrivacySettings,
} from "@/redux/preferences";
import { selectChaintip, selectSyncState } from "@/redux/sync";
import {
  resetFilters,
  selectSearchQuery,
  selectTransactionHistory,
  selectTransactionHistoryPagination,
  selectTxHistoryFilters,
  setDirection,
  setHasNft,
  setHasToken,
  setSearchQuery,
  setSortDirection,
  setSortField,
  txHistoryFetch,
  txHistoryFetchMore,
} from "@/redux/txHistory";
import { selectActiveWalletHash } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import NotificationService from "@/kernel/app/NotificationService";
import TransactionManagerService from "@/kernel/bch/TransactionManagerService";
import {
  exportHistoryAsCsv,
  prepareTransactionExportData,
} from "@/kernel/wallet/TransactionExportService";
import type { MergedHistoryEntity } from "@/kernel/wallet/TransactionHistoryService";
import TransactionHistoryService from "@/kernel/wallet/TransactionHistoryService";

import ViewHeader from "@/layout/ViewHeader";
import Satoshi from "@/atoms/Satoshi";
import TokenAmount from "@/atoms/TokenAmount";
import TokenSymbol from "@/atoms/TokenSymbol";
import Button from "@/components/atoms/Button";
import Select from "@/components/atoms/Select";

import { translate } from "@/util/translations";
import translations from "../translations";

const Log = LogService("WalletViewHistory");

interface TransactionItemProps {
  tx: MergedHistoryEntity & { block_pos?: number };
  index: number;
  shouldHideBalance: boolean;
}

interface EmptyStateProps {
  syncPending: number;
  searchQuery: string;
}

function useTransactionHistory() {
  const dispatch = useDispatch();
  const txHistory = useSelector(selectTransactionHistory);

  const { hasMore, isLoading } = useSelector(
    selectTransactionHistoryPagination
  );

  useEffect(
    function loadTxHistory() {
      dispatch(txHistoryFetch());
    },
    [dispatch]
  );

  return { txHistory, hasMore, isLoading };
}

function TransactionItem({
  tx,
  index,
  shouldHideBalance,
}: TransactionItemProps) {
  const receiveStyle = "text-success";
  const sendStyle = "text-error";

  const zebraCss = [
    {
      true: "bg-primary-50 dark:bg-primarydark-50 text-neutral-800 dark:text-neutral-200",
      false:
        "bg-neutral-25 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200",
    },
    {
      true: "bg-primary-100 dark:bg-primarydark-100 text-neutral-800 dark:text-neutral-200",
      false:
        "bg-neutral-50 dark:bg-neutral-600 text-neutral-800 dark:text-neutral-200",
    },
  ];

  const txDateTime =
    tx.height <= 0 || !tx.time
      ? DateTime.fromISO(tx.time_seen)
      : DateTime.fromSeconds(tx.time);

  return (
    <li
      key={`${tx.tx_hash}${tx.address}${tx.block_pos}`}
      className={`p-2 ${zebraCss[index % 2][(tx.valueSatoshis > 0).toString()]}`}
    >
      <Link to={`/explore/tx/${tx.tx_hash}`}>
        <div className="flex text-sm">
          <div className="shrink flex flex-col items-center justify-center mr-1 text-xs">
            {tx.height <= 0 ? (
              <HourglassOutlined className="text-neutral-400" />
            ) : (
              <CheckCircleOutlined className="text-primary-700" />
            )}
          </div>
          <div className="flex-1">
            <div
              className={`${tx.valueSatoshis > 0 ? receiveStyle : sendStyle}`}
            >
              {txDateTime.toLocaleString(DateTime.DATE_SHORT)}
            </div>
            <div>{txDateTime.toLocaleString(DateTime.TIME_WITH_SECONDS)}</div>
          </div>
          <div className="flex-1 text-right">
            <div
              className={`font-mono ${
                tx.valueSatoshis > 0 ? receiveStyle : sendStyle
              }`}
            >
              {tx.valueSatoshis > 0 && "+"}
              <Satoshi value={tx.valueSatoshis} />
            </div>
            <div>
              <Satoshi value={tx.valueSatoshis} flip />
            </div>
          </div>
        </div>
        <div className="flex justify-between">
          {tx.memo && (
            <div className="grow text-sm text-neutral-500 mx-4">{tx.memo}</div>
          )}
          {tx.tokens && !shouldHideBalance ? (
            <div className="flex flex-1 justify-end flex-wrap gap-x-2 mr-0.5">
              {tx.tokens.map((token) => (
                <div
                  key={`${token.category}-${tx.tx_hash}`}
                  className="flex justify-end items-center text-right text-sm"
                >
                  <span
                    style={{ color: `#${token.category.slice(0, 6)}` }}
                    className="font-mono text-xs tracking-tighter font-bold"
                  >
                    <TokenSymbol token={token} />
                  </span>
                  {token.nft_amount !== 0 && <TokenAmount token={token} nft />}
                  {token.fungible_amount !== 0n && (
                    <TokenAmount token={token} />
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

function EmptyState({ syncPending, searchQuery }: EmptyStateProps) {
  if (syncPending !== 0) {
    return <SyncOutlined className="text-3xl" spin />;
  }

  if (searchQuery) {
    return (
      <span className="text-neutral-500">
        {translate(translations.noResultsFound)} &quot;{searchQuery}
        &quot;
      </span>
    );
  }

  return <span>-----</span>;
}

export default function WalletViewHistory() {
  const dispatch = useDispatch();
  const { txHistory, hasMore, isLoading } = useTransactionHistory();
  const { syncPending } = useSelector(selectSyncState);
  const bchNetwork = useSelector(selectBchNetwork);
  const searchQuery = useSelector(selectSearchQuery);
  const filters = useSelector(selectTxHistoryFilters);
  const [shouldShowFilters, setShouldShowFilters] = useState(false);
  const observerTarget = useRef(null);

  const walletHash = useSelector(selectActiveWalletHash);
  const { localCurrency } = useSelector(selectCurrencySettings);
  const chaintip = useSelector(selectChaintip);
  const [isExporting, setIsExporting] = useState(false);

  const { shouldHideBalance } = useSelector(selectPrivacySettings);
  const isExperimental = useSelector(selectIsExperimental);
  const [nextPage, setNextPage] = useState(1);

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }
    await dispatch(txHistoryFetchMore(nextPage));
    setNextPage(nextPage + 1);
  }, [dispatch, isLoading, hasMore, nextPage]);

  const handleSearchChange = useCallback(
    (e) => {
      const query = e.target.value;
      dispatch(setSearchQuery(query));
    },
    [dispatch]
  );

  // Refetch when search query or filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      dispatch(txHistoryFetch());
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filters, dispatch]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        // eslint-disable-next-line
        observer.unobserve(observerTarget.current);
      }
    };
    // exhaustive deps are not needed here since the only memoized value is `handleLoadMore`,
    // and the others will always have their latest value accessible, regardless of deps
    // eslint-disable-next-line
  }, [handleLoadMore]);

  const handleExportCsv = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    const Notification = NotificationService();
    let dismissLoading = Notification.loading("Preparing CSV export...");

    try {
      const HistoryService = TransactionHistoryService(
        walletHash,
        localCurrency,
        bchNetwork
      );
      const TransactionManager = TransactionManagerService();

      // Fetch all transactions from the database (not just the current page)
      const allTransactions = await HistoryService.resolveTransactionHistory(
        0,
        Number.MAX_SAFE_INTEGER
      );

      if (allTransactions.transactions.length === 0) {
        throw new Error("No transactions to export");
      }

      dismissLoading();
      dismissLoading = Notification.loading(
        `Preparing ${allTransactions.transactions.length} transactions...`
      );

      // Prepare all transactions for export by resolving full transaction data
      const exportPromises = allTransactions.transactions.map(async (tx) => {
        try {
          // Resolve full transaction data to get vin/vout
          const fullTx = await TransactionManager.resolveTransaction(
            tx.tx_hash,
            bchNetwork
          );
          const memo = HistoryService.getTransactionMemo(tx.tx_hash);

          // Create TransactionDetail object with time_seen
          const txDetail = {
            ...fullTx,
            time_seen: tx.time_seen || fullTx.time.toString(),
          };

          return await prepareTransactionExportData(
            txDetail,
            chaintip,
            memo,
            walletHash,
            tx.valueSatoshis // Pass the wallet amount from history
          );
        } catch (error) {
          Log.error(`Failed to prepare transaction ${tx.tx_hash}:`, error);
          return null;
        }
      });

      const exportData = (await Promise.all(exportPromises)).filter(
        (a) => a != null
      );

      if (exportData.length === 0) {
        throw new Error("No transactions could be prepared for export");
      }

      await exportHistoryAsCsv(
        exportData,
        `transaction-history-${DateTime.now().toFormat("yyyy-MM-dd")}`
      );

      dismissLoading();
      Notification.success(`Exported ${exportData.length} transactions!`);
    } catch (error) {
      Log.error("CSV export error:", error);
      dismissLoading();
      Notification.error(translate(translations.failedToExportCsv));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div data-testid="history-view" className="flex flex-col justify-start">
      <ViewHeader
        icon={HistoryOutlined}
        title={translate(translations.recentTransactions)}
        small
      />

      {/* Search and Filter Bar */}
      <div className="p-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder={translate(translations.searchPlaceholder)}
              value={searchQuery}
              onChange={handleSearchChange}
              className="rounded bg-white dark:bg-neutral-500 p-2 pr-8 w-full focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => dispatch(setSearchQuery(""))}
                className="inline-flex absolute right-2 top-1/2 -translate-y-1/2"
                aria-label={translate(translations.clearSearch)}
              >
                <CloseCircleOutlined size={16} />
              </button>
            )}
          </div>
          <Button
            onClick={() => setShouldShowFilters(!shouldShowFilters)}
            inverted={shouldShowFilters}
            label={<FilterOutlined />}
          />
        </div>

        {/* Filter Panel */}
        {shouldShowFilters && (
          <div className="mt-2 p-3  rounded space-y-3">
            {/* Sort Controls */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                {translate(translations.sortBy)}
              </label>
              <div className="flex items-center gap-2">
                <Select
                  value={filters.sortField}
                  onChange={(e) => dispatch(setSortField(e.target.value))}
                  className="flex-1 px-3 py-1.5 text-sm rounded bg-white dark:bg-neutral-700 border border-neutral-300 dark:border-neutral-600"
                >
                  <option value="date">
                    {translate(translations.sortDate)}
                  </option>
                  <option value="amount">
                    {translate(translations.sortAmount)}
                  </option>
                  <option value="address">
                    {translate(translations.sortAddress)}
                  </option>
                </Select>
                <Button
                  onClick={() =>
                    dispatch(
                      setSortDirection(
                        filters.sortDirection === "asc" ? "desc" : "asc"
                      )
                    )
                  }
                  label={
                    filters.sortDirection === "asc" ? (
                      <SortAscendingOutlined />
                    ) : (
                      <SortDescendingOutlined />
                    )
                  }
                />
              </div>
            </div>

            {/* Direction Filter */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                {translate(translations.filterDirection)}
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.direction === "all"
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="direction"
                    checked={filters.direction === "all"}
                    onChange={() => dispatch(setDirection("all"))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterDirectionAll)}
                  </span>
                </label>
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.direction === "incoming"
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="direction"
                    checked={filters.direction === "incoming"}
                    onChange={() => dispatch(setDirection("incoming"))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterDirectionIncoming)}
                  </span>
                </label>
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.direction === "outgoing"
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="direction"
                    checked={filters.direction === "outgoing"}
                    onChange={() => dispatch(setDirection("outgoing"))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterDirectionOutgoing)}
                  </span>
                </label>
              </div>
            </div>

            {/* Token Filter */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                {translate(translations.filterTokens)}
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.hasToken === null
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="hasToken"
                    checked={filters.hasToken === null}
                    onChange={() => dispatch(setHasToken(null))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterTokensAll)}
                  </span>
                </label>
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.hasToken === true
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="hasToken"
                    checked={filters.hasToken === true}
                    onChange={() => dispatch(setHasToken(true))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterTokensHas)}
                  </span>
                </label>
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.hasToken === false
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="hasToken"
                    checked={filters.hasToken === false}
                    onChange={() => dispatch(setHasToken(false))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterTokensNone)}
                  </span>
                </label>
              </div>
            </div>

            {/* NFT Filter */}
            <div>
              <label className="block text-sm font-medium mb-1.5 text-neutral-700 dark:text-neutral-300">
                {translate(translations.filterNFTs)}
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.hasNFT === null
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="hasNFT"
                    checked={filters.hasNFT === null}
                    onChange={() => dispatch(setHasNft(null))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterNFTsAll)}
                  </span>
                </label>
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.hasNFT === true
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="hasNFT"
                    checked={filters.hasNFT === true}
                    onChange={() => dispatch(setHasNft(true))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterNFTsHas)}
                  </span>
                </label>
                <label
                  className={`flex items-center cursor-pointer px-3 py-2 rounded transition-colors ${
                    filters.hasNFT === false
                      ? "bg-primary-500 text-white"
                      : "bg-white dark:bg-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="hasNFT"
                    checked={filters.hasNFT === false}
                    onChange={() => dispatch(setHasNft(false))}
                    className="mr-2"
                  />
                  <span className="text-sm">
                    {translate(translations.filterNFTsNone)}
                  </span>
                </label>
              </div>
            </div>

            {/* Reset Button */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-700">
              <Button
                onClick={() => dispatch(resetFilters())}
                fullWidth
                label={translate(translations.resetFilters)}
              />
            </div>
          </div>
        )}
      </div>
      {isExperimental && (
        <div className="px-1 pt-1">
          <Button
            icon={DownloadOutlined}
            label="Export CSV"
            onClick={handleExportCsv}
            disabled={isExporting || txHistory.length === 0}
            fullWidth
            inverted
          />
        </div>
      )}
      <div className="pb-2">
        <ul className=" text-neutral-500 divide-y divide-neutral-300 dark:divide-neutral-700 rounded-b-sm shadow-inner h-full">
          {txHistory.length === 0 && (
            <li className="flex px-1 py-2 items-center justify-center tracking-tighter font-bold">
              <EmptyState
                syncPending={syncPending.txHistory}
                searchQuery={searchQuery}
              />
            </li>
          )}
          {txHistory.map((tx, i) => (
            <TransactionItem
              key={`${tx.tx_hash}${tx.address}${tx.block_pos}`}
              tx={tx}
              index={i}
              shouldHideBalance={shouldHideBalance}
            />
          ))}
          {hasMore && (
            <li
              ref={observerTarget}
              className="flex px-1 py-3 items-center justify-center"
            >
              {isLoading && (
                <SyncOutlined className="text-2xl text-primary-500" spin />
              )}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
