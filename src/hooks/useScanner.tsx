import { useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Torch } from "@capawesome/capacitor-torch";
import QrScanner from "qr-scanner";

import {
  selectScannerIsScanning,
  selectTorchIsEnabled,
  setScannerIsScanning,
} from "@/redux/device";

import LogService from "@/kernel/app/LogService";

const Log = LogService("useScanner");

// QrScanner singleton for performance (avoids 300ms recreation delay)
let _scanner: QrScanner | null = null;
let _currentScanCallback: ((data: string) => void) | null = null;

function initScanner(onScan) {
  _currentScanCallback = onScan;

  if (_scanner === null) {
    const video = document.createElement("video");
    // Use transparent 1x1 pixel as poster to hide default placeholder
    video.poster =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    const scannerContainer = document.querySelector(
      "#scannerOutput"
    ) as HTMLDivElement;
    scannerContainer.appendChild(video);

    _scanner = new QrScanner(
      video,
      (result) => _currentScanCallback?.(result.data),
      {
        returnDetailedScanResult: true,
        maxScansPerSecond: 4,
        highlightScanRegion: false,
        highlightCodeOutline: false,
        calculateScanRegion: (v) => {
          // Scan the device's shortest side, mapped to video pixels via object-fit:cover
          const viewportW = v.clientWidth || v.videoWidth;
          const viewportH = v.clientHeight || v.videoHeight;
          const scale = Math.max(
            viewportW / v.videoWidth,
            viewportH / v.videoHeight
          );
          const shortSide = Math.min(viewportW, viewportH);
          const clampedSize = Math.min(
            Math.round(shortSide / scale),
            v.videoWidth,
            v.videoHeight
          );

          const downScaled = Math.min(clampedSize, 480);

          return {
            x: Math.round((v.videoWidth - clampedSize) / 2),
            y: Math.round((v.videoHeight - clampedSize) / 2),
            width: clampedSize,
            height: clampedSize,
            downScaledWidth: downScaled,
            downScaledHeight: downScaled,
          };
        },
      }
    );
    _scanner.setInversionMode("both");
    Log.debug("initScanner");
  }

  return _scanner;
}

export function useScanner(onScan) {
  const dispatch = useDispatch();
  const isScanning = useSelector(selectScannerIsScanning);
  const isTorchEnabled = useSelector(selectTorchIsEnabled);

  const hasScanContent = useRef(false);

  const handleScanContent = useCallback(
    async (content) => {
      dispatch(setScannerIsScanning(false));

      if (!hasScanContent.current) {
        hasScanContent.current = true;
        await onScan(content);
      }
    },
    [onScan, dispatch]
  );

  const scanner = initScanner(handleScanContent);

  const startScanner = useCallback(async () => {
    try {
      hasScanContent.current = false;
      await scanner.start();
    } catch (e) {
      // Squelch error that arises from trying to change srcVideo abruptly
      // Simply restart the camera if this happens
      if (e instanceof DOMException) {
        startScanner();
      } else {
        throw e;
      }
    }
  }, [scanner]);

  const stopScanner = useCallback(() => {
    scanner.stop();
  }, [scanner]);

  useEffect(
    function resetScanner() {
      if (scanner === null) {
        throw new Error("Scanner unavailable!");
      }

      if (isScanning) {
        startScanner();
      } else {
        stopScanner();
      }

      return () => {
        if (scanner !== null && isScanning) {
          stopScanner();
        }
      };
    },
    [scanner, isScanning, startScanner, stopScanner]
  );

  useEffect(
    function resetTorch() {
      if (scanner !== null) {
        if (isTorchEnabled) {
          Torch.enable();
        }
      }

      return () => {
        if (scanner !== null) {
          Torch.disable();
        }
      };
    },
    [scanner, isTorchEnabled]
  );
}
