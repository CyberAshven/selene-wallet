import { NavLink } from "react-router";

interface NavTabProps {
  to: string;
  icon: React.ComponentType;
  activeIcon: React.ComponentType;
  label: string;
}

export default function NavTab({ to, icon, activeIcon, label }: NavTabProps) {
  const Icon = icon;
  const ActiveIcon = activeIcon;

  const baseClasses = "bg-neutral-800 text-primary border-primary w-full p-2";
  const activeClasses = "active border-b-4 font-semibold shadow-inner";
  const iconClasses = "text-lg mr-1";

  return (
    <NavLink
      to={to}
      replace
      className={({ isActive }) =>
        isActive ? `${baseClasses} ${activeClasses}` : `${baseClasses}`
      }
    >
      {({ isActive }) => (
        <div className="flex items-center justify-center text-sm">
          {isActive ? (
            <ActiveIcon className={iconClasses} />
          ) : (
            <Icon className={iconClasses} />
          )}
          <span>{label}</span>
        </div>
      )}
    </NavLink>
  );
}
