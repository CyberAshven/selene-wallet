import { useNavigate } from "react-router";
import { DoubleRightOutlined } from "@ant-design/icons";

import Button from "@/atoms/Button";

import { useNavigateExternal } from "@/hooks/useNavigateExternal";

interface Props {
  name: string;
  icon?: React.ComponentType;
  to?: string;
  external?: boolean;
}

export default function ExploreApp({
  name,
  icon = () => null,
  to = "",
  external = false,
}: Props) {
  const navigate = useNavigate();
  const navigateExternal = useNavigateExternal();

  const label = (
    <span className="w-full flex justify-between items-center">
      <span>{name}</span>
      <DoubleRightOutlined />
    </span>
  );

  return (
    <Button
      icon={icon}
      label={label}
      labelSize="lg"
      rounded="lg"
      justify="start"
      shadow="sm"
      fullWidth
      onClick={() => (external ? navigateExternal(to) : navigate(to))}
    />
  );
}
