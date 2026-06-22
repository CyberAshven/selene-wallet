/* eslint-disable react/jsx-props-no-spreading */
import { useRef } from "react";
import { useDispatch } from "react-redux";
import QrScanner from "qr-scanner";
import { PictureOutlined } from "@ant-design/icons";

import { setScannerIsScanning } from "@/redux/device";

import NotificationService from "@/kernel/app/NotificationService";

import translations from "@/views/wallet/translations";
import Button, { ButtonProps } from "@/atoms/Button";

import { translate } from "@/util/translations";

interface ImageSelectButtonProps extends ButtonProps {
  onSelection: (data: string) => void;
}

export default function ImageSelectButton({
  onSelection,
  ...rest
}: ImageSelectButtonProps) {
  const dispatch = useDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scaleImage = (image: HTMLImageElement) => {
    const maxWidth = 1920;
    const maxHeight = 1080;
    const scaleRatio = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight
    );

    const width = image.naturalWidth * scaleRatio;
    const height = image.naturalHeight * scaleRatio;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    ctx.drawImage(image, 0, 0, width, height);

    return canvas;
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";

    const reader = new FileReader();
    reader.onerror = () => {
      NotificationService().invalidScan("Failed to read image file");
    };
    reader.onload = () => {
      const image = new Image();
      image.src = reader.result as string;
      image.onerror = () => {
        NotificationService().invalidScan("Failed to decode image");
      };
      image.onload = async () => {
        const scaledImage = scaleImage(image);

        try {
          const result = await QrScanner.scanImage(scaledImage, {
            returnDetailedScanResult: true,
          });

          NotificationService().success(
            translate(translations.scanContents),
            result.data
          );

          onSelection(result.data);
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "No QR code found";
          NotificationService().invalidScan(errorMessage);
        }

        dispatch(setScannerIsScanning(false));
      };
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <Button
        icon={PictureOutlined}
        outerLabel={translate(translations.imageText)}
        onClick={() => fileInputRef.current?.click()}
        {...rest}
      />
    </>
  );
}
