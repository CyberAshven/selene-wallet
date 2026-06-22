import { store } from "@/redux";
import { selectBchNetwork } from "@/redux/preferences";

import TransactionManagerService from "@/kernel/bch/TransactionManagerService";

export const routeExplore = [
  {
    path: "/explore",
    async lazy() {
      const { default: ExploreView } =
        await import("@/views/explore/ExploreView");
      return { Component: ExploreView };
    },
    children: [
      {
        index: true,
        async lazy() {
          const { default: ExploreViewHome } =
            await import("@/views/explore/ExploreViewHome");
          return { Component: ExploreViewHome };
        },
      },
      {
        path: "tx/:tx_hash",
        async lazy() {
          const { default: ExploreTransactionView } =
            await import("@/views/explore/ExploreTransactionView");
          return { Component: ExploreTransactionView };
        },
        loader: async ({ params }) => {
          const bchNetwork = selectBchNetwork(store.getState());
          return TransactionManagerService().resolveTransaction(
            params.tx_hash,
            bchNetwork
          );
        },
      },
      {
        path: "contacts",
        async lazy() {
          const { default: ExploreContactsView } =
            await import("@/views/explore/contacts/ExploreContactsView");
          return { Component: ExploreContactsView };
        },
      },
    ],
  },
];
