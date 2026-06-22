import {
  assertSuccess,
  CashAddressType,
  decodeBase58Address,
  decodeCashAddress,
  decodePrivateKeyWif,
  encodeCashAddress,
  secp256k1,
} from "@bitauth/libauth";

import NotificationService from "@/kernel/app/NotificationService";
import WalletManagerService from "@/kernel/wallet/WalletManagerService";

import { extractBchAddresses } from "@/util/cashaddr";
import { ripemd160, sha256 } from "@/util/hash";
import { bchToSats } from "@/util/sats";

// validateBchUri: validates all possible BCH URI formats
export function validateBchUri(uri: string) {
  const {
    isBip21,
    isCashAddress,
    isTokenAddress,
    isBase58Address,
    address,
    satoshis,
    tokenCategory,
    tokenAmount,
    nftCommitment,
    message,
    expiration,
    isExpired,
  } = validateBip21Uri(uri);

  const { isPaymentProtocol, requestUri } = validatePaymentProtocolUri(uri);

  const wifPayload = validateWifUri(uri);

  const wcPayload = validateWalletConnectUri(uri);

  const isValid =
    isBip21 ||
    isPaymentProtocol ||
    wifPayload.isWif ||
    wcPayload.isWalletConnect;

  // Build query string using PayPro params (s, f, c, n, m, e)
  const query = `?${[
    satoshis !== undefined ? ["s", satoshis.toString()] : false,
    tokenCategory ? ["c", tokenCategory] : false,
    tokenAmount > 0 ? ["f", tokenAmount.toString()] : false,
    nftCommitment !== undefined ? ["n", nftCommitment] : false,
    message ? ["m", encodeURIComponent(message)] : false,
    expiration !== undefined ? ["e", expiration] : false,
  ]
    .filter((q) => q !== false)
    .map((q) => `${q[0]}=${q[1]}`)
    .join("&")}`;

  const payload = {
    address,
    satoshis,
    query,
    requestUri,
    isValid,
    isBip21,
    isCashAddress,
    isTokenAddress,
    isBase58Address,
    isPaymentProtocol,
    tokenCategory,
    tokenAmount,
    nftCommitment,
    message,
    expiration,
    isExpired,
    ...wifPayload,
    ...wcPayload,
  };

  return payload;
}

// safety check for BigInt conversion
export const isIntStr = (s: string) => /^-?\d+$/.test(s);

// validateBip21Uri: cashaddr, base58 addresses, and bip21 invoices (?amount=)
export function validateBip21Uri(uri: string) {
  const uriSplit = uri.split("?");
  const address = uriSplit[0];

  const queryString = uriSplit[1] || "";
  const searchParams = new URLSearchParams(queryString);

  // Parse legacy BIP21 amount (BCH) and convert to satoshis
  const amountParam = searchParams.get("amount");
  const amountSatoshis =
    amountParam !== null ? bchToSats(amountParam) : undefined;

  // PayPro CHIP-2023-05: satoshi amount (s parameter, preferred over amount)
  const sParam = searchParams.get("s");
  const satoshis =
    sParam !== null && isIntStr(sParam) ? BigInt(sParam) : amountSatoshis;

  // Token category
  const tokenCategory = searchParams.get("c") || undefined;

  // PayPro CHIP-2023-05: fungible token amount (f preferred, ft for backward compat)
  const fParam = searchParams.get("f");
  const ftParam = searchParams.get("ft");
  const rawTokenAmt = fParam || ftParam;
  const tokenAmount =
    rawTokenAmt && isIntStr(rawTokenAmt) ? BigInt(rawTokenAmt) : 0n;

  // PayPro CHIP-2023-05: NFT commitment (n parameter)
  // undefined = not specified, "" = any NFT of category, "hex..." = specific NFT
  const nParam = searchParams.get("n");
  const nftCommitment = nParam !== null ? nParam : undefined;

  // PayPro CHIP-2023-05: message/memo (m preferred, message for backward compat)
  const mParam = searchParams.get("m");
  const messageParam = searchParams.get("message");
  const message = mParam || messageParam || undefined;

  // PayPro CHIP-2023-05: expiration timestamp (e parameter)
  const eParam = searchParams.get("e");
  const expiration = eParam !== null ? Number.parseInt(eParam) : undefined;
  const isExpired =
    expiration !== undefined && expiration < Math.floor(Date.now() / 1000);

  // various providers do stupid things with cashaddr that we must handle.
  // in the wild we've seen:
  // -  addresses with multiple prefixes (bitcoincash:bitcoincash:qz38adf...)
  // -  prefix followed by base58 (bitcoincash:1D3ADB...)
  const addressSplit = address.split(":");

  // always get last item of split, as it's most likely the raw address.
  const noPrefixAddress =
    addressSplit.length > 1 ? addressSplit[addressSplit.length - 1] : address;

  // check if raw address is base58.
  const isBase58Address =
    typeof decodeBase58Address(noPrefixAddress) === "object";

  // only prefix the address if it's cashaddr, not base58.
  // prefix is dependent on currently-connected network (mainnet/chipnet)
  const prefix = WalletManagerService().getPrefix();
  const prefixedAddress = isBase58Address
    ? noPrefixAddress
    : `${prefix}:${noPrefixAddress}`;

  const decodedCashAddress = decodeCashAddress(prefixedAddress);
  const isCashAddress = typeof decodedCashAddress === "object";
  const isTokenAddress =
    isCashAddress &&
    (decodedCashAddress.type === CashAddressType.p2pkhWithTokens ||
      decodedCashAddress.type === CashAddressType.p2shWithTokens);

  const isBip21 = isCashAddress || isBase58Address;

  return {
    isBip21,
    isCashAddress,
    isTokenAddress,
    isBase58Address,
    address: isBip21 ? prefixedAddress : "",
    satoshis,
    tokenCategory,
    tokenAmount,
    nftCommitment,
    message,
    expiration,
    isExpired,
  };
}

// validatePaymentProtocolUri: BIP70/JSON Payment Protocol (bitcoincash:?r=https://)
function validatePaymentProtocolUri(uri: string) {
  if (!uri.startsWith("bitcoincash:?r=")) {
    return { isPaymentProtocol: false };
  }

  const requestUri = uri.split("bitcoincash:?r=")[1];
  const decodedUri = decodeURI(requestUri);

  const isPaymentProtocol = decodedUri !== null;

  return { isPaymentProtocol, requestUri: decodedUri };
}

// validateWifUri: Wallet Sweep (CashStamps) (bitcoincash: or bch-wif:)
export function validateWifUri(
  wif: string,
  removePrefixes = ["bitcoincash:", "bch-wif:"]
) {
  // Remove the prefixes from the WIF (if they exist).
  // NOTE: We do this in case the WIF was invoked from a URL handler.
  //       e.g. bitcoincash:someWif or bch-wif:someWif
  const wifWithoutPrefix = removePrefixes.reduce((result, prefix) => {
    return result.startsWith(prefix) ? result.slice(prefix.length) : result;
  }, wif);

  // Attempt to decode the WIF.
  const decodedPrivateKey = decodePrivateKeyWif(wifWithoutPrefix);

  // If a string is returned, this indicates an error...
  if (typeof decodedPrivateKey === "string") {
    return {
      isWif: false,
    };
  }

  // Ensure the Private Key is valid by checking the length (32 bytes = uncompressed private key, 33 bytes = compressed private key).
  // NOTE: This is to work around a LibAuth bug where decodePrivateKeyWif does not verify the version of the Base58 string.
  //       This means that we will get a false positive on Base58/Legacy addresses as being valid WIFs.
  //       Once the below PR is merged into LibAuth (and we've updated to the new version), we can remove the following code.
  //       https://github.com/bitauth/libauth/pull/147
  const isValidPrivateKey =
    decodedPrivateKey.privateKey.length === 32 ||
    decodedPrivateKey.privateKey.length === 33;

  // If it is not a valid private key, then it is not a WIF,
  if (!isValidPrivateKey) {
    return {
      isWif: false,
    };
  }

  // Attempt to derive the public key.
  const publicKey = secp256k1.derivePublicKeyCompressed(
    decodedPrivateKey.privateKey
  );

  // If a string is returned, this indicates an error...
  if (typeof publicKey === "string") {
    return {
      isWif: false,
    };
  }

  // SHA256 and then RIPDEMD160 the Public Key.
  const payload = ripemd160.hash(sha256.hash(publicKey));

  // Encode the Public Key as an address (so that we can look up the UTXOs).
  const { address } = assertSuccess(
    encodeCashAddress({
      prefix: "bitcoincash",
      type: CashAddressType.p2pkh,
      payload,
    })
  );

  return {
    isWif: true,
    wif: wifWithoutPrefix,
    address,
    privateKey: decodedPrivateKey.privateKey,
  };
}

// validateWalletConnectUri: Wallet Connect (wc:)
export function validateWalletConnectUri(uri: string) {
  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    return {
      isWalletConnect: false,
    };
  }

  const { protocol } = parsedUri;

  if (protocol !== "wc:") {
    return {
      isWalletConnect: false,
    };
  }

  return {
    isWalletConnect: true,
    wcUri: parsedUri.href,
  };
}

// extractBchUri: finds a BCH address in freeform text and returns the full URI (address + query params)
function extractBchUri(text: string): string | undefined {
  const address = extractBchAddresses(text)[0];
  if (!address) return undefined;
  const idx = text.toLowerCase().indexOf(address.toLowerCase());
  const fromAddress = text.slice(idx);
  const end = fromAddress.search(/\s/);
  return end === -1 ? fromAddress : fromAddress.slice(0, end);
}

// navigateOnValidUri: maps URI handlers to app routes
export const navigateOnValidUri = async (
  input: string
): Promise<{
  navTo: string;
  navState: object;
  isTokenAddress: boolean;
  isExpired: boolean;
  extractedUri: string;
}> => {
  const decodedInput = fromAlphanumericUri(input);
  const uri = extractBchUri(decodedInput) || decodedInput;

  const {
    isValid,
    isTokenAddress,
    isWalletConnect,
    isPaymentProtocol,
    isWif,
    isExpired,
    address,
    query,
    requestUri,
    wif,
    wcUri,
  } = validateBchUri(uri);

  let navTo = "";
  let navState;

  const Notification = NotificationService();

  if (isValid) {
    // Check expiration before proceeding
    if (isExpired) {
      Notification.expiredPayment();
      return {
        navTo: "",
        navState: {},
        isTokenAddress,
        isExpired: true,
        extractedUri: uri,
      };
    }

    if (isWalletConnect) {
      navTo = `/apps/walletconnect`;
      navState = { wcUri };
    } else if (isPaymentProtocol) {
      navTo = `/wallet/pay/?r=${requestUri}`;
    } else if (isWif) {
      navTo = `/wallet/sweep/${wif}`;
    } else {
      navTo = `/wallet/send/${address}${query}`;
    }
  } else {
    Notification.invalidScan(decodedInput);
  }

  return {
    navTo,
    navState,
    isTokenAddress,
    isExpired: isExpired || false,
    extractedUri: uri,
  };
};

/**
 * Encode URI to alphanumeric QR format (CHIP-2023-05)
 * QR codes in alphanumeric mode use uppercase and substitute:
 * ? -> : (for query string start)
 * = -> - (for key=value)
 * & -> + (for parameter separation)
 */
export function toAlphanumericUri(uri: string): string {
  return uri
    .toUpperCase()
    .replace(/\?/g, ":")
    .replace(/=/g, "-")
    .replace(/&/g, "+");
}

/**
 * Decode alphanumeric QR format (CHIP-2023-05)
 * Reverses the encoding from toAlphanumericUri.
 * Note: The first colon is the cashaddr prefix separator and must be preserved.
 */
export function fromAlphanumericUri(uri: string): string {
  // Only process if entirely uppercase (indicates alphanumeric QR mode)
  if (uri !== uri.toUpperCase()) {
    return uri;
  }

  // Find the first colon (cashaddr prefix separator)
  const firstColonIndex = uri.indexOf(":");
  if (firstColonIndex === -1) {
    return uri.toLowerCase();
  }

  // Keep prefix:address, decode the rest
  const prefix = uri.slice(0, firstColonIndex + 1);
  const rest = uri.slice(firstColonIndex + 1);

  // In the rest, the first colon (if any) is the query separator
  const decoded = rest
    .replace(/:/, "?") // Only first : becomes ?
    .replace(/-/g, "=")
    .replace(/\+/g, "&");

  return (prefix + decoded).toLowerCase();
}
