import NullComponent from "@/atoms/NullComponent";

export type ValidSizes =
  | "none"
  | "xs"
  | "sm"
  | "base"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "4xl"
  | "5xl"
  | "6xl"
  | "7xl"
  | "8xl"
  | "9xl";

type ValidRounded =
  | true
  | "full"
  | "none"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl";

type ValidJustify = "start" | "center" | "end";

export interface ButtonProps {
  label?: React.ReactNode;
  labelSize?: ValidSizes;
  labelColor?: string;
  activeLabelColor?: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconSize?: ValidSizes;
  iconClasses?: string;
  outerLabel?: string;
  outerLabelSize?: ValidSizes;
  outerLabelColor?: string;
  borderClasses?: string;
  rounded?: ValidRounded;
  bgColor?: string;
  activeBgColor?: string;
  shadow?: ValidRounded;
  padding?: string;
  justify?: ValidJustify;
  inverted?: boolean;
  fullWidth?: boolean;
  onClick?: React.MouseEventHandler;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  submit?: boolean;
}

export default function Button({
  submit = false,
  label = "",
  labelSize = "sm",
  labelColor = "text-neutral-600 dark:text-neutral-50/85",
  activeLabelColor = "text-white dark:active:text-black",
  icon = NullComponent,
  iconSize = "2xl",
  iconClasses = "",
  outerLabel = "",
  outerLabelSize = "sm",
  outerLabelColor = "text-neutral-700 dark:text-neutral-100",
  borderClasses = "border border-2 border-primary dark:border-primarydark-400",
  rounded = "full",
  bgColor = "bg-white dark:bg-neutral-1000",
  activeBgColor = "bg-primary dark:active:bg-primarydark",
  shadow = "md",
  padding = "3",
  justify = "center",
  inverted = false,
  fullWidth = false,
  onClick = () => null,
  disabled = false,
  className = "",
  style = {},
}: ButtonProps) {
  const Icon = icon;
  // tailwindcss dynamic classes don't work here, the tokenizer needs to see the whole string, they're computed at build time, not runtime!
  const colors = `${bgColor} ${labelColor} ${disabled ? "" : `active:${activeBgColor} active:${activeLabelColor}`}`;
  const invertedColors = `${activeBgColor} ${activeLabelColor} ${disabled ? "" : `active:${bgColor} active:${labelColor}`}`;
  const colorClasses = inverted ? invertedColors : colors;

  const roundedClass = rounded === true ? "rounded" : `rounded-${rounded}`;
  const shadowClass = shadow === true ? "shadow" : `shadow-${shadow}`;

  const disabledClasses = disabled
    ? `opacity-50 shadow-none active:shadow-none`
    : "cursor-pointer";

  const handleOnClick = async (event) => {
    event.stopPropagation();
    onClick(event);
  };

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className}`}>
      <button
        type={submit ? "submit" : "button"}
        onClick={handleOnClick}
        className={`
          flex items-center justify-${justify}
          p-${padding} mx-auto
          ${fullWidth ? " w-full " : ""}
          ${borderClasses}
          ${colorClasses}
          text-${labelSize}
          ${roundedClass}
          ${shadowClass}
          opacity-90
          active:shadow-none active:shadow-inner
          ${disabledClasses}
        `}
        disabled={disabled}
        style={style}
      >
        <Icon
          className={`text-${iconSize} ${label ? "mr-1" : ""} ${iconClasses}`}
        />
        {label}
      </button>
      {outerLabel && (
        <div
          className={`text-${outerLabelSize} ${outerLabelColor} mt-1 select-none text-center`}
        >
          {outerLabel}
        </div>
      )}
    </div>
  );
}
