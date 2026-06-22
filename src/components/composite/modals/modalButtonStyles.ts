// Shared button style presets for modal and lock screen components.
// Each preset is a partial ButtonProps object that can be spread onto <Button />.

export const cancelButtonProps = {
  bgColor: "bg-neutral-200 dark:bg-neutral-700",
  activeBgColor: "bg-neutral-300 dark:bg-neutral-600",
  labelColor: "text-neutral-800 dark:text-neutral-100 font-medium",
  activeLabelColor: "text-neutral-900 dark:text-neutral-50",
  borderClasses: "",
  rounded: "lg" as const,
  shadow: "none" as const,
} as const;

export const confirmButtonProps = {
  bgColor: "bg-primary-500 hover:bg-primary-700",
  activeBgColor: "bg-primary-700",
  labelColor: "text-white font-semibold",
  activeLabelColor: "text-white",
  borderClasses: "",
  rounded: "lg" as const,
  shadow: "none" as const,
} as const;

export const dangerButtonProps = {
  bgColor: "bg-error hover:bg-error-dark",
  activeBgColor: "bg-error-dark",
  labelColor: "text-white font-semibold",
  activeLabelColor: "text-white",
  borderClasses: "",
  rounded: "lg" as const,
  shadow: "none" as const,
} as const;
