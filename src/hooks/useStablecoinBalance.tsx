import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { selectActiveWalletBalance } from "@/redux/wallet";

import CauldronService from "@/kernel/bch/CauldronService";
import CurrencyService from "@/kernel/bch/CurrencyService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";

import { MUSD_TOKENID } from "@/util/tokens";

export function useStablecoinBalance(walletHash) {
  const UtxoManager = UtxoManagerService(walletHash);
  const stablecoinUtxos = UtxoManager.getCategoryUtxos(MUSD_TOKENID);

  const [stablecoinPrice, setStablecoinPrice] = useState(
    CurrencyService().fiatToSats(0.01)
  );

  const Cauldron = useMemo(() => CauldronService(), []);

  const subscriptionHandler = useCallback(
    () => setStablecoinPrice(Cauldron.getTokenPrice(MUSD_TOKENID)),
    [Cauldron]
  );

  useEffect(
    function cauldronSubscribe() {
      const subscribe = async () => {
        if (!Cauldron.getIsConnected()) {
          await Cauldron.connect();
        }

        Cauldron.subscribe(MUSD_TOKENID, subscriptionHandler);
      };

      subscribe();

      return () => {
        Cauldron.removeHandler(MUSD_TOKENID, subscriptionHandler);
      };
    },
    [Cauldron, subscriptionHandler]
  );

  const stablecoinBalance = useMemo(
    () => stablecoinUtxos.reduce((sum, cur) => sum + cur.token_amount, 0n),
    [stablecoinUtxos]
  );

  const { spendable_balance } = useSelector(selectActiveWalletBalance);

  const totalSpendableSats =
    stablecoinBalance * stablecoinPrice + spendable_balance;

  return { stablecoinBalance, totalSpendableSats };
}
