/* eslint-disable @typescript-eslint/no-use-before-define */
import { encodeTransaction, generateTransaction } from "@bitauth/libauth";
import {
  createAsyncThunk,
  createReducer,
  createSelector,
} from "@reduxjs/toolkit";

import { selectBchNetwork } from "@/redux/preferences";
import { selectActiveWallet } from "@/redux/wallet";

import LogService from "@/kernel/app/LogService";
import ModalService from "@/kernel/app/ModalService";
import ElectrumService from "@/kernel/bch/ElectrumService";
import WalletConnectService from "@/kernel/bch/WalletConnectService";
import AddressManagerService from "@/kernel/wallet/AddressManagerService";
import KeyManagerService from "@/kernel/wallet/KeyManagerService";

import { sha256 } from "@/util/hash";
import { binToHex } from "@/util/hex";
import { destringify } from "@/util/json";

import common from "@/translations/common";
import { translate } from "@/util/translations";

const Log = LogService("redux/walletConnect");

export const walletConnectInit = createAsyncThunk(
  "walletConnect/init",
  async (payload, thunkApi) => {
    const WalletConnect = WalletConnectService();
    await WalletConnect.init({
      handleSessionProposal: (proposal) =>
        thunkApi.dispatch(wcSessionProposal(proposal)),
      handleSessionRequest: (request) =>
        thunkApi.dispatch(wcSessionRequest(request)),
      handleSessionDelete: (event) => thunkApi.dispatch(wcSessionDelete(event)),
    });

    const sessions = await WalletConnect.getSessions();
    return sessions;
  }
);

export const wcSessionProposal = createAsyncThunk(
  "walletConnect/sessionProposal",
  async (payload, thunkApi) => {
    const proposal = payload;
    Log.debug("session_proposal", proposal);

    const { requiredNamespaces, optionalNamespaces } = proposal.params;

    if (
      (!requiredNamespaces.bch ||
        !Array.isArray(requiredNamespaces.bch.chains)) &&
      (!optionalNamespaces.bch || !Array.isArray(optionalNamespaces.bch.chains))
    ) {
      Log.error("Unsupported blockchain", requiredNamespaces);
      throw new Error("Unsupported Blockchain");
    }

    const wallet = selectActiveWallet(thunkApi.getState());

    const proposalNetworkPrefix =
      requiredNamespaces?.bch?.chains?.[0]?.split(":")[1] ??
      optionalNamespaces.bch.chains[0].split(":")[1];

    const targetNetwork =
      proposalNetworkPrefix === "bitcoincash" ? "mainnet" : "chipnet";

    // if current network is not target network, reject session
    if (wallet.network !== targetNetwork) {
      thunkApi.dispatch(wcSessionReject(proposal));
      return;
    }

    thunkApi.dispatch(wcSessionApprove(proposal));
  }
);

export const wcSessionRequest = createAsyncThunk(
  "walletConnect/sessionRequest",
  async (payload, thunkApi) => {
    const event = payload;
    Log.debug("session_request", event);

    const { topic, params, id } = event;
    const { request } = params;
    const { method, params: methodParams } = request;

    const bchNetwork = selectBchNetwork(thunkApi.getState());

    const WalletConnect = WalletConnectService();

    const [{ formatJsonRpcResult, formatJsonRpcError }, { getSdkError }] =
      await Promise.all([
        import("@walletconnect/jsonrpc-utils"),
        import("@walletconnect/utils"),
      ]);

    const wallet = selectActiveWallet(thunkApi.getState());
    const AddressManager = AddressManagerService(wallet.walletHash);
    const sessionAddress = AddressManager.getAddressRange(0, 0)[0].address;

    const session = await WalletConnect.getSession(topic);
    Log.debug("session", session);

    const { peer } = session;

    switch (method) {
      case "bch_getAddresses":
      case "bch_getAccounts":
        await WalletConnect.sessionResponse(
          topic,
          formatJsonRpcResult(id, [sessionAddress])
        );
        break;

      case "bch_signTransaction":
        {
          const { transaction: unsignedTransaction, sourceOutputs } =
            destringify(JSON.stringify(methodParams));
          Log.debug("bch_signTransaction", unsignedTransaction, sourceOutputs);

          const isApproved = await ModalService().showConfirm({
            title: peer.metadata.name,
            message: `${methodParams.userPrompt}\n${event.verifyContext.verified.origin}`,
            confirmLabel: translate(common.approve),
          });

          if (!isApproved) {
            await WalletConnect.sessionResponse(topic, {
              response: formatJsonRpcError(id, getSdkError("USER_REJECTED")),
            });
            return;
          }

          const txTemplate = { ...unsignedTransaction };
          const KeyManager = KeyManagerService(wallet);
          const signedTemplate = KeyManager.signTemplate(
            txTemplate,
            sourceOutputs,
            sessionAddress
          );

          Log.debug("signedTemplate", signedTemplate);

          const generated = generateTransaction(signedTemplate);
          Log.debug("generated", generated);
          if (!generated.success) {
            Log.error(generated);
            throw new Error(JSON.stringify(generated));
          }

          const encodedTransaction = encodeTransaction(generated.transaction);
          Log.debug("encodedTransaction", encodedTransaction);

          const result = {
            signedTransaction: binToHex(encodedTransaction),
            signedTransactionHash: binToHex(
              sha256.hash(sha256.hash(encodedTransaction)).reverse()
            ),
          };

          if (methodParams.broadcast) {
            try {
              const Electrum = ElectrumService(bchNetwork);
              await Electrum.broadcastTransaction(result.signedTransaction);
            } catch (e) {
              Log.error(e);
              await WalletConnect.sessionResponse(topic, {
                error: formatJsonRpcError(id, `${e}`),
              });
              throw e;
            }
          }

          const response = formatJsonRpcResult(id, result);
          await WalletConnect.sessionResponse(topic, response);

          Log.debug("sessionResponse success", response);
        }
        break;

      case "bch_signMessage":
        {
          const { message } = destringify(JSON.stringify(methodParams));

          const isApproved = await ModalService().showConfirm({
            title: peer.metadata.name,
            message: `${translate(common.signMessage)}\n\n${message}\n\n${event.verifyContext.verified.origin}`,
            confirmLabel: translate(common.approve),
          });

          if (!isApproved) {
            await WalletConnect.sessionResponse(topic, {
              response: formatJsonRpcError(id, getSdkError("USER_REJECTED")),
            });
            return;
          }

          const KeyManager = KeyManagerService(wallet);
          const signedMessage = KeyManager.signMessage(message, sessionAddress);
          await WalletConnect.sessionResponse(
            topic,
            formatJsonRpcResult(id, signedMessage)
          );
        }
        break;

      default:
        await WalletConnect.sessionResponse(topic, {
          response: formatJsonRpcError(id, `Unsupported method ${method}`),
        });
        break;
    }
  }
);

export const wcSessionApprove = createAsyncThunk(
  "walletConnect/sessionApprove",
  async (payload, thunkApi) => {
    const WalletConnect = WalletConnectService();
    const wallet = selectActiveWallet(thunkApi.getState());

    const AddressManager = AddressManagerService(wallet.walletHash);
    const { address: sessionAddress } =
      AddressManager.getWalletConnectAddress();
    Log.debug("wcSessionApprove", payload, sessionAddress);
    await WalletConnect.approveSession(payload, sessionAddress);

    const sessions = await WalletConnect.getSessions();
    return sessions;
  }
);

export const wcSessionReject = createAsyncThunk(
  "walletConnect/sessionReject",
  async (payload) => {
    const WalletConnect = WalletConnectService();
    await WalletConnect.rejectSession(payload);

    const sessions = await WalletConnect.getSessions();
    return sessions;
  }
);

export const wcSessionDelete = createAsyncThunk(
  "walletConnect/sessionDelete",
  async (payload) => {
    Log.debug("wcSessionDelete", payload);
    const WalletConnect = WalletConnectService();
    await WalletConnect.deleteSession(payload);

    const sessions = await WalletConnect.getSessions();
    return sessions;
  }
);

const initialState = {
  sessions: {},
};

export const walletConnectReducer = createReducer(initialState, (builder) => {
  builder.addCase(walletConnectInit.fulfilled, (state, action) => {
    state.sessions = action.payload;
  });
  builder.addCase(wcSessionApprove.fulfilled, (state, action) => {
    state.sessions = action.payload;
  });
  builder.addCase(wcSessionReject.fulfilled, (state, action) => {
    state.sessions = action.payload;
  });
  builder.addCase(wcSessionDelete.fulfilled, (state, action) => {
    state.sessions = action.payload;
  });
});

export const selectWcSessions = createSelector(
  (state) => state.walletConnect,
  (walletConnect) => walletConnect.sessions
);
