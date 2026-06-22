import { logos } from "@/util/logos";

interface Props {
  className?: string;
  onClick?: React.MouseEventHandler<HTMLImageElement>;
  cashtokens?: boolean;
}

export default function SeleneLogo({
  className = "",
  onClick = () => null,
  cashtokens = false,
}: Props) {
  return (
    <img
      src={cashtokens ? logos.selene.img_tokens : logos.selene.img}
      className={className}
      onClick={onClick}
      alt="Selene Wallet Logo"
    />
  );
}
