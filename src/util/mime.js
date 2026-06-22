export function detectImageMime(base64) {
  // Decode Base64 to bytes
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const str = (len) =>
    new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, len));

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";

  // GIF: GIF87a or GIF89a
  if (str(6) === "GIF87a" || str(6) === "GIF89a") {
    return "image/gif";
  }

  // WEBP: RIFF .... WEBP
  if (str(4) === "RIFF" && str(12).slice(8) === "WEBP") {
    return "image/webp";
  }

  // BMP: BM
  if (str(2) === "BM") {
    return "image/bmp";
  }

  // ICO: 00 00 01 00
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x00 &&
    bytes[2] === 0x01 &&
    bytes[3] === 0x00
  )
    return "image/x-icon";

  // SVG: Decode full if UTF-8 valid, check for <svg or <?xml...><svg
  // SECURITY: SVG can contain <script> and event handlers. Only safe when
  // rendered via <img src> (browser sandboxes scripts). NEVER render as
  // inline SVG, <object>, <embed>, or <iframe> — scripts WILL execute.
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    if (
      text.startsWith("<svg") ||
      (text.startsWith("<?xml") && text.includes("<svg"))
    )
      return "image/svg+xml";
  } catch (e) {
    // Not UTF-8
  }

  return null; // Unknown or not image
}
