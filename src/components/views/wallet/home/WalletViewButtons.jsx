import { useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { HistoryOutlined, SendOutlined } from "@ant-design/icons";

import { selectScannerIsScanning } from "@/redux/device";

import translations from "@/views/wallet/translations";
import Button from "@/atoms/Button";

import { useClipboard } from "@/hooks/useClipboard";

import { navigateOnValidUri } from "@/util/uri";

import { translate } from "@/util/translations";

import ImageSelectButton from "./ImageSelectButton";
import ScannerButton from "./ScannerButton";
import TorchButton from "./TorchButton";

export default function WalletViewButtons() {
  const navigate = useNavigate();
  const isScanning = useSelector(selectScannerIsScanning);

  const { getClipboardContents } = useClipboard();

  const forwardOnValidAddress = async (input) => {
    const { navTo, navState } = await navigateOnValidUri(input);
    if (navTo) {
      navigate(navTo, { state: navState });
    }
  };

  const pasteAddressFromClipboard = async () => {
    const { paste, spawnPasteToast } = await getClipboardContents();
    const { navTo, navState, extractedUri } = await navigateOnValidUri(paste);
    if (navTo !== "") {
      spawnPasteToast(extractedUri);
      navigate(navTo, { state: navState });
    } else {
      navigate("/wallet/send/");
    }
  };

  const handleHistoryButton = () => {
    navigate("/wallet/history");
  };

  return (
    <div className="flex items-center w-auto mx-4 my-3 justify-evenly relative z-40">
      {isScanning ? (
        <ImageSelectButton
          iconSize="2xl"
          outerLabelColor="text-white/80"
          onSelection={forwardOnValidAddress}
        />
      ) : (
        <Button
          icon={HistoryOutlined}
          outerLabel={translate(translations.history)}
          onClick={handleHistoryButton}
          iconSize="2xl"
        />
      )}
      <ScannerButton />
      {isScanning ? (
        <TorchButton iconSize="2xl" outerLabelColor="text-white/80" />
      ) : (
        <Button
          icon={SendOutlined}
          outerLabel={translate(translations.send)}
          onClick={pasteAddressFromClipboard}
          iconSize="2xl"
        />
      )}
    </div>
  );
}
