export type ValidBchNetwork = "mainnet" | "chipnet" | "testnet3" | "testnet4";

export function getPrefix(network: ValidBchNetwork): string {
  return network === "mainnet" ? "bitcoincash" : "bchtest";
}

export const DEFAULT_ELECTRUM_PORT = 50004;

export const cauldron_servers: Array<string> = ["rostrum.cauldron.quest:50004"];

const mainnet_servers: Array<string> = [
  "cashnode.bch.ninja:50004", // Kallisti / Selene Official
  //"fulcrum.jettscythe.xyz:50004", // Jett
  "bch.imaginary.cash:50004", // im_uname
  "bitcoincash.network:50004", // Dagur
  //"electroncash.dk:50004", // Georg
  "blackie.c3-soft.com:50004", // Calin
  "bch.loping.net:50004",
  "bch.soul-dev.com:50004",
  "bitcoincash.stackwallet.com:50004", // Rehrar / Stack Wallet official
  "node.minisatoshi.cash:50004", // minisatoshi
  "fulcrum.criptolayer.net:50004", // molecular
];

const chipnet_servers: Array<string> = [
  "chipnet.bch.ninja:50004", // Kallisti
  "chipnet.imaginary.cash:50004", // im_uname
  "chipnet.c3-soft.com:64004", // Calin
  //"electroncash.de:55004", // Georg
  //"cbch.loping.net:62104",
];

const testnet3_servers: Array<string> = [
  "blackie.c3-soft.com:60004", // Calin
];

const testnet4_servers: Array<string> = [
  "blackie.c3-soft.com:62004", // Calin
  //"testnet4.imaginary.cash:52004", // im_uname
  "tbch4.loping.net:62004",
];

export const electrum_servers = {
  mainnet: mainnet_servers,
  chipnet: chipnet_servers,
  testnet3: testnet3_servers,
  testnet4: testnet4_servers,
  cauldron: cauldron_servers,
};

export class ElectrumServer {
  private _host: string;

  private _port: number;

  constructor(host: string, port: number = DEFAULT_ELECTRUM_PORT) {
    if (host.includes(":")) {
      const parts = ElectrumServer.toParts(host);
      this._host = parts.host;
      this._port = parts.port;
    } else {
      this._host = host;
      this._port = port;
    }
  }

  toString(): string {
    return `${this._host}:${this._port}`;
  }

  toParts(): { host: string; port: number } {
    return { host: this._host, port: this._port };
  }

  static toParts(hostIdentifier: string = "") {
    const parts = hostIdentifier.split(":");
    return {
      host: parts[0] || "",
      port: Number.parseInt(parts[1]) || DEFAULT_ELECTRUM_PORT,
    };
  }
}

export const getTxExplorerUrl = (txid: string, network: ValidBchNetwork) => {
  switch (network) {
    case "mainnet":
      return `https://bchexplorer.cash/tx/${txid}`;
    case "testnet3":
      return `https://tbch.loping.net/tx/${txid}`;
    case "testnet4":
      return `https://tbch4.loping.net/tx/${txid}`;
    case "chipnet":
      return `https://chipnet.bch.ninja/tx/${txid}`;
    default:
      return `https://bchexplorer.cash/tx/${txid}`;
  }
};
