import { useSelector } from "react-redux";
import { NavLink } from "react-router";
import {
  BankFilled,
  BankOutlined,
  CompassFilled,
  CompassOutlined,
  SettingFilled,
  SettingOutlined,
  WalletFilled,
  WalletOutlined,
} from "@ant-design/icons";

import { selectKeyboardIsOpen, selectScannerIsScanning } from "@/redux/device";
import {
  selectIsVendorModeActive,
  selectLanguageCode,
  selectLastAssetsPath,
  selectUiSettings,
} from "@/redux/preferences";

import { translate } from "@/util/translations";

import translations from "./bottomNavigationTranslations";

export default function BottomNavigation() {
  const isKeyboardOpen = useSelector(selectKeyboardIsOpen);
  const isScanning = useSelector(selectScannerIsScanning);
  const isVendorModeActive = useSelector(selectIsVendorModeActive);
  const { shouldDisplayExploreTab } = useSelector(selectUiSettings);

  // Ensure component reloads when language preferences are changed
  useSelector(selectLanguageCode);

  const lastAssetsPath = useSelector(selectLastAssetsPath);

  if (isKeyboardOpen || isVendorModeActive) {
    return null;
  }

  return (
    <nav
      data-testid="nav-bottom"
      className={`w-full flex items-center justify-around z-30 ${isScanning ? "opacity-0" : ""}`}
    >
      <NavButton
        to="/wallet"
        activeIcon={WalletFilled}
        icon={WalletOutlined}
        label={translate(translations.wallet)}
      />

      <NavButton
        to={lastAssetsPath}
        activeIcon={BankFilled}
        icon={BankOutlined}
        label={translate(translations.assets)}
      />

      {shouldDisplayExploreTab && (
        <NavButton
          to="/explore"
          activeIcon={CompassFilled}
          icon={CompassOutlined}
          label={translate(translations.explore)}
        />
      )}
      <NavButton
        to="/settings"
        activeIcon={SettingFilled}
        icon={SettingOutlined}
        label={translate(translations.settings)}
      />
    </nav>
  );
}

interface NavButtonProps {
  to: string;
  icon: React.ComponentType;
  activeIcon: React.ComponentType;
  label: string;
}

function NavButton({ to, icon, activeIcon, label }: NavButtonProps) {
  const Icon = icon;
  const ActiveIcon = activeIcon;

  const baseClasses =
    "bg-neutral-900 dark:bg-black text-primary border-primary w-full h-16 p-2 pt-3 flex flex-col justify-center items-center";
  const activeClasses =
    "active shadow-[inset_0_4px_0_0_currentColor] font-semibold";
  const iconClasses = "text-2xl";

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive ? `${baseClasses} ${activeClasses}` : `${baseClasses}`
      }
    >
      {({ isActive }) => (
        <>
          <div className="text-center">
            {isActive ? (
              <ActiveIcon className={iconClasses} />
            ) : (
              <Icon className={iconClasses} />
            )}
          </div>
          <div className="text-center text-sm">{label}</div>
        </>
      )}
    </NavLink>
  );
}
