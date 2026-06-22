export const routeDebug = [
  {
    path: "/debug",
    async lazy() {
      const { default: DebugView } = await import("@/views/debug/DebugView");
      return { Component: DebugView };
    },
    children: [
      {
        index: true,
        async lazy() {
          const { default: DebugViewHome } =
            await import("@/views/debug/DebugViewHome");
          return { Component: DebugViewHome };
        },
      },
      /*{
        path: "/debug/data",
        async lazy() {
          const { default: DebugDataView } = await import(
            "@/views/debug/DebugDataView"
          );
          return { Component: DebugDataView };
        },
        },*/
    ],
  },
];
