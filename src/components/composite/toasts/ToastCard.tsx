import { ReactNode } from "react";

type ToastVariant = "default" | "success" | "error";

const borderClasses: Record<ToastVariant, string> = {
  default: "border-primary dark:border-primarydark-400",
  success: "border-primary dark:border-primarydark-400",
  error: "border-error dark:border-error-light",
};

interface ToastCardProps {
  icon: ReactNode;
  header: ReactNode;
  body?: ReactNode;
  variant?: ToastVariant;
  onDismiss: () => void;
}

export default function ToastCard({
  icon,
  header,
  body = undefined,
  variant = "default",
  onDismiss,
}: ToastCardProps) {
  return (
    <div
      className={`opacity-95 w-full bg-white dark:bg-neutral-800 shadow-lg rounded-lg flex border-2 ${borderClasses[variant]} p-2 cursor-pointer`}
      onClick={onDismiss}
    >
      <div className="my-auto p-2">
        <div className="flex items-center justify-center">{icon}</div>
      </div>
      <div className="p-1 break-words">
        <div className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
          {header}
        </div>
        {body && (
          <div className="text-base text-neutral-800 dark:text-neutral-100 flex">
            {body}
          </div>
        )}
      </div>
    </div>
  );
}
