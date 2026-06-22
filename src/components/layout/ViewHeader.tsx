import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router";
import { ArrowLeftOutlined, CloseOutlined } from "@ant-design/icons";

import { selectIsExperimental } from "@/redux/preferences";

interface Props {
  title: React.ReactNode;
  icon?: React.ComponentType;
  small?: boolean;
  back?: string | number;
  close?: string;
  accessory?: React.ComponentType;
  className?: string;
}

export default function ViewHeader({
  title,
  icon = () => null,
  small = false,
  back = undefined,
  close = undefined,
  accessory = () => null,
  className = undefined,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const shouldShowBackButton =
    (location.pathname.split("/").length > 2 || back) && !close;

  const isExperimental = useSelector(selectIsExperimental);

  const Icon = icon;
  const Accessory = isExperimental ? accessory : () => null;

  const sizeClasses = small
    ? "bg-neutral-800 dark:bg-neutral-1000 text-lg py-1 font-semibold text-neutral-50"
    : "bg-neutral-900 dark:bg-black text-xl text-neutral-25 font-bold py-3";

  const iconClasses = small ? "text-lg" : "text-2xl";

  return (
    <div
      className={`sticky top-0 z-50 w-full grid grid-cols-6 ${sizeClasses} ${className}`}
    >
      <div className="col-span-1 flex items-center justify-center">
        {shouldShowBackButton && (
          <button
            type="button"
            className="flex items-center justify-center cursor-pointer"
            onClick={() => (back ? navigate(back) : navigate(-1))}
          >
            <ArrowLeftOutlined className="text-xl" />
          </button>
        )}
        {close && (
          <button
            type="button"
            className="flex items-center justify-center cursor-pointer"
            onClick={() => navigate(close)}
          >
            <CloseOutlined className="text-xl" />
          </button>
        )}
      </div>
      <div className="text-center col-span-4 flex items-center justify-center">
        <Icon className={`mr-2 ${iconClasses}`} />
        {title}
      </div>
      <div className="col-span-1 flex items-center justify-center">
        <Accessory />
      </div>
    </div>
  );
}
