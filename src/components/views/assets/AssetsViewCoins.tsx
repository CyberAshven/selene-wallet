import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router";
import {
  CloseOutlined,
  MoneyCollectOutlined,
  SendOutlined,
} from "@ant-design/icons";

import TokenManagerService from "@/kernel/wallet/TokenManagerService";
import UtxoManagerService from "@/kernel/wallet/UtxoManagerService";

import FullColumn from "@/layout/FullColumn";
import Address from "@/atoms/Address";
import Button from "@/atoms/Button";
import Card from "@/atoms/Card";
import CurrencyFlip from "@/atoms/CurrencyFlip";
import KeyWarning from "@/atoms/KeyWarning/KeyWarning";
import Satoshi from "@/atoms/Satoshi";
import SeleneLogo from "@/atoms/SeleneLogo";
import TokenAmount from "@/atoms/TokenAmount";
import TokenIcon from "@/atoms/TokenIcon";
import TokenSymbol from "@/atoms/TokenSymbol";

import { useCurrencyFlip } from "@/hooks/useCurrencyFlip";

import { translate } from "@/util/translations";
import translations from "./translations";

export default function AssetsViewCoins() {
  const wallet = useOutletContext();
  const navigate = useNavigate();

  const UtxoManager = UtxoManagerService(wallet.walletHash);
  const coins = UtxoManager.getWalletCoins();
  const tokens = UtxoManager.getWalletTokens();

  const [selection, setSelection] = useState([]);

  const handleFlipCurrency = useCurrencyFlip();

  const tokenCategories = tokens.reduce(
    (categories, utxo) =>
      categories.includes(utxo.token_category)
        ? categories
        : [...categories, utxo.token_category],
    []
  );

  const TokenManager = TokenManagerService(wallet.walletHash, wallet.network);

  const tokenData = Object.fromEntries(
    tokenCategories.map((category) => [
      category,
      TokenManager.getToken(category),
    ])
  );

  const mapUtxos = (map, utxo) => {
    if (!map[utxo.address]) {
      /* eslint-disable-next-line no-param-reassign */
      map[utxo.address] = [];
    }

    if (!utxo.key) {
      /* eslint-disable-next-line no-param-reassign */
      utxo.key = `${utxo.tx_hash}:${utxo.tx_pos}`;
    }

    return {
      ...map,
      [utxo.address]: [
        ...map[utxo.address],
        {
          ...utxo,
          selected: selection.findIndex((s) => s.key === utxo.key) > -1,
        },
      ],
    };
  };

  const coinMap = coins.reduce(mapUtxos, {});
  const tokenMap = tokens.reduce(mapUtxos, {});
  //Log.debug("coinMap", coins, coinMap, selection);
  //Log.debug("tokenMap", tokens, tokenMap, selection);

  const coinAddresses = Object.keys(coinMap);
  const tokenAddresses = Object.keys(tokenMap);

  const handleCoinSelection = (key, forceSelect) => {
    setSelection((currentSelection) => {
      const selectCoin = Object.values(coinMap)
        .concat(Object.values(tokenMap))
        .flat()
        .find((coin) => coin.key === key);

      const selectIndex = currentSelection.findIndex(
        (coin) => coin.key === key
      );

      const newSelection =
        selectIndex === -1 &&
        (forceSelect === true || forceSelect === undefined)
          ? currentSelection.concat(selectCoin)
          : currentSelection.filter(
              (coin, i) => forceSelect === true || selectIndex !== i
            );

      //Log.debug("handleCoinSelection", key, forceSelect, newSelection);

      return newSelection;
    });
  };

  const handleSelectionCancel = () => {
    setSelection([]);
  };

  const handleSelectionConfirm = () => {
    navigate("/wallet/send", {
      state: {
        selection,
      },
    });
    setSelection([]);
  };

  return (
    <FullColumn className="justify-start">
      <KeyWarning walletHash={wallet.walletHash} />

      <div className="my-1 flex flex-1 flex-col gap-y-1">
        <Card className="p-0 overflow-hidden">
          <div
            className="p-1 rounded bg-neutral-800 text-white text-center"
            onClick={handleFlipCurrency}
          >
            <div className="text-lg font-bold">
              {translate(translations.cashBalance)}
            </div>
            <div>
              <Satoshi value={wallet.spendable_balance} />
            </div>
            <div className="text-sm flex items-center justify-center">
              <Satoshi value={wallet.spendable_balance} flip />
              <CurrencyFlip className="ml-1" />
            </div>
          </div>

          <div className="p-1">
            {coinAddresses.map((address) => (
              <CoinGroup
                address={address}
                coins={coinMap[address]}
                onCoinSelect={handleCoinSelection}
              />
            ))}
          </div>
        </Card>

        {tokenAddresses.length > 0 && (
          <Card className="p-0 overflow-hidden">
            <div className="p-1 rounded bg-neutral-800 text-white text-center">
              <div className="text-lg font-bold">Tokens</div>
            </div>
            <div className="p-1">
              {tokenAddresses.map((address) => (
                <CoinGroup
                  address={address}
                  coins={tokenMap[address]}
                  tokenData={tokenData}
                  onCoinSelect={handleCoinSelection}
                />
              ))}
            </div>
          </Card>
        )}

        {coinAddresses.length === 0 && tokenAddresses.length === 0 && (
          <div className="text-center py-4 rounded text-2xl text-neutral-700/90 dark:text-neutral-200">
            {translate(translations.noCoins)}
            <div className="flex items-center justify-center mt-2">
              <SeleneLogo className="h-32" />
            </div>
          </div>
        )}
      </div>
      {selection.length > 0 && (
        <SelectionDisplay
          selection={selection}
          onConfirm={handleSelectionConfirm}
          onCancel={handleSelectionCancel}
        />
      )}
    </FullColumn>
  );
}

/* eslint-disable react/prop-types */
function CoinGroup({ address, coins, tokenData, onCoinSelect }) {
  const isSelected = coins.every((coin) => coin.selected);

  const selectCss = isSelected
    ? "bg-primary-500 border-2 border-primary-700 text-neutral-700 dark:bg-primarydark-400 dark:border-primarydark-300"
    : "bg-primary-300 text-neutral-600 border border-neutral-500 dark:bg-primarydark-200 dark:text-neutral-50 dark:border-neutral-700";

  const handleGroupSelection = () => {
    coins.forEach((coin) => onCoinSelect(coin.key, !isSelected));
  };

  const format = tokenData !== undefined ? "tokenaddr" : "cashaddr";

  return (
    <div className={`rounded my-1 ${selectCss}`} onClick={handleGroupSelection}>
      <div className="py-0.5 px-1 font-mono text-xs tracking-tight">
        <Address address={address} color="white" format={format} />
      </div>
      <div className="m-0.5 border-1 border-primary-700 rounded-sm">
        {coins.map((coin) =>
          coin.token_category !== null ? (
            <Token
              key={coin.key}
              coin={coin}
              tokenData={tokenData[coin.token_category]}
              onSelect={onCoinSelect}
            />
          ) : (
            <Coin key={coin.key} coin={coin} onSelect={onCoinSelect} />
          )
        )}
      </div>
    </div>
  );
}

function Coin({ coin, onSelect }) {
  const selectCss = coin.selected
    ? "bg-primary-200 text-neutral-700 border border-primary-500 dark:bg-primarydark-200 dark:text-neutral-50 dark:border-primarydark-100"
    : "bg-primary-100 text-neutral-700 border border-primary-200 dark:bg-neutral-700 dark:border-primarydark-100 dark:text-neutral-100";

  const handleSelection = (event) => {
    onSelect(coin.key);
    event.stopPropagation();
  };

  return (
    <div
      className={`p-1 text-sm flex-1 ${selectCss}`}
      onClick={handleSelection}
    >
      <div className="flex items-center">
        <MoneyCollectOutlined className="mr-1" />
        <div className="flex items-center justify-between w-full">
          <Satoshi value={coin.valueSatoshis} />
          <span className="text-sm opacity-80">
            <Satoshi value={coin.valueSatoshis} flip />
          </span>
        </div>
      </div>
    </div>
  );
}

function Token({ coin, tokenData, onSelect }) {
  const selectCss = coin.selected
    ? "bg-primary-200 text-neutral-700 border border-primary-500 dark:bg-primarydark-200 dark:text-neutral-50 dark:border-primarydark-100"
    : "bg-primary-100 text-neutral-700 border border-primary-200 dark:bg-neutral-700 dark:border-primarydark-100 dark:text-neutral-100";

  const handleSelection = (event) => {
    onSelect(coin.key);
    event.stopPropagation();
  };

  return (
    <div
      className={`p-1 text-sm flex-1 ${selectCss}`}
      onClick={handleSelection}
    >
      <div className="flex items-center">
        <TokenIcon category={coin.token_category} size={18} />
        <div className="flex items-center justify-between w-full">
          <TokenSymbol token={tokenData} />
          <span className="text-sm opacity-80 flex items-center">
            <TokenAmount
              token={{ ...tokenData, amount: coin.token_amount }}
              nft={coin.nft_capability !== null}
            />
            <span className="text-xs font-mono truncate max-w-32">
              {coin.nft_commitment}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function SelectionDisplay({ selection, onConfirm, onCancel }) {
  const selectedAmount = selection.reduce(
    (sum, coin) => sum + coin.valueSatoshis,
    0n
  );

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div className="sticky bottom-0 bg-primary-900 w-full border-t-2 border-neutral-900 dark:border-primarydark-500 rounded-t shadow mt-1">
      <div className="text-neutral-700 rounded-t bg-neutral-100 dark:bg-neutral-1000 dark:text-neutral-100 shadow-lg px-2 py-1">
        <div className="flex relative justify-between">
          <div className="flex items-center justify-start flex-1">
            <Button
              onClick={handleCancel}
              icon={CloseOutlined}
              activeBgColor="bg-primary-500 dark:active:bg-primarydark-400"
              borderClasses="border border-primary-400"
              shadow
            />
          </div>
          <div className="text-center grow">
            <div className="text-lg font-semibold">Selected Amount</div>
            <div className="text-lg">
              <Satoshi value={selectedAmount} />
            </div>
            <div className="text-base">
              <Satoshi value={selectedAmount} flip />
            </div>
          </div>
          <div className="flex items-center justify-end flex-1">
            <Button
              onClick={handleConfirm}
              icon={SendOutlined}
              iconSize="xl"
              label="Send"
              labelSize="lg"
              bgColor="bg-primary-700"
              activeLabelColor="text-white"
              labelColor="text-neutral-200"
              borderClasses="border border-primary-700"
              inverted
            />
          </div>
        </div>
      </div>
    </div>
  );
}
