export const routeAssets = [
  {
    path: "/assets",
    async lazy() {
      const { default: AssetsView } = await import("@/views/assets/AssetsView");
      return { Component: AssetsView };
    },
    children: [
      {
        path: "coins/",
        async lazy() {
          const { default: AssetsViewCoins } =
            await import("@/views/assets/AssetsViewCoins");
          return { Component: AssetsViewCoins };
        },
      },
      {
        path: "tokens/",
        async lazy() {
          const { default: AssetsViewTokens } =
            await import("@/views/assets/AssetsViewTokens");
          return { Component: AssetsViewTokens };
        },
      },
      {
        path: "tokens/:tokenId",
        async lazy() {
          const { default: AssetsViewTokenDetail } =
            await import("@/views/assets/AssetsViewTokenDetail");
          return { Component: AssetsViewTokenDetail };
        },
      },
    ],
  },
];
