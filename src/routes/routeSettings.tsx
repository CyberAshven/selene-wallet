export const routeSettings = [
  {
    path: "/settings",
    async lazy() {
      const { default: SettingsView } =
        await import("@/views/settings/SettingsView");
      return { Component: SettingsView };
    },
  },
  {
    path: "/settings/wallet/:walletHash",
    async lazy() {
      const { default: SettingsWalletView } =
        await import("@/views/settings/SettingsWalletView/SettingsWalletView");
      return { Component: SettingsWalletView };
    },
  },
  {
    path: "/settings/wallet/:walletHash/additionalInformation",
    async lazy() {
      const { default: SettingsWalletAdditionalInformation } =
        await import("@/views/settings/SettingsWalletAdditionalInformation/SettingsWalletAdditionalInformation");
      return { Component: SettingsWalletAdditionalInformation };
    },
  },
  {
    path: "/settings/wallet/wizard",
    async lazy() {
      const { default: SettingsWalletWizard } =
        await import("@/views/settings/SettingsWalletWizard/SettingsWalletWizard");
      return { Component: SettingsWalletWizard };
    },
    children: [
      {
        index: true,
        async lazy() {
          const { default: SettingsWalletWizardInit } =
            await import("@/views/settings/SettingsWalletWizardInit/SettingsWalletWizardInit");
          return { Component: SettingsWalletWizardInit };
        },
      },
      {
        path: "import",
        async lazy() {
          const { default: SettingsWalletWizardImport } =
            await import("@/views/settings/SettingsWalletWizardImport/SettingsWalletWizardImport");
          return { Component: SettingsWalletWizardImport };
        },
      },
      {
        path: "import/build/:walletHash",
        async lazy() {
          const { default: SettingsWalletWizardBuild } =
            await import("@/views/settings/SettingsWalletWizardBuild/SettingsWalletWizardBuild");
          return { Component: SettingsWalletWizardBuild };
        },
      },
    ],
  },
  {
    path: "/settings/wallet/:walletHash/scan",
    async lazy() {
      const { default: SettingsWalletScanTool } =
        await import("@/views/settings/SettingsWalletScanTool/SettingsWalletScanTool");
      return { Component: SettingsWalletScanTool };
    },
  },
];
