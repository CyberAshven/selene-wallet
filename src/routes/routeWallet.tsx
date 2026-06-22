import WalletViewHome from "@/views/wallet/home/WalletViewHome";
import WalletViewPay from "@/views/wallet/send/WalletViewPay";
import WalletViewSend from "@/views/wallet/send/WalletViewSend";
import WalletViewSendSuccess from "@/views/wallet/send/WalletViewSendSuccess";
import WalletViewSweep from "@/views/wallet/send/WalletViewSweep";
import WalletView from "@/views/wallet/WalletView";

export const routeWallet = [
  {
    path: "/wallet",
    element: <WalletView />,
    children: [
      {
        index: true,
        element: <WalletViewHome />,
      },
      {
        path: "send/",
        element: <WalletViewSend />,
      },
      {
        path: "send/:address",
        element: <WalletViewSend />,
      },
      {
        path: "pay/",
        element: <WalletViewPay />,
      },
      {
        path: "send/success",
        element: <WalletViewSendSuccess />,
      },
      {
        path: "sweep/:wif",
        element: <WalletViewSweep />,
      },
      {
        path: "history",
        async lazy() {
          const { default: WalletViewHistory } =
            await import("@/views/wallet/history/WalletViewHistory");
          return { Component: WalletViewHistory };
        },
      },
    ],
  },
];
