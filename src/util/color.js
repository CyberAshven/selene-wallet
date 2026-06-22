export function hexToRgb(hex) {
  if (!hex) return [0, 0, 0];
  let h = hex.replace(/^#/, "");
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");

  const n = parseInt(h, 16);
  // eslint-disable-next-line no-bitwise
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r, g, b) {
  return [r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("");
}

export function getLuminance(r, g, b) {
  return [r, g, b]
    .map((c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}

export function getContrastRatio(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

/**
 * Always returns a background color that meets at least 4.5:1 contrast with the foreground,
 * @param {string} fgHex - Foreground (text) color, e.g. "#ffffff"
 * @param {string} preferredBgHex - Base background color (light or dark mode)
 * @param {number} [minContrast=4.5] - Minimum contrast ratio (4.5 = AA, 7 = AAA)
 * @returns {string} Adjusted background hex with #
 */
export function getHighContrastBackground(
  fgHex,
  preferredBgHex,
  minContrast = 4.5
) {
  const clamp = (v) => Math.max(0, Math.min(255, v));

  const [fgR, fgG, fgB] = hexToRgb(fgHex);
  const fgL = getLuminance(fgR, fgG, fgB);

  const [bgR, bgG, bgB] = hexToRgb(preferredBgHex);

  // Determine direction: dark foreground → push bg toward white; light fg → toward black
  const target = fgL < 0.5 ? 255 : 0;

  // Binary search for the minimal adjustment factor that achieves required contrast
  let low = 0;
  let high = 1;
  while (high - low > 0.001) {
    const mid = (low + high) / 2;
    const newR = bgR + mid * (target - bgR);
    const newG = bgG + mid * (target - bgG);
    const newB = bgB + mid * (target - bgB);
    const newL = getLuminance(newR, newG, newB);

    if (getContrastRatio(fgL, newL) >= minContrast) {
      high = mid; // This adjustment is sufficient — try smaller
    } else {
      low = mid; // Need stronger adjustment
    }
  }

  const factor = high; // Smallest factor that meets contrast
  const finalR = clamp(bgR + factor * (target - bgR));
  const finalG = clamp(bgG + factor * (target - bgG));
  const finalB = clamp(bgB + factor * (target - bgB));

  return `#${rgbToHex(finalR, finalG, finalB)}`;
}
