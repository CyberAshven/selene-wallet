import { useEffect, useRef, useState } from "react";
import Logger from "js-logger";

import ConsoleService from "@/kernel/app/ConsoleService";

export default function DebugConsole() {
  const [consoleLines, setConsoleLines] = useState([
    ...ConsoleService().getLines(),
  ]);

  const consoleRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef(true);

  useEffect(
    function reloadConsoleLines() {
      const interval = setInterval(() => {
        setConsoleLines((prevLines) => {
          const newLines = [...ConsoleService().getLines()];
          if (consoleRef.current && prevLines.length !== newLines.length) {
            const isAtBottom =
              consoleRef.current.scrollTop + consoleRef.current.clientHeight >=
              consoleRef.current.scrollHeight - 1; // small epsilon for precision

            scrollRef.current = isAtBottom || scrollRef.current;
            return newLines;
          }

          return prevLines;
        });
      }, 250);

      return () => clearInterval(interval);
    },
    [consoleLines]
  );

  useEffect(
    function scrollToBottom() {
      if (consoleRef.current && scrollRef.current) {
        // scroll to the bottom by setting scrollTop
        consoleRef.current.scrollTop =
          consoleRef.current.scrollHeight - consoleRef.current.clientHeight;
      }
    },
    [consoleLines]
  );

  const getLineClasses = (level) => {
    switch (level) {
      case Logger.ERROR:
        return "text-error";
      case Logger.WARN:
        return "text-warn";
      case Logger.INFO:
        return "font-semibold";
      case Logger.TIME:
        return "italic";
      default:
        return "";
    }
  };

  return (
    <div
      className="font-mono h-[50vh] overflow-y-auto border border-black rounded text-wrap break-words"
      ref={consoleRef}
      onScroll={() => {
        scrollRef.current = false;
      }}
    >
      <ul className="h-full text-sm">
        {consoleLines.slice(-500).map((line, index) => (
          <li
            /* eslint-disable-next-line react/no-array-index-key */
            key={`${index}:${line.message}`}
            className={getLineClasses(line.level)}
          >
            {line.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
