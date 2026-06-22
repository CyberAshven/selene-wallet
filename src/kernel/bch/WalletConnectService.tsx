import LogService from "@/kernel/app/LogService";

const Log = LogService("WalletConnect");

let walletKit;

export class WalletConnectNotInitializedError extends Error {}

export default function WalletConnectService() {
  return {
    init,
    pair,
    getPairings,
    getSession,
    getSessions,
    approveSession,
    rejectSession,
    deleteSession,
    sessionResponse,
  };

  async function init(handlers) {
    if (walletKit !== undefined) {
      Log.debug("WalletConnect already initialized");
      return walletKit;
    }

    Log.log("Initializing WalletConnect");

    const [{ Core }, { WalletKit }] = await Promise.all([
      import("@walletconnect/core"),
      import("@reown/walletkit"),
    ]);

    const core = new Core({
      projectId: "953f3fbfdc425848d3d9693a6c927cda",
    });

    const metadata = {
      name: "Selene Wallet",
      description: "Selene Wallet for Bitcoin Cash (BCH)",
      url: "https://app.selene.cash",
      icons: [
        "https://git.xulu.tech/selene.cash/selene-wallet/-/raw/main/src/assets/selene-logo.svg",
      ],
    };

    const wc = await WalletKit.init({
      core,
      metadata,
    });

    wc.on("session_proposal", handlers.handleSessionProposal);
    wc.on("session_request", handlers.handleSessionRequest);
    wc.on("session_delete", handlers.handleSessionDelete);

    walletKit = wc;

    return walletKit;
  }

  async function getSession(sessionId) {
    const sessions = await getSessions();

    const session = { ...sessions[sessionId] };
    Log.debug("getSession", sessionId, session);
    return session;
  }

  async function getSessions() {
    if (!walletKit) {
      return {};
    }

    const sessions = await walletKit.getActiveSessions();
    Log.debug("getSessions", sessions);
    return sessions;
  }

  async function approveSession(proposal, address) {
    const addressPrefix = address.split(":")[0];
    const namespaces = {
      bch: {
        methods: ["bch_getAddresses", "bch_signTransaction", "bch_signMessage"],
        chains: [`bch:${addressPrefix}`],
        events: ["addressesChanged"],
        accounts: [`bch:${address}`],
      },
    };

    try {
      const approvedSession = await walletKit.approveSession({
        id: proposal.id,
        namespaces,
      });
      Log.debug("approvedSession", approvedSession, address);
      return approvedSession;
    } catch (e) {
      Log.error("approveSession:", e);
      throw e;
    }
  }

  async function rejectSession(proposal) {
    const { getSdkError } = await import("@walletconnect/utils");
    return walletKit.rejectSession({
      id: proposal.id,
      reason: getSdkError("USER_REJECTED"),
    });
  }

  async function deleteSession(sessionId) {
    const sessions = await getSessions();
    const pairings = await getPairings();

    if (Object.keys(sessions).includes(sessionId)) {
      const { getSdkError } = await import("@walletconnect/utils");
      await walletKit.disconnectSession({
        topic: sessionId,
        reason: getSdkError("USER_DISCONNECTED"),
      });
      Log.debug("wc user_disconnected", sessionId);
    }

    if (pairings.find((p) => p.topic === sessionId)) {
      await walletKit.core.pairing.disconnect({ topic: sessionId });
      Log.debug("wc pairing disconnected", sessionId);
    }
  }

  async function pair({ uri }) {
    walletKit.pair({ uri });
    Log.debug("pairings", await walletKit.core.pairing.getPairings());
  }

  async function getPairings() {
    const pairings = await walletKit.core.pairing.getPairings();
    Log.debug("pairings", pairings);
    return pairings;
  }

  async function sessionResponse(sessionId, payload) {
    return walletKit.respondSessionRequest({
      topic: sessionId,
      response: payload,
    });
  }
}
