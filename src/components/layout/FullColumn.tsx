interface FullColumnProps {
  children: React.ReactNode;
  className?: string;
}

export default function FullColumn({
  children,
  className = "",
}: FullColumnProps) {
  return <div className={`flex flex-col h-full ${className}`}>{children}</div>;
}
