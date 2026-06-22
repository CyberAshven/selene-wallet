import { useNavigateExternal } from "@/hooks/useNavigateExternal";

export default function LinkExternal({
  to,
  children,
  className = "",
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  const navigateExternal = useNavigateExternal();

  const handleClick = (e) => {
    e.stopPropagation();
    const url = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(to) ? to : `https://${to}`;
    navigateExternal(url);
  };

  return (
    <span onClick={handleClick} className={`${className} cursor-pointer`}>
      {children}
    </span>
  );
}
