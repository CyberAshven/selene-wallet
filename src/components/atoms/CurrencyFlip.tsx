import { TransactionOutlined } from "@ant-design/icons";

import { useCurrencyFlip } from "@/hooks/useCurrencyFlip";

export default function CurrencyFlip({
  className = "",
}: {
  className?: string;
}) {
  const handleFlipLocalCurrency = useCurrencyFlip();

  return (
    <TransactionOutlined
      className={`cursor-pointer ${className}`}
      onClick={handleFlipLocalCurrency}
    />
  );
}
