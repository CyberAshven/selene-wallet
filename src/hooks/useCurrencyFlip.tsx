import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import { selectCurrencySettings, setPreference } from "@/redux/preferences";

export function useCurrencyFlip() {
  const dispatch = useDispatch();

  const { shouldPreferLocalCurrency } = useSelector(selectCurrencySettings);

  const handleFlipCurrency = useCallback(() => {
    dispatch(
      setPreference({
        key: "preferLocalCurrency",
        value: shouldPreferLocalCurrency ? "false" : "true",
      })
    );
  }, [dispatch, shouldPreferLocalCurrency]);

  return handleFlipCurrency;
}
