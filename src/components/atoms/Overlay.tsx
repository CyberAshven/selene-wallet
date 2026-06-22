import { createPortal } from "react-dom";

import FullColumn from "@/layout/FullColumn";

export default function Overlay({
  children,
  className = "",
  transparent = false,
  blur = true,
  onClose,
}) {
  // #root fallback: pre-auth screens (AppLockScreen, ForgotPinScreen) where #container isn't mounted
  const rootNode =
    document.querySelector("#container") ?? document.querySelector("#root")!;

  const bgClass = transparent ? "bg-transparent" : "bg-neutral-1000/60";
  const blurClass = blur ? "backdrop-blur-md" : "";

  return createPortal(
    <div className="absolute top-0 left-0 w-full h-full z-50">
      <div
        className={`absolute inset-0 ${bgClass} ${blurClass}`}
        onClick={onClose}
      />
      <FullColumn className={`relative pointer-events-none ${className}`}>
        {children}
      </FullColumn>
    </div>,
    rootNode
  );
}
