import { getCurrentWindow } from "@tauri-apps/api/window";

type EventName = "pause" | "resume" | "backButton" | "appStateChange";
type Handler = (...args: unknown[]) => void;
type ListenerHandle = { remove: () => Promise<void> };

const registry = new Map<EventName, Set<Handler>>();
let pauseTimer: ReturnType<typeof setTimeout> | null = null;

// Only fire "pause" after 5 s of lost focus — ignore brief app switches and minimizes.
// "resume" fires immediately on focus return and cancels any pending pause.
getCurrentWindow().onFocusChanged(({ payload: focused }) => {
  if (focused) {
    if (pauseTimer !== null) {
      clearTimeout(pauseTimer);
      pauseTimer = null;
    }
    dispatch("resume");
  } else {
    pauseTimer = setTimeout(() => {
      pauseTimer = null;
      dispatch("pause");
    }, 5000);
  }
});

function dispatch(event: EventName, data?: unknown): void {
  const handlers = registry.get(event);
  if (handlers) handlers.forEach((h) => h(data));
}

export const App = {
  addListener(
    event: EventName,
    handler: Handler
  ): Promise<ListenerHandle> {
    if (!registry.has(event)) registry.set(event, new Set());
    registry.get(event)!.add(handler);
    return Promise.resolve({
      remove: async () => {
        registry.get(event)?.delete(handler);
      },
    });
  },

  removeAllListeners(): Promise<void> {
    registry.clear();
    return Promise.resolve();
  },

  getState(): Promise<{ isActive: boolean }> {
    return getCurrentWindow()
      .isFocused()
      .then((isActive) => ({ isActive }));
  },
};
