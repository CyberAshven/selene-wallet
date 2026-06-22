import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router";
import { Decimal } from "decimal.js";
import {
  CloseOutlined,
  CopyOutlined,
  ExperimentOutlined,
  TransactionOutlined,
} from "@ant-design/icons";

import { selectActiveWallet } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import CauldronService from "@/kernel/bch/CauldronService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import TokenManagerService from "@/kernel/wallet/TokenManagerService";

import WalletViewBalance from "@/views/wallet/home/WalletViewBalance";
import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";
import Button from "@/atoms/Button";
import Card from "@/atoms/Card";
import NumberFormat from "@/atoms/NumberFormat";
import Satoshi from "@/atoms/Satoshi";
import { SatoshiInput } from "@/atoms/SatoshiInput";
import TokenIcon from "@/atoms/TokenIcon";

import { useClipboard } from "@/hooks/useClipboard";

import { MUSD_TOKENID } from "@/util/tokens";

const Log = LogService("AppCauldronDexView");

function useCauldron(tokenId) {
  const [cauldron, setCauldron] = useState(null);
  const [utxos, setUtxos] = useState([]);

  useEffect(
    function setupCauldronService() {
      const setup = async () => {
        const Cauldron = CauldronService();
        setCauldron(Cauldron);
        await Cauldron.connect();
        Cauldron.subscribe(tokenId, (utxos) => {
          Log.debug("notification", utxos);
          setUtxos(utxos);
        });
      };

      if (cauldron === null) {
        setup();
      }

      return () => {
        if (cauldron) {
          cauldron.disconnect();
          setCauldron(null);
        }
      };
    },
    [cauldron, tokenId]
  );

  return { Cauldron: cauldron, utxos };
}

export default function AppCauldronDexView() {
  const dispatch = useDispatch();
  const location = useLocation();

  const wallet = useSelector(selectActiveWallet);
  const { walletHash, network: bchNetwork } = wallet;

  const [cauldronToken, setCauldronToken] = useState(MUSD_TOKENID);
  const [isFlipped, setIsFlipped] = useState(false);

  const [satsInput, setSatsInput] = useState(0n);
  const [tokenInput, setTokenInput] = useState(0n);

  const [satsInputKey, setSatsInputKey] = useState(satsInput);
  const [tokenInputKey, setTokenInputKey] = useState(tokenInput);

  const TokenManager = TokenManagerService(walletHash, bchNetwork);
  const cauldronTokenData = TokenManager.getToken(cauldronToken);

  const { Cauldron, utxos: cauldrons } = useCauldron(cauldronToken);

  const tokenTotal = cauldrons.reduce(
    (sum, cur) => sum + BigInt(cur.token_amount),
    0n
  );
  const satsTotal = cauldrons.reduce((sum, cur) => sum + BigInt(cur.sats), 0n);

  const price = BigInt(
    satsTotal > 0 && tokenTotal > 0 ? satsTotal / tokenTotal : 0n
  );
  const scalar = 10 ** (cauldronTokenData.token.decimals || 0);

  const scaledPrice = price * BigInt(scalar);

  const tokenList = TokenManager.getTokenCategories();
  const tokenListData = tokenList.map((t) => TokenManager.getToken(t));

  const handleSatsInput = useCallback(
    (sats) => {
      setSatsInput(sats);
      const newTokenAmount = sats / price;
      setTokenInput(newTokenAmount);

      setTokenInputKey(newTokenAmount);
    },
    [price]
  );

  const handleTokenInput = useCallback(
    (amount) => {
      setTokenInput(amount);

      const newSatsAmount = amount * price;
      setSatsInput(newSatsAmount);

      setSatsInputKey(newSatsAmount);
    },
    [price]
  );

  const handleTokenCategorySelect = (event) => {
    setCauldronToken(event.target.value);
  };

  const supplyDemandRender = useCallback(() => {
    const tokenSpan = (
      <span style={{ color: cauldronTokenData.color }} className="font-bold">
        {cauldronTokenData.symbol}
      </span>
    );

    const bchSpan = <span className="font-bold">BCH</span>;

    return [
      <div>
        <div>
          <span className="text-neutral-500 mr-1">You pay</span>
          {isFlipped ? tokenSpan : bchSpan}
        </div>
        <div className="flex items-center justify-between">
          <SatoshiInput
            key={isFlipped ? tokenInputKey : satsInputKey}
            satoshis={isFlipped ? tokenInput : satsInput}
            className="text-3xl p-2 rounded w-full border border-primary-700 shadow-inner"
            onChange={isFlipped ? handleTokenInput : handleSatsInput}
            tokenDecimals={
              isFlipped ? cauldronTokenData.token.decimals : undefined
            }
          />
          <div className="ml-2 flex flex-col items-center justify-center">
            <div>
              <TokenIcon
                category={isFlipped ? cauldronToken : "BCH"}
                size={64}
                rounded
              />
            </div>
          </div>
        </div>
      </div>,
      <div>
        <div>
          <span className="text-neutral-500 mr-1">You receive</span>
          {isFlipped ? bchSpan : tokenSpan}
        </div>
        <div className="flex items-center justify-between">
          <SatoshiInput
            key={isFlipped ? satsInputKey : tokenInputKey}
            satoshis={isFlipped ? satsInput : tokenInput}
            className="text-3xl my-1 p-2 rounded w-full border border-primary-700 shadow-inner"
            onChange={isFlipped ? handleSatsInput : handleTokenInput}
            tokenDecimals={
              isFlipped ? undefined : cauldronTokenData.token.decimals
            }
          />
          <div className="ml-2 flex flex-col items-center justify-center">
            <TokenIcon
              category={isFlipped ? "BCH" : cauldronToken}
              size={64}
              rounded
            />
          </div>
        </div>
      </div>,
    ];
  }, [
    cauldronToken,
    cauldronTokenData,
    isFlipped,
    satsInput,
    satsInputKey,
    tokenInput,
    tokenInputKey,
    handleSatsInput,
    handleTokenInput,
  ]);

  const handleFlipInputs = () => {
    setIsFlipped(!isFlipped);
  };

  const handleTrade = async () => {
    const supplyCategory = isFlipped ? cauldronToken : "BCH";
    const supplyAmount = isFlipped ? tokenInput : satsInput;

    const demandCategory = isFlipped ? "BCH" : cauldronToken;
    const demandAmount = isFlipped ? satsInput : tokenInput;

    const tx_hex = Cauldron.prepareTrade(
      supplyCategory,
      demandCategory,
      supplyAmount,
      demandAmount,
      wallet,
      isFlipped
    );

    const tx_hash = await Cauldron.broadcastTransaction(tx_hex);
    Log.debug("broadcastTransaction success", tx_hash);
  };

  return (
    <FullColumn>
      <ViewHeader title="Cauldron DEX" icon={ExperimentOutlined} />
      <div className="bg-neutral-900">
        <WalletViewBalance />
      </div>
      <div className="p-4">
        <Card className="p-2">
          <select
            className="w-full p-2 bg-primary-100 text-lg"
            onChange={handleTokenCategorySelect}
            value={cauldronToken}
          >
            {tokenListData.map((t) => (
              <option value={t.category}>{t.symbol}</option>
            ))}
          </select>
        </Card>

        <Card className="p-2">
          <div className="flex flex-col justify-center p-2">
            {supplyDemandRender()[0]}
            <div className="">
              <Button
                icon={TransactionOutlined}
                padding="2"
                rounded="md"
                onClick={handleFlipInputs}
              />
            </div>
            {supplyDemandRender()[1]}
          </div>
        </Card>

        <div className="my-2">
          <Button
            label="Swap"
            fullWidth
            rounded="lg"
            inverted
            labelSize="xl"
            onClick={handleTrade}
          />
        </div>

        <Card className="p-2">
          <ul>
            <li>{cauldrons.length} pools</li>
            <li>
              $
              <NumberFormat
                number={tokenTotal}
                decimals={cauldronTokenData.token.decimals}
                scalar={-cauldronTokenData.token.decimals}
              />{" "}
              {cauldronTokenData.symbol}
            </li>
            <li>
              <Satoshi value={satsTotal} fiat={false} />
            </li>
            <li>
              Price: <Satoshi value={scaledPrice} /> (
              <Satoshi value={scaledPrice} flip />) per{" "}
              <NumberFormat
                number={1 * scalar}
                decimals={cauldronTokenData.token.decimals}
                scalar={-cauldronTokenData.token.decimals}
              />{" "}
              {cauldronTokenData.symbol}
            </li>
          </ul>
        </Card>
      </div>
    </FullColumn>
  );
}
