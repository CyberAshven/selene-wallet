import { useCallback, useMemo, useRef } from "react";

interface UseSwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
}: UseSwipeOptions) {
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startX.current = e.clientX;
    startY.current = e.clientY;
    isSwiping.current = true;
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      const deltaX = e.clientX - startX.current;
      const deltaY = e.clientY - startY.current;

      // Only fire if horizontal movement exceeds vertical
      if (Math.abs(deltaX) < threshold) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) return;

      if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight, threshold]
  );

  const handlePointerCancel = useCallback(() => {
    isSwiping.current = false;
  }, []);

  const swipeHandlers = useMemo(
    () => ({
      onPointerDown: handlePointerDown,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      style: { touchAction: "pan-y" as const },
    }),
    [handlePointerDown, handlePointerUp, handlePointerCancel]
  );

  return swipeHandlers;
}
