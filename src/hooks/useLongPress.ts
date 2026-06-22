import { useCallback, useEffect, useMemo, useRef } from "react";

const MOVE_THRESHOLD = 10;

export const useLongPress = <T>(
  onLongPress: (e?: T) => void = () => {},
  onClick: (e?: T) => void = () => {},
  ms = 500
) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef<boolean>(false);
  const isDragging = useRef<boolean>(false);
  const startPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const start = useCallback(
    (event) => {
      isLongPress.current = false;
      isDragging.current = false;
      if (event) {
        startPos.current = { x: event.clientX, y: event.clientY };
        event.stopPropagation();
        timerRef.current = setTimeout(() => {
          isLongPress.current = true;
          onLongPress(event);
        }, ms);
      }
    },
    [onLongPress, ms]
  );

  const cancelOnMove = useCallback((event: PointerEvent) => {
    const dx = event.clientX - startPos.current.x;
    const dy = event.clientY - startPos.current.y;
    if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
      isDragging.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const clear = useCallback(
    (event?: T) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // do nothing on cleanup
      if (!event) {
        return;
      }

      // Suppress click if it was a long press or a drag/scroll
      if (isLongPress.current || isDragging.current) {
        (event as PointerEvent).preventDefault?.();
        return;
      }

      onClick(event);
    },
    [onClick]
  );

  const preventContextMenu = useCallback((event: Event) => {
    event.preventDefault();
  }, []);

  useEffect(() => {
    return () => clear();
  }, [clear]);

  const events = useMemo(
    () => ({
      onPointerDown: start,
      onPointerUp: clear,
      onPointerMove: cancelOnMove,
      onPointerCancel: clear,
      onContextMenu: preventContextMenu,
    }),
    [start, clear, cancelOnMove, preventContextMenu]
  );

  return events;
};
