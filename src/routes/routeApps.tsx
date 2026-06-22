export const routeApps = [
  {
    path: "/apps",
    async lazy() {
      const { default: AppsView } = await import("@/views/apps/AppsView");
      return { Component: AppsView };
    },
  },
  {
    path: "/apps/intro",
    async lazy() {
      const { default: AppIntroVideoView } =
        await import("@/views/apps/intro/AppIntroVideoView");
      return { Component: AppIntroVideoView };
    },
  },
  {
    path: "/apps/stats",
    async lazy() {
      const { default: AppStatsView } =
        await import("@/views/apps/stats/AppStatsView");
      return { Component: AppStatsView };
    },
  },
  {
    path: "/apps/price",
    async lazy() {
      const { default: AppPriceView } =
        await import("@/views/apps/price/AppPriceView");
      return { Component: AppPriceView };
    },
  },
  {
    path: "/apps/afog",
    async lazy() {
      const { default: AppAfogView } =
        await import("@/views/apps/afog/AppAfogView");
      return { Component: AppAfogView };
    },
  },
  {
    path: "/apps/blaze",
    async lazy() {
      const { default: AppBlazeView } =
        await import("@/views/apps/blaze/AppBlazeView");
      return { Component: AppBlazeView };
    },
  },
  {
    path: "/apps/bliss",
    async lazy() {
      const { default: AppBlissView } =
        await import("@/views/apps/bliss/AppBlissView");
      return { Component: AppBlissView };
    },
    children: [
      {
        path: "about/",
        async lazy() {
          const { default: BlissAboutView } =
            await import("@/views/apps/bliss/about/BlissAboutView");
          return { Component: BlissAboutView };
        },
      },
    ],
  },
  {
    path: "/apps/cauldron",
    async lazy() {
      const { default: AppCauldronDexView } =
        await import("@/views/apps/cauldron/AppCauldronDexView");
      return { Component: AppCauldronDexView };
    },
  },
  {
    path: "/apps/qrgen",
    async lazy() {
      const { default: AppQrgenView } =
        await import("@/views/apps/qrgen/AppQrgenView");
      return { Component: AppQrgenView };
    },
  },
  {
    path: "/apps/walletconnect",
    async lazy() {
      const { default: AppWalletConnectView } =
        await import("@/views/apps/walletconnect/AppWalletConnectView");
      return { Component: AppWalletConnectView };
    },
  },
];
