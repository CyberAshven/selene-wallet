/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  createAction,
  createAsyncThunk,
  createReducer,
  createSelector,
} from "@reduxjs/toolkit";

import { RootState } from "@/redux";
import { selectBchNetwork, selectCurrencySettings } from "@/redux/preferences";
import { selectActiveWalletHash } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import TransactionHistoryService from "@/kernel/wallet/TransactionHistoryService";

const Log = LogService("redux/txHistory");

export const DEFAULT_HISTORY_PAGE_LENGTH = 20;

// Filter and Sort Types
export type SortField = "date" | "amount" | "address";
export type SortDirection = "asc" | "desc";
export type TransactionDirection = "all" | "incoming" | "outgoing";

export interface TxHistoryFilters {
  sortField: SortField;
  sortDirection: SortDirection;
  direction: TransactionDirection;
  hasToken: boolean | null; // null = all, true = has tokens, false = no tokens
  hasNFT: boolean | null; // null = all, true = has NFT, false = no NFT
}

export const setSearchQuery = createAction<string>("txHistory/setSearchQuery");
export const setSortField = createAction<SortField>("txHistory/setSortField");
export const setSortDirection = createAction<SortDirection>(
  "txHistory/setSortDirection"
);
export const setDirection = createAction<TransactionDirection>(
  "txHistory/setDirection"
);
export const setHasToken = createAction<boolean | null>(
  "txHistory/setHasToken"
);
export const setHasNft = createAction<boolean | null>("txHistory/setHasNFT");
export const resetFilters = createAction("txHistory/resetFilters");

export const txHistoryFetch = createAsyncThunk(
  "txHistory/fetch",
  async (payload, thunkApi) => {
    const walletHash = selectActiveWalletHash(thunkApi.getState());
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const { localCurrency } = selectCurrencySettings(thunkApi.getState());
    const { searchQuery = "", filters } = thunkApi.getState().txHistory;
    const txHistory = await TransactionHistoryService(
      walletHash,
      localCurrency,
      bchNetwork
    ).resolveTransactionHistory(
      0,
      DEFAULT_HISTORY_PAGE_LENGTH,
      searchQuery,
      filters
    );

    Log.debug("txHistory resolved", txHistory);

    return txHistory;
  }
);

export const txHistoryFetchMore = createAsyncThunk(
  "txHistory/fetchMore",
  async (payload: number, thunkApi) => {
    const walletHash = selectActiveWalletHash(thunkApi.getState());
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const { localCurrency } = selectCurrencySettings(thunkApi.getState());
    const { searchQuery = "", filters } = thunkApi.getState().txHistory;
    const page = payload;

    const txHistory = await TransactionHistoryService(
      walletHash,
      localCurrency,
      bchNetwork
    ).resolveTransactionHistory(
      page * DEFAULT_HISTORY_PAGE_LENGTH,
      DEFAULT_HISTORY_PAGE_LENGTH,
      searchQuery,
      filters
    );

    Log.debug("txHistory fetchMore resolved", txHistory);

    return txHistory;
  }
);

const initialFilters: TxHistoryFilters = {
  sortField: "date",
  sortDirection: "desc",
  direction: "all",
  hasToken: null,
  hasNFT: null,
};

const initialState = {
  history: [],
  hasMore: false,
  total: 0,
  searchQuery: "",
  filters: initialFilters,
  isLoading: false,
};

export const txHistoryReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setSearchQuery, (state, action) => {
      state.searchQuery = action.payload;
    })
    .addCase(setSortField, (state, action) => {
      state.filters.sortField = action.payload;
    })
    .addCase(setSortDirection, (state, action) => {
      state.filters.sortDirection = action.payload;
    })
    .addCase(setDirection, (state, action) => {
      state.filters.direction = action.payload;
    })
    .addCase(setHasToken, (state, action) => {
      state.filters.hasToken = action.payload;
    })
    .addCase(setHasNft, (state, action) => {
      state.filters.hasNFT = action.payload;
    })
    .addCase(resetFilters, (state) => {
      state.filters = initialFilters;
    })
    .addCase(txHistoryFetch.pending, (state) => {
      state.history = initialState.history;
      state.hasMore = initialState.hasMore;
      state.total = initialState.total;
      state.isLoading = true;
    })
    .addCase(txHistoryFetch.fulfilled, (state: RootState, action) => {
      state.history = action.payload.transactions;
      state.hasMore = action.payload.hasMore;
      state.total = action.payload.total;
      state.isLoading = false;
    })
    .addCase(txHistoryFetch.rejected, (state) => {
      state.isLoading = false;
    })
    .addCase(txHistoryFetchMore.pending, (state) => {
      state.isLoading = true;
    })
    .addCase(txHistoryFetchMore.fulfilled, (state: RootState, action) => {
      const existing = new Set(state.history.map((tx) => tx.tx_hash));
      const newTxs = action.payload.transactions.filter(
        (tx) => !existing.has(tx.tx_hash)
      );
      state.history = [...state.history, ...newTxs];
      state.hasMore = action.payload.hasMore;
      state.total = action.payload.total;
      state.isLoading = false;
    })
    .addCase(txHistoryFetchMore.rejected, (state) => {
      state.isLoading = false;
    });
});

const selectTxHistoryState = (state) => state.txHistory;

export const selectTxHistoryFilters = createSelector(
  selectTxHistoryState,
  (txHistory) => txHistory.filters
);

export const selectTransactionHistory = createSelector(
  selectTxHistoryState,
  (txHistory) => txHistory.history
);

export const selectTransactionHistoryPagination = createSelector(
  selectTxHistoryState,
  (txHistory) => ({
    hasMore: txHistory.hasMore,
    total: txHistory.total,
    isLoading: txHistory.isLoading,
  })
);

export const selectSearchQuery = createSelector(
  selectTxHistoryState,
  (txHistory) => txHistory.searchQuery
);
