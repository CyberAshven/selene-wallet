/* eslint-disable react/jsx-props-no-spreading */
import { useDispatch, useSelector } from "react-redux";
import { EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";

import { selectPrivacySettings, setPreference } from "@/redux/preferences";

import SecurityService, { AuthActions } from "@/kernel/app/SecurityService";

export default function BalanceHideButton({
  className = "",
}: {
  className?: string;
}) {
  const dispatch = useDispatch();
  const { shouldHideBalance } = useSelector(selectPrivacySettings);
  const Icon = shouldHideBalance ? EyeInvisibleOutlined : EyeOutlined;

  const hiddenClasses = shouldHideBalance
    ? "text-primary-500"
    : "text-primary-700";

  const handleHideBalance = async () => {
    if (shouldHideBalance === true) {
      const isAuthorized = await SecurityService().authorize(
        AuthActions.RevealBalance
      );
      if (!isAuthorized) {
        return;
      }
    }

    dispatch(
      setPreference({
        key: "hideAvailableBalance",
        value: (!shouldHideBalance).toString(),
      })
    );
  };

  return (
    <Icon
      className={`cursor-pointer w-12 h-12 flex justify-center items-center ${className} ${hiddenClasses}`}
      onClick={handleHideBalance}
    />
  );
}
