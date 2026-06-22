import { useEffect, useRef } from "react";

import { sha256 } from "@/util/hash";

interface ChecksumProps {
  data: string;
  canvasSize?: number;
}

export function Checksum({ data, canvasSize = 32 }: ChecksumProps) {
  const canvasRef = useRef(null);
  const hash = sha256.text(data);
  const h = Number.parseInt(hash.slice(0, 8), 16);
  const size = (h % 16) + 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const quadrantSize = size / 2;

    // Function to draw a pixel with color from hash
    const drawPixel = (x, y) => {
      const pos = (y * quadrantSize + x) % 58;
      const colorHex = hash.slice(pos, pos + 6);
      ctx.fillStyle = `#${colorHex}`;
      ctx.fillRect(x, y, 1, 1);
    };

    // Draw top-left quadrant
    for (let y = 0; y < quadrantSize; y += 1) {
      for (let x = 0; x < quadrantSize; x += 1) {
        drawPixel(x, y);
      }
    }

    // Mirror horizontally
    ctx.scale(-1, 1);
    ctx.translate(-size, 0);
    ctx.drawImage(
      canvas,
      0,
      0,
      quadrantSize,
      quadrantSize,
      0,
      0,
      quadrantSize,
      quadrantSize
    );
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation

    // Mirror vertically
    ctx.scale(1, -1);
    ctx.translate(0, -size);
    ctx.drawImage(canvas, 0, 0, size, quadrantSize, 0, 0, size, quadrantSize);
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transformation
  }, [hash, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: `${canvasSize}px`,
        height: `${canvasSize}px`,
        imageRendering: "pixelated",
      }}
    />
  );
}

export default Checksum;
