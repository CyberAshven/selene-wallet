import { clsx } from "@/util/clsx";

interface Props extends React.DetailedHTMLProps<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  HTMLSelectElement
> {
  className?: string;
}

export default function Select({ className = undefined, ...props }: Props) {
  return (
    <select
      {...props}
      className={clsx(
        "p-2 bg-white dark:bg-neutral-1000 border border-primary dark:border-primarydark-400 dark:text-neutral-100 rounded h-10 disabled:bg-neutral-200 disabled:text-neutral-400 dark:disabled:bg-neutral-300 dark:disabled:text-neutral-500",
        className
      )}
    />
  );
}
