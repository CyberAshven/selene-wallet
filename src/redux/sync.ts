/* eslint-disable @typescript-eslint/no-use-before-define */
import {
  createAction,
  createAsyncThunk,
  createListenerMiddleware,
  createReducer,
  createSelector,
} from "@reduxjs/toolkit";

import { AppDispatch, RootState } from "@/redux";
import { selectNetworkStatus } from "@/redux/device";
import {
  selectBchNetwork,
  selectIsOfflineMode,
  selectIsStablecoinMode,
} from "@/redux/preferences";
import { txHistoryFetch } from "@/redux/txHistory";
import {
  selectActiveWallet,
  walletReloadAddresses,
  walletSyncDiff,
} from "@/redux/wallet";

import JanitorService from "@/kernel/app/JanitorService";
import LogService from "@/kernel/app/LogService";
import BlockchainService from "@/kernel/bch/BlockchainService";
import CauldronService from "@/kernel/bch/CauldronService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import TransactionManagerService from "@/kernel/bch/TransactionManagerService";
import AddressManagerService, {
  AddressEntity,
  AddressStub,
} from "@/kernel/wallet/AddressManagerService";
import AddressScannerService from "@/kernel/wallet/AddressScannerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

const Log = LogService("redux/sync");

export const syncMiddleware = createListenerMiddleware<{
  state: RootState;
  dispatch: AppDispatch;
}>();

// --------------------------------

// syncConnect: request/retry electrum connection
export const syncConnect = createAsyncThunk(
  "sync/connect",
  async (payload: { attempts: number; server: string }, thunkApi) => {
    const isOfflineMode = selectIsOfflineMode(thunkApi.getState());
    if (isOfflineMode) {
      Log.log("sync/connect blocked by offline mode");
      return false;
    }

    const bchNetwork = selectBchNetwork(thunkApi.getState());

    const Electrum = ElectrumService(bchNetwork);

    Log.log("sync/connect", payload);
    let isSuccess = false;
    try {
      thunkApi.dispatch(syncCauldronConnect());
      await Electrum.connect(payload.server);
      isSuccess = true;
    } catch (e) {
      Log.error("syncConnect:", e);

      // if connection fails, destroy the client and try again
      await Electrum.disconnect(true);

      const { isConnected: isNetworkConnected } = selectNetworkStatus(
        thunkApi.getState()
      );

      // Immediate failover: try a different server on first failure
      if (isNetworkConnected) {
        const newServer = Electrum.selectFallbackServer(payload.server);
        thunkApi.dispatch(syncConnect({ server: newServer, attempts: 0 }));
      } else {
        // No network — retry same server after delay
        setTimeout(
          () =>
            thunkApi.dispatch(
              syncConnect({ ...payload, attempts: payload.attempts + 1 })
            ),
          2000
        );
      }
    }

    return isSuccess;
  }
);

export const syncCauldronConnect = createAsyncThunk(
  "sync/cauldronConnect",
  async (payload, thunkApi) => {
    const isStablecoinMode = selectIsStablecoinMode(thunkApi.getState());
    if (!isStablecoinMode) {
      Log.log("sync/cauldronConnect blocked - not in stablecoin mode");
      return;
    }

    const Cauldron = CauldronService();
    await Cauldron.connect();

    //Cauldron.subscribe(MUSD_TOKENID);
  }
);

// syncReconnect: attempt fresh connection to server
export const syncReconnect = createAsyncThunk(
  "sync/reconnect",
  async (server: string | undefined, thunkApi) => {
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const Electrum = ElectrumService(bchNetwork);
    const connectServer = server || Electrum.getElectrumHost();
    Log.debug("reconnect:", connectServer);
    thunkApi.dispatch(syncConnect({ attempts: 0, server: connectServer }));
  }
);

export const syncDisconnect = createAsyncThunk(
  "sync/disconnect",
  async (_, thunkApi) => {
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const Electrum = ElectrumService(bchNetwork);
    const Cauldron = CauldronService();

    Cauldron.disconnect();
    return Electrum.disconnect(true);
  }
);

// syncConnectionUp: fired when electrum connection is up
export const syncConnectionUp = createAsyncThunk(
  "sync/up",
  async (payload, thunkApi) => {
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const Electrum = ElectrumService(bchNetwork);
    // set up subscriptions on connect
    try {
      //Log.debug("syncConnectionUp");
      Electrum.subscribeToChaintip();
      thunkApi.dispatch(syncSubscriptions());
    } catch (e) {
      Log.warn("syncConnectionUp:", e);
    }

    return Electrum.getElectrumHost();
  }
);

// syncConnectionDown: fired if electrum connection goes down
export const syncConnectionDown = createAsyncThunk(
  "sync/down",
  async (payload, thunkApi) => {
    thunkApi.dispatch(syncDisconnect());
  }
);

export const syncSubscriptions = createAsyncThunk(
  "sync/subscriptions",
  async (payload, thunkApi) => {
    const { walletHash, network: bchNetwork } = selectActiveWallet(
      thunkApi.getState()
    );

    const AddressManager = AddressManagerService(walletHash);
    const UtxoManager = UtxoManagerService(walletHash);

    // "hot" addresses are any addresses with UTXOs on them
    // if any address has a utxo, we'll get notified on spend,
    // then no longer subscribe going forward
    // if a change address has state but no utxo, we assume the address is spent
    // so no need to subscribe.
    const walletUtxos = UtxoManager.getWalletUtxos();
    const hotAddresses = walletUtxos.reduce((acc, utxo) => {
      const a = AddressManager.getAddress(utxo.address);
      return acc.find((f) => f.address === a.address) ? acc : [...acc, a];
    }, []);

    // we should subscribe to all unused receive addresses
    const unusedReceiveAddresses = AddressManager.getUnusedAddresses(0, 0);

    // subscribe to heavily reused addresses (donation/static)
    const reusedReceiveAddresses = AddressManager.getReusedAddresses();

    // subscribe to recently active addresses (~10 days of blocks)
    const tipHeight = Number(selectChaintip(thunkApi.getState())?.height ?? 0);
    const recentlyActiveAddresses =
      AddressManager.getRecentlyActiveAddresses(tipHeight);

    // we should subscribe to a few unused change addresses for instant updates if we spend elsewhere
    const unusedChangeAddresses = AddressManager.getUnusedAddresses(0, 1);
    const filteredUnusedChangeAddresses = unusedChangeAddresses.filter(
      (a, i) => i < 20 || i > unusedChangeAddresses.length - 20
    );

    // subscribe to WalletConnect address
    const walletConnectAddress = AddressManager.getWalletConnectAddress();

    // TODO: allow the user to set up pinned/watch addresses, get address list here

    const addresses = [
      walletConnectAddress,
      ...hotAddresses,
      ...unusedReceiveAddresses,
      ...reusedReceiveAddresses,
      ...recentlyActiveAddresses,
      ...filteredUnusedChangeAddresses,
    ]
      // de-duplicate subscription list
      .reduce(
        (acc, cur) =>
          acc.find((f) => f.address === cur.address) ? acc : [...acc, cur],
        []
      );

    Log.debug("syncSubscriptions", addresses.length);

    const Electrum = ElectrumService(bchNetwork);

    await Promise.all(
      addresses.map(async (address) => {
        try {
          await Electrum.subscribeToAddress(address);
        } catch (e) {
          Log.warn("syncSubscriptions:", e);
        }
      })
    );

    return addresses;
  }
);

// syncSubscriptionCount: adjusts the number of requests shown on the sync indicator
export const syncSubscriptionCount = createAction<number>(
  "sync/subscriptionCount"
);

// syncAddressState: fired when data acquired from address subscription
export const syncAddressState =
  createAction<[string, string | null]>("sync/addressState");

// syncUtxoDiffs: fired when an address update results in a new UTXO set
export const syncUtxoDiffs = createAction<{
  diffIn: string[];
  diffOut: string[];
}>("sync/utxoDiffs");

// Use middleware to aggregate Electrum subscription updates
syncMiddleware.startListening({
  actionCreator: syncAddressState,
  effect: async (action, listenerApi) => {
    // collect syncAddressState actions over a short window
    const batchTimeout = 100; // milliseconds
    const collectedActions: Array<ReturnType<typeof action>> = [];

    // use listenerApi.take to collect additional syncAddressState actions
    const take = () =>
      listenerApi.take((a) => a.type === syncAddressState.type, batchTimeout);

    let takeResult = await take();

    while (takeResult !== null) {
      listenerApi.cancelActiveListeners();

      const [nextAction] = takeResult;
      collectedActions.push(nextAction);

      /* eslint-disable-next-line no-await-in-loop */
      takeResult = await take();
    }

    collectedActions.push(action);

    const addressStates = collectedActions.map((a) => a.payload);
    //Log.debug("addressStates", addressStates);

    listenerApi.dispatch(syncSubscriptionCount(addressStates.length));

    const wallet = selectActiveWallet(listenerApi.getState());
    const AddressScanner = AddressScannerService(wallet);
    const AddressManager = AddressManagerService(wallet.walletHash);

    // process UTXOs and history for all collected addresses
    const utxoDiffs = await Promise.all(
      addressStates.map(async ([address, state]) => {
        try {
          const currentAddressState =
            AddressManager.calculateAddressState(address);

          if (state === null || state === currentAddressState) {
            return { address, utxoDiff: { diffIn: [], diffOut: [] } };
          }

          const utxoDiff = await AddressScanner.scanUtxos(address);
          const [, calculatedState] = await AddressScanner.scanHistory(address);

          if (calculatedState !== state) {
            Log.warn(
              "state mismatch for address:",
              address,
              calculatedState,
              state
            );
          }

          //Log.debug("address state changed", address, state);
          return { address, utxoDiff };
        } catch (e) {
          Log.warn("address sync fail:", e, address);
          AddressManager.nullifyAddressState(address); // Reset state on failure
          return { address, utxoDiff: { diffIn: [], diffOut: [] } };
        }
      })
    );

    // aggregate UTXO diffs
    const aggregateDiffs: { diffIn: string[]; diffOut: string[] } =
      utxoDiffs.reduce(
        (acc, { utxoDiff }) => ({
          diffIn: [...acc.diffIn, ...utxoDiff.diffIn],
          diffOut: [...acc.diffOut, ...utxoDiff.diffOut],
        }),
        { diffIn: [] as string[], diffOut: [] as string[] }
      );

    await listenerApi.dispatch(syncUtxoDiffs(aggregateDiffs));
    await listenerApi.dispatch(syncSubscriptionCount(-addressStates.length));
    await listenerApi.dispatch(syncComplete());
  },
});

export const syncPopulateAddresses = createAsyncThunk(
  "sync/populateAddresses",
  async (action, thunkApi) => {
    const wallet = selectActiveWallet(thunkApi.getState());
    const AddressScanner = AddressScannerService(wallet);

    const generatedAddresses = AddressScanner.populateAddresses();

    const Electrum = ElectrumService(wallet.network);
    await Promise.all(
      generatedAddresses.map(async (address) => {
        try {
          await Electrum.subscribeToAddress(address);
        } catch (e) {
          Log.warn("syncPopulateAddresses", e);
        }
      })
    );

    return generatedAddresses;
  }
);

export const syncHotRefresh = createAsyncThunk(
  "sync/hotRefresh",
  async (payload: { force: boolean }, thunkApi) => {
    const wallet = selectActiveWallet(thunkApi.getState());
    const sync = selectSyncState(thunkApi.getState());

    // only allow hot sync after cooldown
    const hotSyncCooldown = 3 * 1000;

    if (
      (sync.isSyncComplete &&
        sync.syncPending.hotRefresh <= 1 &&
        sync.lastRefresh < Date.now() - hotSyncCooldown) ||
      payload.force
    ) {
      const AddressManager = AddressManagerService(wallet.walletHash);

      // get all receive addresses
      const receiveAddresses = AddressManager.getReceiveAddresses();

      // don't resync unused receive addresses (we're already subscribed to them)
      const filteredReceiveAddresses = receiveAddresses.filter(
        (address) => !(address.state === null)
      );

      // get all change addresses
      const changeAddresses = AddressManager.getChangeAddresses();

      // don't resync fully spent change addresses
      const filteredChangeAddresses = changeAddresses.filter(
        (address) => !(address.state !== null && address.balance === 0n)
      );

      // concatenate full list of addresses
      const addressList = filteredReceiveAddresses.concat(
        filteredChangeAddresses
      );

      Log.debug("hotRefresh", addressList.length);

      const Electrum = ElectrumService(wallet.network);
      await Promise.all(
        addressList.map(async (address) => {
          try {
            // only request states, we don't want subscriptions here
            const addressState = await Electrum.requestAddressState(
              address.address
            );
            thunkApi.dispatch(
              syncAddressState([address.address, addressState])
            );
          } catch (e) {
            Log.warn("syncHotRefresh:", e);
          }
        })
      );

      const AddressScanner = AddressScannerService(wallet);

      const getUnusedCount = (addresses: Array<AddressStub> = []) =>
        addresses.filter((a) => a.state === null).length;

      // additionally, scan forward until we're sure wallet is fully synchronized
      /* eslint-disable no-await-in-loop */
      for (let change = 0; change <= 1; change += 1) {
        const SCAN_BATCH_SIZE = 500;
        const SCAN_BATCH_MAX = 3000;

        let i = 0;
        let scanCount = 0;
        let nScanMore = SCAN_BATCH_SIZE * (i + 1);

        let scannedAddresses = await AddressScanner.scanMoreAddresses(
          nScanMore,
          change
        );

        thunkApi.dispatch(syncSubscriptionCount(scannedAddresses.length));
        scanCount += scannedAddresses.length;

        while (getUnusedCount(scannedAddresses) < nScanMore) {
          nScanMore = Math.min(nScanMore + SCAN_BATCH_SIZE * i, SCAN_BATCH_MAX);
          scannedAddresses = await AddressScanner.scanMoreAddresses(
            nScanMore,
            change
          );
          i += 1;
          scanCount += scannedAddresses.length;
          thunkApi.dispatch(syncSubscriptionCount(scannedAddresses.length));
        }
        thunkApi.dispatch(syncSubscriptionCount(-scanCount));
      }

      Log.debug("sync/hotRefresh", sync);
      return Date.now();
    }

    Log.debug(
      "skipped hotRefresh",
      !sync.isSyncComplete ? "(sync incomplete)" : true,
      sync.lastRefresh < Date.now() - hotSyncCooldown
        ? true
        : "(cooldown active)"
    );
    return sync.lastRefresh;
  }
);

export const syncChaintip = createAsyncThunk(
  "sync/chaintip",
  async (chaintip: { height: number; hex: string }, thunkApi) => {
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const Blockchain = BlockchainService(bchNetwork);

    const currentTip = await Blockchain.resolveChaintip();

    const tipHash = Blockchain.calculateBlockhash(chaintip.hex);

    // chaintip is up to date
    if (currentTip.blockhash === tipHash) {
      Log.log("sync/chaintip", currentTip.height, currentTip.blockhash);
      return currentTip;
    }

    const block = await Blockchain.resolveBlockByHash(tipHash);

    Log.log("sync/chaintip", block);

    // this requires the app being closed for 10 blocks
    // TODO: actual cron tasking
    if (block.height > currentTip.height + 10) {
      queueMicrotask(async () => {
        const Janitor = JanitorService();
        await Janitor.purgeStaleData();
      });
    }

    // Rebroadcast any transactions we sent but haven't verified in the mempool.
    // height IS NULL means we broadcast but never confirmed it landed.
    queueMicrotask(() => {
      TransactionManagerService()
        .rebroadcastUnresolved(bchNetwork)
        .catch((e) => Log.warn("rebroadcastUnresolved failed", e));
    });

    return block;
  }
);

export const syncClearAddresses = createAction("sync/clearAddresses");

export const syncSetSaving = createAction<boolean>("sync/saving");

export const syncComplete = createAsyncThunk(
  "sync/complete",
  async (payload, thunkApi): Promise<boolean> => {
    const { isSyncComplete, isSyncing, isSaving, syncDiff } = selectSyncState(
      thunkApi.getState()
    );

    if (!isSyncing) {
      if (!isSyncComplete && !isSaving) {
        const { payload: generatedAddresses } = await thunkApi.dispatch(
          syncPopulateAddresses()
        );

        if (generatedAddresses.length > 0) {
          return false;
        }

        Log.debug("sync complete");

        if (syncDiff.diffIn.length > 0 || syncDiff.diffOut.length > 0) {
          Log.debug("utxo diff", syncDiff);
        }

        const wallet = selectActiveWallet(thunkApi.getState());
        thunkApi.dispatch(
          walletSyncDiff({
            wallet,
            utxoDiff: syncDiff,
          })
        );

        thunkApi.dispatch(walletReloadAddresses({ wallet }));

        thunkApi.dispatch(syncSetSaving(true));
        try {
          await WalletManagerService().saveWallet(wallet.walletHash);
        } finally {
          thunkApi.dispatch(syncSetSaving(false));
        }

        thunkApi.dispatch(syncFlushDiff());
      }
      return true;
    }

    return false;
  }
);

export const syncPause = createAsyncThunk("sync/pause", async (_, thunkApi) => {
  const bchNetwork = selectBchNetwork(thunkApi.getState());
  await ElectrumService(bchNetwork).disconnect(true);
});

export const syncResume = createAsyncThunk(
  "sync/resume",
  async (payload, thunkApi) => {
    const bchNetwork = selectBchNetwork(thunkApi.getState());
    const Electrum = ElectrumService(bchNetwork);

    if (!Electrum.getIsConnected()) {
      thunkApi.dispatch(syncReconnect());
    }
  }
);

export const syncFlushDiff = createAction("sync/flushDiff");

syncMiddleware.startListening({
  actionCreator: syncHotRefresh.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(syncComplete());
  },
});
syncMiddleware.startListening({
  actionCreator: txHistoryFetch.fulfilled,
  effect: async (action, listenerApi) => {
    listenerApi.dispatch(syncComplete());
  },
});

const initialChaintip = { height: -1, hex: "" };

const initialPending = {
  addressState: 0,
  subscription: 0,
  chaintip: 0,
  rebuild: 0,
  hotRefresh: 0,
  txHistory: 0,
  populate: 0,
};

const initialDiff = {
  diffIn: new Array<string>(),
  diffOut: new Array<string>(),
};

interface SyncState {
  isConnected: boolean;
  server: string;
  syncPending: typeof initialPending;
  syncDiff: typeof initialDiff;
  isSyncComplete: boolean;
  isSaving: boolean;
  chaintip: typeof initialChaintip;
  lastRefresh: number;
  subscriptions: Array<AddressEntity>;
}

const initialState: SyncState = {
  isConnected: false,
  server: "",
  syncPending: { ...initialPending },
  syncDiff: { ...initialDiff },
  isSyncComplete: true,
  isSaving: false,
  chaintip: initialChaintip,
  lastRefresh: Date.now(),
  subscriptions: [],
};

export const syncReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(syncConnect.fulfilled, (state, action) => {
      state.isConnected = action.payload;
    })
    .addCase(syncDisconnect.pending, (state) => {
      state.isConnected = false;
    })
    .addCase(syncDisconnect.fulfilled, (state) => {
      state.isConnected = false;
    })
    .addCase(syncConnectionUp.fulfilled, (state, action) => {
      state.isConnected = true;
      state.server = action.payload;
    })
    .addCase(syncConnectionDown.fulfilled, (state) => {
      state.isConnected = false;
      state.syncPending = initialPending;
    })
    .addCase(syncReconnect.pending, (state) => {
      state.isConnected = false;
    })
    .addCase(syncAddressState, (state) => {
      state.isSyncComplete = false;
    })
    .addCase(txHistoryFetch.pending, (state) => {
      state.isSyncComplete = false;
      state.syncPending.txHistory += 1;
    })
    .addCase(txHistoryFetch.fulfilled, (state) => {
      state.syncPending.txHistory -= 1;
    })
    .addCase(txHistoryFetch.rejected, (state) => {
      state.syncPending.txHistory -= 1;
    })
    .addCase(syncSubscriptionCount, (state, action) => {
      state.syncPending.subscription += action.payload;
    })
    .addCase(syncChaintip.pending, (state) => {
      state.isSyncComplete = false;
      state.syncPending.chaintip += 1;
    })
    .addCase(syncChaintip.fulfilled, (state, action) => {
      state.syncPending.chaintip -= 1;
      state.chaintip = action.payload;
    })
    .addCase(syncChaintip.rejected, (state) => {
      state.syncPending.chaintip -= 1;
    })
    .addCase(syncHotRefresh.pending, (state) => {
      state.syncPending.hotRefresh += 1;
    })
    .addCase(syncHotRefresh.fulfilled, (state, action) => {
      state.lastRefresh = action.payload;
      state.syncPending.hotRefresh -= 1;
    })
    .addCase(syncHotRefresh.rejected, (state) => {
      state.syncPending.hotRefresh -= 1;
    })
    .addCase(syncSubscriptions.pending, (state) => {
      state.isSyncComplete = false;
      state.syncPending.subscription += 1;
      state.syncDiff = { ...initialDiff };
    })
    .addCase(syncSubscriptions.fulfilled, (state, action) => {
      state.subscriptions = action.payload;
      state.syncPending.subscription -= 1;
    })
    .addCase(syncSubscriptions.rejected, (state) => {
      state.syncPending.subscription -= 1;
    })
    .addCase(syncPopulateAddresses.pending, (state) => {
      state.syncPending.populate += 1;
    })
    .addCase(syncPopulateAddresses.fulfilled, (state, action) => {
      state.syncPending.populate -= 1;
      state.subscriptions = [...state.subscriptions, ...action.payload];
    })
    .addCase(syncComplete.fulfilled, (state, action) => {
      state.isSyncComplete = action.payload;
    })
    .addCase(syncSetSaving, (state, action) => {
      state.isSaving = action.payload;
    })
    .addCase(syncUtxoDiffs, (state, action) => {
      state.syncDiff = {
        diffIn: [...state.syncDiff.diffIn, ...action.payload.diffIn],
        diffOut: [...state.syncDiff.diffOut, ...action.payload.diffOut],
      };
    })
    .addCase(syncFlushDiff, (state) => {
      state.syncDiff = { ...initialDiff };
    });
});

export const selectIsSyncing = createSelector(
  (state: RootState) => state.sync,
  (sync) =>
    Object.keys(sync.syncPending).reduce(
      (isSyncing, pending) =>
        sync.syncPending[pending] > 0 || isSyncing || sync.isSaving,
      false
    )
);

export const selectSyncCount = createSelector(
  (state: RootState) => state.sync,
  (sync) =>
    Object.keys(sync.syncPending).reduce(
      (syncCount, pending) => syncCount + sync.syncPending[pending],
      0
    )
);

export const selectSyncState = createSelector(
  (state: RootState) => state.sync,
  (sync) => ({
    ...sync,
    isSyncing: selectIsSyncing({ sync }),
    syncCount: selectSyncCount({ sync }),
  })
);

export const selectIsRebuilding = createSelector(
  (state: RootState) => state.sync,
  (sync) => sync.syncPending.rebuild > 0
);

export const selectChaintip = createSelector(
  (state: RootState) => state.sync,
  (sync) => sync.chaintip
);

export const selectElectrumServer = createSelector(
  (state: RootState) => state.sync,
  (sync) => sync.server
);

export const selectIsConnected = createSelector(
  (state: RootState) => state.sync,
  (sync) => sync.isConnected
);

export const selectSubscriptions = createSelector(
  (state: RootState) => state.sync,
  (sync) => sync.subscriptions
);
