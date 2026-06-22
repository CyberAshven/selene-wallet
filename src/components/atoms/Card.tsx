interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export default function Card({ className = undefined, children }: CardProps) {
  return (
    <div
      className={`max-w-full bg-primary-200 dark:bg-neutral-800 dark:text-neutral-100 border border-primary-700 dark:border-primarydark-200 rounded-lg shadow ${className}`}
    >
      {children}
    </div>
  );
}
