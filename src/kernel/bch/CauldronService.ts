import { ExchangeLab, PoolV0, PoolV0Parameters } from "@cashlab/cauldron";
import {
  PayoutAmountRuleType,
  PayoutRule,
  SpendableCoin,
  SpendableCoinType,
} from "@cashlab/common";

import LogService from "@/kernel/app/LogService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import KeyManagerService from "@/kernel/wallet/KeyManagerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";
import { WalletEntity } from "@/kernel/wallet/WalletManagerService";

import { addressToLockingBytecode } from "@/util/cashaddr";
import { binToHex, hexToBin } from "@/util/hex";

const Log = LogService("CauldronService");

export type CauldronPoolUtxo = {
  is_withdrawn: boolean;
  new_utxo_hash: string;
  new_utxo_n: number;
  new_utxo_txid: string;
  pkh: string;
  sats: number;
  spent_utxo_hash: string;
  token_amount: number;
  token_id: string;
};

export const parsePoolFromRostrumNodeData = (
  exlab: ExchangeLab,
  rn_pool: CauldronPoolUtxo
): PoolV0 | null => {
  if (rn_pool.is_withdrawn) {
    return null;
  }
  const pool_params: PoolV0Parameters = {
    withdraw_pubkey_hash: hexToBin(rn_pool.pkh),
  };
  const locking_bytecode = exlab.generatePoolV0LockingBytecode(pool_params);
  return {
    version: "0",
    parameters: pool_params,
    outpoint: {
      index: rn_pool.new_utxo_n,
      txhash: hexToBin(rn_pool.new_utxo_txid),
    },
    output: {
      locking_bytecode,
      token: {
        amount: BigInt(rn_pool.token_amount),
        token_id: rn_pool.token_id,
      },
      amount: BigInt(rn_pool.sats),
    },
  };
};

type SubscriptionFunction = (data: unknown) => void;

const subscriptions = new Map<string, Array<SubscriptionFunction>>();
const poolUtxos = new Map<string, CauldronPoolUtxo>();

export default function CauldronService() {
  const Rostrum = ElectrumService("cauldron");

  return {
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    removeHandler,
    getPoolInputs,
    getTokenPrice,
    fetchPools,
    prepareTrade,
    broadcastTransaction: Rostrum.broadcastTransaction,
    getIsConnected: Rostrum.getIsConnected,
  };

  function registerPool(pool) {
    if (!pool.new_utxo_hash) {
      return;
    }

    poolUtxos.set(pool.new_utxo_hash, pool);
    //Log.debug("registerPool", pool, poolUtxos);
  }

  function updatePool(pool) {
    const oldPool = poolUtxos.get(pool.spent_utxo_hash);

    if (oldPool) {
      poolUtxos.delete(pool.spent_utxo_hash);
    }

    registerPool(pool);
  }

  function handleRostrumNotifications(data) {
    if (data.method === "cauldron.contract.subscribe") {
      handleCauldronSubscription(data.params);
    }
  }

  function handleCauldronSubscription(params) {
    Log.debug("handleCauldronSubscription", params, params.length);
    if (params.length < 2) {
      Log.warn("ignoring cauldron notification: invalid response length");
      return;
    }

    // "initial" event sends an array
    let tokenId;
    if (Array.isArray(params)) {
      tokenId = params[1];
      const subscriptionEvent = params[2];

      subscriptionEvent.utxos.forEach((utxo) => registerPool(utxo));
    }
    // "update" event is just a plain object, per-utxo
    else if (params.type && params.type === "update") {
      const { utxos } = params;
      utxos.forEach((utxo) => updatePool(utxo));
      tokenId = utxos[0].token_id;
    }

    // notify subscribers with updated utxo list
    const callbacks = subscriptions.get(tokenId) || [];
    Promise.all(callbacks.map((cb) => cb([...poolUtxos.values()])));
  }

  async function connect() {
    if (Rostrum.getIsConnected()) {
      return true;
    }

    // override default ElectrumService listeners with our own
    return Rostrum.connect("", {
      connected: () => {
        Log.log("ROSTRUM CONNECTED", Rostrum.getElectrumHost());
      },
      notification: handleRostrumNotifications,
      disconnected: () => {
        Log.log("ROSTRUM DISCONNECTED");
      },
    });
  }

  function disconnect() {
    subscriptions.clear();
    return Rostrum.disconnect(true);
  }

  async function subscribe(category: string, callback?: SubscriptionFunction) {
    if (!Rostrum.getIsConnected()) {
      await connect();
    }

    const currentSubscriptions = subscriptions.get(category) || [];

    if (currentSubscriptions.length === 0) {
      const rostrum = Rostrum.getElectrumClient();
      rostrum.subscribe("cauldron.contract.subscribe", 2, category);
    }

    if (typeof callback === "function") {
      currentSubscriptions.push(callback);
      subscriptions.set(category, currentSubscriptions);
    }

    //Log.debug("subscribe", category, callback);
  }

  async function removeHandler(
    category: string,
    callback: SubscriptionFunction
  ) {
    const currentSubscriptions = subscriptions.get(category) || [];
    const subscriptionIndex = currentSubscriptions.findIndex(
      (s) => s === callback
    );

    if (subscriptionIndex > -1) {
      currentSubscriptions.splice(subscriptionIndex, 1);
      subscriptions.set(category, currentSubscriptions);
    }

    if (currentSubscriptions.length === 0) {
      unsubscribe(category);
    }
  }

  async function unsubscribe(category: string) {
    try {
      const rostrum = Rostrum.getElectrumClient();
      await rostrum.unsubscribe("cauldron.contract.unsubscribe", 2, category);
      subscriptions.set(category, []);
    } catch (e) {
      // squelch errors
    }
    //Log.debug("unsubscribe", category, callback);
  }

  function getPoolInputs(category?: string): Array<PoolV0> {
    const exlab = new ExchangeLab();
    //Log.log("getPoolUtxos", poolUtxos, category);
    return [...poolUtxos.values()]
      .filter((p) => category === undefined || p.token_id === category)
      .map((pool) => parsePoolFromRostrumNodeData(exlab, pool));
  }

  function getTokenPrice(category: string): bigint {
    if (!category) {
      throw new Error("getTokenPrice requires a token category");
    }

    const pools = Array.from(poolUtxos.values()).filter(
      (p) => p.token_id === category
    );

    const tokenSum = pools.reduce(
      (sum, cur) => sum + BigInt(cur.token_amount),
      0n
    );
    const satsSum = pools.reduce((sum, cur) => sum + BigInt(cur.sats), 0n);

    if (satsSum === 0n || tokenSum === 0n) {
      return 1n;
    }

    const q = satsSum / tokenSum;
    const r = satsSum % tokenSum;
    const half = tokenSum / 2n;
    const satsPerToken = r >= half ? q + 1n : q;

    Log.debug("getTokenPrice", category, satsPerToken);
    return satsPerToken;
  }

  async function fetchPools(category: string) {
    if (!Rostrum.getIsConnected()) {
      await connect();
    }
    const rostrum = Rostrum.getElectrumClient();
    const result = await rostrum.request(
      "cauldron.contract.subscribe",
      2,
      category
    );

    //Log.debug("fetchPools result", result);
    handleCauldronSubscription([2, category, result]);

    return getPoolInputs(category);
  }

  async function prepareTrade(
    supplyCategory: string,
    demandCategory: string,
    amount: bigint,
    wallet: WalletEntity,
    isDemandFlipped: boolean = false
  ) {
    const exchangeLab = new ExchangeLab();

    // get cauldron utxos
    const inputPools = getPoolInputs();
    const TX_FEE_PER_BYTE = 1n;

    //Log.debug("inputPools", inputPools);
    const tradeResult = isDemandFlipped
      ? exchangeLab.constructTradeBestRateForTargetSupply(
          supplyCategory,
          demandCategory,
          amount,
          inputPools,
          TX_FEE_PER_BYTE
        )
      : exchangeLab.constructTradeBestRateForTargetDemand(
          supplyCategory,
          demandCategory,
          amount,
          inputPools,
          TX_FEE_PER_BYTE
        );

    Log.debug("prepareTrade", tradeResult);

    Log.debug(
      "prepareTrade:",
      tradeResult.summary.supply,
      supplyCategory,
      "->",
      demandCategory,
      tradeResult.summary.demand
    );

    const { walletHash } = wallet;

    const attemptTrade = (fee: bigint) => {
      const AddressManager = AddressManagerService(walletHash);
      const receiveAddress = AddressManager.getUnusedAddresses(1, 0)[0];
      const changeAddress = AddressManager.getUnusedAddresses(1, 1)[0];

      // output demand token
      const isDemandToken = supplyCategory === "BCH";
      const demandTokenRule = isDemandToken
        ? {
            token: {
              token_id: demandCategory,
              amount: tradeResult.summary.demand,
            },
            amount: -1n,
          }
        : { amount: tradeResult.summary.demand - fee };

      const payoutRules: PayoutRule[] = [
        // trade payout address
        {
          type: PayoutAmountRuleType.FIXED,
          locking_bytecode: addressToLockingBytecode(receiveAddress.address),
          ...demandTokenRule,
        },
        // all of our change outputs to one address
        {
          type: PayoutAmountRuleType.CHANGE,
          locking_bytecode: addressToLockingBytecode(changeAddress.address),
          allow_mixing_native_and_token_when_bch_change_is_dust: true,
        },
        // cauldron utxos handled by cashlab
      ];

      Log.debug("payoutRules", payoutRules);

      // input supply token
      const UtxoManager = UtxoManagerService(walletHash);
      const KeyManager = KeyManagerService(wallet);

      const supplyInputs = isDemandToken
        ? UtxoManager.selectCoins(tradeResult.summary.supply + fee)
        : [
            ...UtxoManager.selectTokens(
              supplyCategory,
              tradeResult.summary.supply
            ),
            ...UtxoManager.selectCoins(fee),
          ];

      const clabInputs: SpendableCoin[] = supplyInputs.map((input) => {
        return {
          type: SpendableCoinType.P2PKH,
          key: KeyManager.getAddressPrivateKey(input.address),
          output: {
            locking_bytecode: addressToLockingBytecode(input.address),
            token:
              input.token_amount > 0
                ? {
                    amount: input.token_amount,
                    token_id: input.token_category,
                  }
                : undefined,
            amount: input.valueSatoshis,
          },
          outpoint: {
            txhash: hexToBin(input.tx_hash),
            index: input.tx_pos,
          },
        };
      });

      try {
        const tradeTx = exchangeLab.createTradeTx(
          tradeResult.entries,
          clabInputs,
          payoutRules,
          null,
          TX_FEE_PER_BYTE
        );
        Log.debug("tradeTx", tradeTx);
        return tradeTx;
      } catch (e) {
        if (e.required_amount) {
          return attemptTrade(fee + e.required_amount);
        }
        throw e;
      }
    };

    const tradeTx = attemptTrade(0n);
    const tx_hex = binToHex(tradeTx.txbin);
    return { tx_hex, tradeResult, tradeTx };
  }
}
