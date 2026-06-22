import { LoadingOutlined } from "@ant-design/icons";

import ToastCard from "./ToastCard";

interface LoadingToastProps {
  message: string;
  onDismiss: () => void;
}

export default function LoadingToast({
  message,
  onDismiss,
}: LoadingToastProps) {
  return (
    <ToastCard
      icon={<LoadingOutlined className="text-2xl text-primary animate-spin" />}
      header={message}
      onDismiss={onDismiss}
    />
  );
}
