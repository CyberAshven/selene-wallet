import { useDispatch, useSelector } from "react-redux";
import { CloseOutlined, ScanOutlined } from "@ant-design/icons";

import { selectScannerIsScanning, setScannerIsScanning } from "@/redux/device";

import translations from "@/views/wallet/translations";
import Button, { ValidSizes } from "@/atoms/Button";

import { translate } from "@/util/translations";

export default function ScannerButton({
  label = true,
  size = "4xl",
  padding = "3",
}: {
  label?: boolean;
  size?: ValidSizes;
  padding?: string;
}) {
  const dispatch = useDispatch();
  const isScanning = useSelector(selectScannerIsScanning);

  const toggleScanner = () => {
    dispatch(setScannerIsScanning(!isScanning));
  };

  const ScanIcon = isScanning ? CloseOutlined : ScanOutlined;
  const closeTranslation = translate(translations.close);
  const scanTranslation = translate(translations.scan);
  const scanLabel =
    (label && (isScanning ? closeTranslation : scanTranslation)) || "";
  const scanLabelColor = isScanning ? "text-white/80" : undefined;

  return (
    <Button
      icon={ScanIcon}
      outerLabel={scanLabel}
      outerLabelColor={scanLabelColor}
      iconSize={size}
      padding={padding}
      onClick={toggleScanner}
    />
  );
}
