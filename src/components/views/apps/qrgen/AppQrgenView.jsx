import { useState } from "react";
import { QRCode } from "react-qrcode-logo";
import { QrcodeOutlined } from "@ant-design/icons";

import FullColumn from "@/layout/FullColumn";
import ViewHeader from "@/layout/ViewHeader";
import Button from "@/atoms/Button";

export default function AppQrgenView() {
  const [inputText, setInputText] = useState("");
  const [qrString, setQrString] = useState("");

  const handleGenerate = () => {
    setQrString(inputText);
  };

  return (
    <FullColumn>
      <ViewHeader title="QR Code Generator" icon={QrcodeOutlined} />
      <div className="p-2">
        <div className="flex items-center justify-center p-2">
          <button
            type="button"
            className={`border-4 cursor-pointer active:bg-primary shadow-inner shadow-lg active:shadow-none active:shadow-inner active:scale-[0.98] border-primary-700`}
          >
            <QRCode
              value={qrString}
              size={232}
              quietZone={12}
              bgColor={"#ffffff"}
              fgColor={"#000000"}
              logoImage={""}
              logoWidth={64}
              logoHeight={64}
            />
          </button>
        </div>
        <div className="font-mono text-center">{qrString}</div>
      </div>
      <div>
        <div className="flex items-center justify-center">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="border-2 border-primary rounded p-2 m-2 w-full"
          />
        </div>
        <Button label="Generate" onClick={handleGenerate} />
      </div>
    </FullColumn>
  );
}
