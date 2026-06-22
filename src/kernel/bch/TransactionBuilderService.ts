import {
  assertSuccess,
  encodeTransaction,
  generateTransaction,
  getDustThreshold,
  getMinimumFee,
  importWalletTemplate,
  Output as LibauthOutput,
  swapEndianness,
  walletTemplateP2pkhNonHd,
  walletTemplateToCompilerBCH,
} from "@bitauth/libauth";
import {
  ExchangeLab,
  type PoolV0,
  type TradeResult,
  type TradeTxResult,
} from "@cashlab/cauldron";
import {
  InsufficientFunds,
  PayoutAmountRuleType,
  SpendableCoinType,
  type Output,
  type PayoutRule,
  type SpendableCoin,
  ValueError,
} from "@cashlab/common";

import LogService from "@/kernel/app/LogService";
import CauldronService from "@/kernel/bch/CauldronService";
import {
  TransactionOutput,
  TransactionStub,
} from "@/kernel/bch/TransactionManagerService";
import AddressManagerService, {
  AddressEntity,
} from "@/kernel/wallet/AddressManagerService";
import AddressScannerService from "@/kernel/wallet/AddressScannerService";
import KeyManagerService from "@/kernel/wallet/KeyManagerService";
import UtxoManagerService, {
  UtxoEntity,
} from "@/kernel/wallet/UtxoManagerService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import { addressToLockingBytecode } from "@/util/cashaddr";
import { sha256 } from "@/util/hash";
import { binToHex, compareBytes, hexToBin } from "@/util/hex";
import { DUST_RELAY_FEE, EXCESSIVE_SATOSHIS } from "@/util/sats";
import { findUnmatchedNftInputs } from "@/util/token";
import { MUSD_TOKENID } from "@/util/tokens";

export interface Recipient {
  address: string;
  amount: bigint;
  token?: {
    category: string;
    amount: bigint;
    nft?: {
      capability: "minting" | "mutable" | "none";
      commitment?: Uint8Array;
    };
  };
}

const TXFEE_PER_BYTE = DUST_RELAY_FEE / 1000n;

const Log = LogService("TxBuilder");

export class TransactionBuilderError extends Error {}

export default function TransactionBuilderService(walletHash: string) {
  const WalletManager = WalletManagerService();
  const wallet = WalletManager.getWallet(walletHash);

  return {
    buildP2pkhTransaction,
    buildStablecoinTransaction,
    buildSendTokensTransactionWithFeePayingTokenCategory,
    calculateTransactionHash,
  };

  // --------------------------------

  function calculateTransactionHash(tx_raw: Uint8Array): string {
    const tx_hash = swapEndianness(binToHex(sha256.hash(sha256.hash(tx_raw))));
    return tx_hash;
  }

  function createTokenOutput(
    recipientAddress,
    token,
    satsAmount = EXCESSIVE_SATOSHIS
  ): LibauthOutput {
    const output = {
      lockingBytecode: addressToLockingBytecode(recipientAddress),
      valueSatoshis: satsAmount,
      token: {
        ...token,
        category: hexToBin(token.category),
      },
    };

    Log.debug("createTokenOutput", output, token);

    const dustThreshold = getDustThreshold(output, DUST_RELAY_FEE);
    if (satsAmount < dustThreshold || satsAmount === EXCESSIVE_SATOSHIS) {
      output.valueSatoshis = dustThreshold;
    }

    return output;
  }

  function createCoinOutput(recipientAddress, amount): LibauthOutput {
    const output = {
      lockingBytecode: addressToLockingBytecode(recipientAddress),
      valueSatoshis: amount,
    };

    Log.debug("createCoinOutput", output);
    return output;
  }

  // prepare outputs
  function prepareOutputsFromRecipients(
    recipients: Array<Recipient>
  ): Array<LibauthOutput> {
    const coinRecipients = recipients.filter(
      (recipient) => recipient.token === undefined
    );
    const coinVout: Array<LibauthOutput> = coinRecipients.map((recipient) =>
      createCoinOutput(recipient.address, recipient.amount)
    );

    // prepare token outputs
    const tokenRecipients = recipients.filter(
      (recipient) => recipient.token !== undefined
    );
    const tokenVout: Array<LibauthOutput> = tokenRecipients.map((recipient) =>
      createTokenOutput(recipient.address, recipient.token, recipient.amount)
    );

    // calculate total amount to send for all recipients
    const vout = [...coinVout, ...tokenVout];
    return vout;
  }

  function buildP2pkhTransaction({
    recipients,
    fee = 0n,
    gas = 0n,
    depth = 0,
    selection = [],
    nftSelection = [],
  }: {
    recipients: Array<Recipient>;
    fee?: bigint;
    gas?: bigint;
    depth?: number;
    selection?: Array<TransactionOutput>;
    nftSelection?: Array<TransactionOutput>;
  }): TransactionStub | bigint {
    const hasSelection = selection.length > 0;

    Log.debug("buildP2pkhTransaction depth", depth);
    // prepare outputs
    const recipientVouts = prepareOutputsFromRecipients(recipients);
    const recipientOutputTotal = recipientVouts.reduce(
      (sum, cur) => sum + cur.valueSatoshis,
      0n
    );

    const recipientCoinTotal = recipientVouts
      .filter((out) => out.token === undefined)
      .reduce((sum, cur) => sum + cur.valueSatoshis, 0n);

    const sendTotal = recipientOutputTotal + fee + gas;

    Log.debug(
      "buildP2pkhTransaction recipients:",
      recipientVouts,
      recipientOutputTotal,
      fee,
      sendTotal,
      gas
    );

    const tokenOutputAmountsByCategory = recipientVouts.reduce(
      (amounts, output) => {
        // calculate total output amounts for each token category
        if (!output.token || output.token.nft) {
          return amounts;
        }

        const { category, amount } = output.token;

        const categoryHex = binToHex(category);
        const categoryAmount = amounts.get(categoryHex) || 0n;
        amounts.set(categoryHex, categoryAmount + amount);

        return amounts;
      },
      new Map<string, bigint>()
    );

    const tokenCategories = Array.from(tokenOutputAmountsByCategory.keys());
    const hasTokens = tokenCategories.length > 0;
    const hasNft = nftSelection.length > 0;

    // gather suitable inputs
    const UtxoManager = UtxoManagerService(wallet.walletHash);

    const tokenInputs = tokenCategories
      .map((category) => {
        const amount = tokenOutputAmountsByCategory.get(category);
        return amount ? UtxoManager.selectTokens(category, amount) : [];
      })
      .flat();

    const coinInputs = UtxoManager.selectCoins(recipientCoinTotal + fee + gas);

    const inputs = hasSelection
      ? selection
      : [...nftSelection, ...tokenInputs, ...coinInputs];

    const inputTotal = inputs.reduce((sum, cur) => sum + cur.valueSatoshis, 0n);
    Log.debug("buildP2pkhTransaction using inputs:", inputs, inputTotal);

    if (inputTotal < sendTotal) {
      return sendTotal;
    }

    const preparedTokenChange = prepareTokenChange(inputs, recipientVouts);

    const outputs = finalizeChange(
      inputs,
      [...recipientVouts, ...preparedTokenChange],
      fee
    );

    const finalOutputTotal = outputs.reduce(
      (sum, cur) => sum + cur.valueSatoshis,
      0n
    );

    const transaction = compileP2pkhTransaction(inputs, outputs);
    Log.debug("buildP2pkhTransaction transaction", transaction);

    if (fee < transaction.minimumFee) {
      Log.debug("fee less than minimum, retrying", fee, transaction.minimumFee);
      return buildP2pkhTransaction({
        recipients,
        selection,
        nftSelection,
        fee: transaction.minimumFee,
        gas,
        depth: depth + 1,
      });
    }

    // insufficient funds
    if (inputTotal < finalOutputTotal) {
      const short = finalOutputTotal - inputTotal;
      Log.debug(
        "buildP2pkhTransaction: insufficient funds",
        inputTotal,
        finalOutputTotal,
        fee,
        short
      );

      if (
        (hasTokens || hasNft) &&
        wallet.spendable_balance >= finalOutputTotal + fee
      ) {
        Log.debug("token tx attempting to gas up", short);

        return buildP2pkhTransaction({
          recipients,
          nftSelection,
          fee,
          gas: short + gas,
          depth: depth + 1,
        });
      }

      return short;
    }

    // ----------------

    function prepareTokenChange(vin, vout): Array<LibauthOutput> {
      const tokenVin = vin.filter((input) => input.token_category !== null);

      const tokenOutputs = vout.filter(
        (output) => output.token && output.token.category !== null
      );

      // calculate total input amounts for each token category
      const tokenCategoryInputAmounts: Map<string, bigint> = tokenVin.reduce(
        (tokenAmounts, input) => {
          const category = input.token_category;

          const mapAmount = tokenAmounts.get(category) || 0n;
          tokenAmounts.set(category, mapAmount + input.token_amount);

          return tokenAmounts;
        },
        new Map<string, bigint>()
      );

      // calculate total output amounts for each token category
      const tokenCategoryOutputAmounts: Map<string, bigint> =
        tokenOutputs.reduce((amounts, output) => {
          if (!output.token || output.token.nft) {
            return amounts;
          }

          const { category, amount } = output.token;

          const categoryHex = binToHex(category);
          const categoryAmount = amounts.get(categoryHex) || 0n;
          amounts.set(categoryHex, categoryAmount + amount);

          return amounts;
        }, new Map<string, bigint>());

      Log.debug(
        "prepareTokenChange",
        tokenVin,
        tokenOutputs,
        tokenCategoryInputAmounts,
        tokenCategoryOutputAmounts
      );

      // create token change outputs for each category
      const categories: Array<string> = [
        ...tokenCategoryOutputAmounts.keys(),
        ...tokenCategoryInputAmounts.keys(),
      ].reduce(
        (acc, cur) => (acc.includes(cur) ? acc : [...acc, cur]),
        [] as Array<string>
      );

      // Find NFT inputs with no matching recipient output (need change)
      const unmatchedNftInputs = findUnmatchedNftInputs(tokenVin, vout);

      // get change addresses
      const addressCount = categories.length + unmatchedNftInputs.length + 1;
      const AddressManager = AddressManagerService(wallet.walletHash);
      const AddressScanner = AddressScannerService(wallet);

      AddressScanner.populateAddresses(addressCount);

      const changeAddresses = AddressManager.getUnusedAddresses(
        addressCount,
        1
      );

      const tokenChangeVouts: Array<LibauthOutput> = [];
      while (categories.length > 0) {
        // each category gets its own change address
        const category = categories.shift() as string;
        const changeAddress = changeAddresses.shift() as AddressEntity;

        // get amount of tokens spent; remainder is change
        const tokenAmountIn = tokenCategoryInputAmounts.get(category) || 0n;
        const tokenAmountOut = tokenCategoryOutputAmounts.get(category) || 0n;

        const tokenChange = tokenAmountIn - tokenAmountOut;

        const tokenChangeOutput = createTokenOutput(changeAddress.address, {
          category,
          amount: tokenChange,
        });

        if (tokenChange > 0 && tokenChangeOutput.valueSatoshis > 0) {
          Log.debug("tokenChangeOutput", tokenChangeOutput);
          tokenChangeVouts.push(tokenChangeOutput);
        }
      }

      // Forward unmatched NFT inputs as change
      unmatchedNftInputs.forEach((input) => {
        const changeAddress = changeAddresses.shift() as AddressEntity;
        const nftChangeOutput = createTokenOutput(changeAddress.address, {
          category: input.token_category,
          amount: 0n,
          nft: {
            capability: input.nft_capability,
            commitment: input.nft_commitment
              ? hexToBin(input.nft_commitment)
              : new Uint8Array(),
          },
        });
        tokenChangeVouts.push(nftChangeOutput);
      });

      Log.debug("tokenChangeVouts", tokenChangeVouts);
      return tokenChangeVouts;
    }

    function finalizeChange(vin, vout, txFee): Array<LibauthOutput> {
      const satsInputTotal = vin.reduce(
        (sum, cur) => sum + cur.valueSatoshis,
        0n
      );

      const satsOutputTotal = vout.reduce(
        (sum, cur) => sum + cur.valueSatoshis,
        0n
      );

      const changeAmount = satsInputTotal - satsOutputTotal - txFee;

      // get change addresses
      const AddressManager = AddressManagerService(wallet.walletHash);
      const changeAddresses = AddressManager.getUnusedAddresses(1, 1);
      const changeAddress = changeAddresses.shift();

      const changeOutput = createCoinOutput(
        changeAddress.address,
        changeAmount
      );

      const changeVouts: Array<LibauthOutput> = [];
      const temp_vout = [...vout];

      // only add change to the tx if it isn't dust.
      const dustThreshold = getDustThreshold(changeOutput, DUST_RELAY_FEE);

      if (changeAmount >= dustThreshold) {
        changeVouts.push(changeOutput);
      } else if (changeAmount > txFee) {
        const lastOutput = temp_vout.pop();
        lastOutput.valueSatoshis += changeAmount;
        temp_vout.push(lastOutput);
      }

      return [...temp_vout, ...changeVouts];
    }

    // ----------------
    function compileP2pkhTransaction(vin, vout) {
      // initialize transaction compiler
      const template = assertSuccess(
        importWalletTemplate(walletTemplateP2pkhNonHd)
      );
      const compiler = walletTemplateToCompilerBCH(template);

      // sign inputs
      const KeyManager = KeyManagerService(wallet);
      const signedInputs = KeyManager.signInputs(
        vin.sort(bip69SortInputs),
        compiler
      );

      const generatedTx = generateTransaction({
        inputs: signedInputs,
        outputs: vout.sort(bip69SortOutputs),
        locktime: 0,
        version: 2,
      });

      if (generatedTx.success === false) {
        Log.warn("tx generation failed", generatedTx);
        throw new Error(JSON.stringify(generatedTx));
      }

      Log.debug("compileP2pkhTransaction", vin, vout, generatedTx);

      const tx_raw = encodeTransaction(generatedTx.transaction);
      const tx_hex = binToHex(tx_raw);
      const tx_hash = swapEndianness(
        binToHex(sha256.hash(sha256.hash(tx_raw)))
      );

      const minimumFee = getMinimumFee(BigInt(tx_raw.length), DUST_RELAY_FEE);

      return { tx_hash, tx_hex, minimumFee };
    }

    return transaction;
  }

  function bip69SortInputs(a, b) {
    // BIP69: compare tx_hash as hex strings, then tx_pos as numbers
    if (a.tx_hash < b.tx_hash) return -1;
    if (a.tx_hash > b.tx_hash) return 1;
    return a.tx_pos - b.tx_pos;
  }

  // CashTokens BIP69 output sort (CHIP-2022-02-CashTokens §Transaction Order)
  function bip69SortOutputs(a, b) {
    // 1. value ascending
    if (a.valueSatoshis < b.valueSatoshis) return -1;
    if (a.valueSatoshis > b.valueSatoshis) return 1;

    // 2. locking bytecode — byte-by-byte lexicographic
    const lockCmp = compareBytes(a.lockingBytecode, b.lockingBytecode);
    if (lockCmp !== 0) return lockCmp;

    // 3. token presence (no tokens < has tokens)
    if (!a.token && b.token) return -1;
    if (a.token && !b.token) return 1;
    if (!a.token && !b.token) return 0;

    // 4. fungible token amount ascending
    if (a.token.amount < b.token.amount) return -1;
    if (a.token.amount > b.token.amount) return 1;

    // 5. NFT presence (false < true)
    if (!a.token.nft && b.token.nft) return -1;
    if (a.token.nft && !b.token.nft) return 1;

    // 6. NFT fields
    if (a.token.nft && b.token.nft) {
      // 6a. capability: none < mutable < minting
      const capabilityRank = { none: 0, mutable: 1, minting: 2 };
      const aRank = capabilityRank[a.token.nft.capability] ?? 0;
      const bRank = capabilityRank[b.token.nft.capability] ?? 0;
      if (aRank < bRank) return -1;
      if (aRank > bRank) return 1;

      // 6b. commitment — byte-by-byte lexicographic
      const commitCmp = compareBytes(
        a.token.nft.commitment,
        b.token.nft.commitment
      );
      if (commitCmp !== 0) return commitCmp;
    }

    // 7. category — already little-endian from libauth
    return compareBytes(a.token.category, b.token.category);
  }

  async function buildStablecoinTransaction(
    recipients: Array<Recipient>,
    tradeSats: bigint,
    fee: bigint = 0n
  ) {
    const Cauldron = CauldronService();
    const exchangeLab = new ExchangeLab();
    const UtxoManager = UtxoManagerService(wallet.walletHash);

    const inputPools = Cauldron.getPoolInputs(MUSD_TOKENID);

    const recipientAmount = recipients.reduce(
      (sum, cur) => sum + cur.amount,
      0n
    );

    const recipientTokenAmount = recipients.reduce(
      (sum, cur) => (cur.token ? sum + cur.token.amount : sum),
      0n
    );

    const price = Cauldron.getTokenPrice(MUSD_TOKENID);
    Log.debug(`${price} sats per 0.01 MUSD`);

    // recipientAmount denominated in stablecoin token
    const tokenTotal = recipientAmount / price + recipientTokenAmount;

    Log.debug("tokenTotal", tokenTotal, "(musd)");
    Log.debug("recipientAmount", recipientAmount, "(sats only)");
    Log.debug("tradeSats", tradeSats, "(sats)");
    Log.debug("estimated fee", fee, "(sats)");

    const tradeResult = exchangeLab.constructTradeBestRateForTargetDemand(
      MUSD_TOKENID,
      "BCH",
      tradeSats,
      inputPools,
      1n
    );

    let tradeTransaction = null;
    try {
      Log.debug("tradeResult", tradeResult);

      const stablecoinUtxos = UtxoManager.selectTokens(
        MUSD_TOKENID,
        tradeResult.summary.supply
      );
      Log.debug("tokenUtxos", stablecoinUtxos);

      const coinUtxos = UtxoManager.selectCoins(
        recipientAmount - tradeSats + fee
      );
      Log.debug("coinUtxos", coinUtxos);

      const inputs = [...stablecoinUtxos, ...coinUtxos];

      const KeyManager = KeyManagerService(wallet);
      const clabInputs: SpendableCoin[] = inputs.map((input) => {
        return {
          type: SpendableCoinType.P2PKH,
          key: KeyManager.getAddressPrivateKey(input.address),
          output: {
            locking_bytecode: addressToLockingBytecode(input.address),
            token:
              input.token_category !== null
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

      const AddressManager = AddressManagerService(wallet.walletHash);
      const changeAddresses = AddressManager.getUnusedAddresses(2, 1);
      let changeAddressIndex = 0;

      const payoutRules: PayoutRule[] = [
        ...recipients.map((r) => ({
          type: PayoutAmountRuleType.FIXED,
          locking_bytecode: addressToLockingBytecode(r.address),
          amount: r.amount,
          token: r.token
            ? {
                token_id: r.token.category,
                amount: r.token.amount,
              }
            : undefined,
        })),
        {
          type: PayoutAmountRuleType.CHANGE,
          generateChangeLockingBytecodeForOutput() {
            const changeAddress = changeAddresses[changeAddressIndex];
            if (changeAddressIndex + 1 < changeAddresses.length) {
              changeAddressIndex += 1;
            }
            return addressToLockingBytecode(changeAddress.address);
          },
          allow_mixing_native_and_token_when_bch_change_is_dust: true,
        },
      ];

      Log.debug("payoutRules", payoutRules);
      tradeTransaction = exchangeLab.createTradeTx(
        tradeResult.entries,
        clabInputs,
        payoutRules,
        null,
        TXFEE_PER_BYTE
      );
      Log.debug("tradeTransaction", tradeTransaction);
    } catch (e) {
      Log.debug(e);
      if (!e.required_amount) {
        throw e;
      }

      return buildStablecoinTransaction(
        recipients,
        tradeSats + e.required_amount,
        0n
      );
    }

    if (tradeTransaction === null) {
      return false;
    }

    const tx_raw = tradeTransaction.txbin;
    const tx_hex = binToHex(tx_raw);
    const tx_hash = swapEndianness(binToHex(sha256.hash(sha256.hash(tx_raw))));

    return {
      tx_hex,
      tx_hash,
      tradeResult,
      payouts_info: tradeTransaction.payouts_info,
    };
  }

  function buildSendTokensTransactionWithFeePayingTokenCategory({
    recipients,
    selection,
    exchangeLab,
    inputPools,
    feePayingTokenCategory,
  }: {
    recipients: Array<{
      address: string;
      token?: {
        category: string;
        amount: bigint;
      };
    }>;
    selection?: Array<TransactionOutput>;
    exchangeLab: ExchangeLab;
    inputPools: PoolV0[];
    feePayingTokenCategory: string;
  }): {
    tradeResult: TradeResult;
    tradeTransaction: TradeTxResult;
  } {
    const UtxoManager = UtxoManagerService(wallet.walletHash);
    const tokenOutputAmountsByCategory = recipients.reduce(
      (amounts, output) => {
        // calculate total output amounts for each token category
        if (output.token == null) {
          throw new ValueError(`recipient.token is null`);
        }
        const { category, amount } = output.token;
        const categoryAmount = amounts.get(category) || 0n;
        amounts.set(category, categoryAmount + amount);
        return amounts;
      },
      new Map<string, bigint>()
    );
    const tokenCategories = Array.from(tokenOutputAmountsByCategory.keys());
    if (tokenCategories.length === 0) {
      throw new ValueError(`Should at least send one token to a recipient.`);
    }
    const inputs =
      selection?.length > 0
        ? selection
        : tokenCategories
            .map((category) => {
              if (!tokenOutputAmountsByCategory.has(category)) {
                return [];
              }
              return UtxoManager.selectTokens(
                category,
                tokenOutputAmountsByCategory.get(category)
              ).filter((utxo) => utxo.nft_commitment == null);
            })
            .flat();
    if (inputs.length === 0) {
      throw new InsufficientFunds(`No inputs found.`);
    }
    const KeyManager = KeyManagerService(wallet);
    const inputCoins: SpendableCoin[] = inputs.map((input) => {
      return {
        type: SpendableCoinType.P2PKH,
        key: KeyManager.getAddressPrivateKey(input.address),
        output: {
          locking_bytecode: addressToLockingBytecode(input.address),
          token: {
            amount: input.token_amount,
            token_id: input.token_category,
          },
          amount: input.valueSatoshis,
        },
        outpoint: {
          txhash: hexToBin(input.tx_hash),
          index: input.tx_pos,
        },
      };
    });
    const AddressManager = AddressManagerService(wallet.walletHash);
    const changeAddresses = AddressManager.getUnusedAddresses(
      tokenCategories.length + 1,
      1
    );
    let lastChangeAddressIndex = 0;
    const payoutRules: PayoutRule[] = [
      ...recipients.map((r) => ({
        type: PayoutAmountRuleType.FIXED,
        locking_bytecode: addressToLockingBytecode(r.address),
        token: {
          token_id: r.token.category,
          amount: r.token.amount,
        },
        amount: -1n,
      })),
      {
        type: PayoutAmountRuleType.CHANGE,
        /* eslint-disable @typescript-eslint/no-unused-vars */
        generateChangeLockingBytecodeForOutput(output: Output) {
          const changeAddress = changeAddresses[lastChangeAddressIndex];
          if (lastChangeAddressIndex + 1 < changeAddresses.length) {
            lastChangeAddressIndex += 1;
          }
          return addressToLockingBytecode(changeAddress.address);
        },
        allow_mixing_native_and_token_when_bch_change_is_dust: true,
      },
    ];
    let requiredBch = 2000n; // initial amount
    const tradeResult = exchangeLab.constructTradeBestRateForTargetDemand(
      feePayingTokenCategory,
      "BCH",
      requiredBch,
      inputPools,
      TXFEE_PER_BYTE
    );
    let maxTry = 5;
    while (maxTry > 0) {
      try {
        const tradeTransaction = exchangeLab.createTradeTx(
          tradeResult.entries,
          inputCoins,
          payoutRules,
          null,
          TXFEE_PER_BYTE
        );
        return { tradeResult, tradeTransaction };
      } catch (err) {
        if (err instanceof InsufficientFunds) {
          requiredBch += err.required_amount;
        } else {
          throw err;
        }
      }
      maxTry -= 1;
    }
    throw new ValueError(`max try attempts to construct a trade reached.`);
  }
}

// TODO: Once Token support is added to CashStamps, add it to this function too.
//       It will require more complex logic: An output will need to be added per each token.
export function buildSweepTransaction(
  utxos: Array<UtxoEntity>,
  privateKey: Uint8Array,
  receivingAddress: string
): TransactionStub {
  // Convert the receiving address to locking bytecode.
  const receivingBytecode = addressToLockingBytecode(receivingAddress);

  // If we could not convert it successfully, throw an error.
  if (typeof receivingBytecode === "string") {
    throw new Error(receivingBytecode);
  }

  // Create our P2PKH Compiler.
  const compilerP2pkh = walletTemplateToCompilerBCH(walletTemplateP2pkhNonHd);

  // Compile our inputs.
  const inputDirectives = utxos.map((unspent) => ({
    outpointIndex: unspent.tx_pos,
    outpointTransactionHash: hexToBin(unspent.tx_hash),
    sequenceNumber: 0,
    unlockingBytecode: {
      compiler: compilerP2pkh,
      data: {
        keys: { privateKeys: { key: privateKey } },
      },
      script: "unlock",
      valueSatoshis: unspent.valueSatoshis,
    },
  }));

  // Calculate the total sats available in our inputs.
  const totalSats = inputDirectives.reduce((total, input) => {
    if (input.unlockingBytecode instanceof Uint8Array) {
      return total + 0n;
    }

    return total + input.unlockingBytecode.valueSatoshis;
  }, 0n);

  // We need to calculate the number of bytes so that we can calculate the fee.
  // So we loop twice and store the final transaction here each time.
  // 1st time will have zero fee. 2nd time will accommodate the fee.
  let encodedTransaction = new Uint8Array();

  // Create the transaction by looping twice.
  // 1st loop: Transaction without a fee.
  // 2nd loop: Accommodate the fee.
  for (let i = 0; i < 2; i += 1) {
    // Get the fee using 1000 sats/KB.
    const feeSats = getMinimumFee(
      BigInt(encodedTransaction.length),
      DUST_RELAY_FEE
    );

    // Attempt to generate the transaction.
    const generatedTransaction = generateTransaction({
      version: 2,
      locktime: 0,
      inputs: inputDirectives,
      outputs: [
        {
          lockingBytecode: receivingBytecode,
          valueSatoshis: totalSats - feeSats,
        },
      ],
    });

    if (!generatedTransaction.success) {
      throw new Error("Failed to generate transaction");
    }

    // Encode the transaction for broadcasting (and fee estimation).
    encodedTransaction = encodeTransaction(generatedTransaction.transaction);
  }

  // Calculate the tx_hash and convert the transaction to hex format.
  const tx_hash = swapEndianness(
    binToHex(sha256.hash(sha256.hash(encodedTransaction)))
  );
  const hex = binToHex(encodedTransaction);

  // Return the transaction.
  return {
    tx_hash,
    hex,
  };
}
