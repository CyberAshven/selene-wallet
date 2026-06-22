import { CloseOutlined } from "@ant-design/icons";

import Card from "@/atoms/Card";
import Overlay from "@/atoms/Overlay";

interface ModalProps {
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  blur?: boolean;
}

export default function Modal({
  children,
  onClose = undefined,
  className = "",
  blur = true,
}: ModalProps) {
  return (
    <Overlay
      className="items-center justify-center"
      onClose={onClose}
      blur={blur}
    >
      <Card className={`pointer-events-auto p-2 min-w-[40%] ${className}`}>
        {children}
      </Card>
      {onClose && (
        <button
          type="button"
          className="pointer-events-auto absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-neutral-900/50 text-white cursor-pointer"
          onClick={onClose}
        >
          <CloseOutlined />
        </button>
      )}
    </Overlay>
  );
}
