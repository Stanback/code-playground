import {
  parse,
  converter,
  toGamut,
  formatHex,
  formatHex8,
  interpolateWithPremultipliedAlpha,
  wcagContrast,
} from "culori";
export const toLch = converter("oklch");
export const toLab = converter("oklab");
export const toRgb = converter("rgb");
const toP3 = converter("p3");
const maps = { rgb: toGamut("rgb"), p3: toGamut("p3") };
export const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
export const round = (value, places = 4) => Number(value.toFixed(places));
export const normalizeHue = (hue) => ((hue % 360) + 360) % 360;
export function readColor(text, lastHue = 250) {
  const parsed = parse(text.trim());
  if (!parsed) return null;
  const color = toLch(parsed);
  if (
    !color ||
    !Number.isFinite(color.l) ||
    !Number.isFinite(color.c) ||
    color.c < 0 ||
    color.c > 0.6
  )
    return null;
  const hue = Number.isFinite(color.h) ? normalizeHue(color.h) : lastHue;
  if (color.alpha !== undefined && !Number.isFinite(color.alpha)) return null;
  return {
    mode: "oklch",
    l: clamp(color.l),
    c: color.c < 1e-7 ? 0 : color.c,
    h: hue,
    alpha: clamp(color.alpha ?? 1),
  };
}
export function inColorGamut(color, space = "rgb") {
  const converted = space === "p3" ? toP3(color) : toRgb(color);
  return (
    !!converted &&
    ["r", "g", "b"].every(
      (channel) =>
        Number.isFinite(converted[channel]) &&
        converted[channel] >= -1e-7 &&
        converted[channel] <= 1 + 1e-7,
    )
  );
}
export function mappedColor(color, space = "rgb") {
  const mapped = maps[space](color);
  return {
    ...mapped,
    r: clamp(mapped.r),
    g: clamp(mapped.g),
    b: clamp(mapped.b),
    alpha: clamp(color.alpha ?? 1),
  };
}
export function cssColor(color, space = "oklch") {
  const alpha = (color.alpha ?? 1) < 1 ? ` / ${round(color.alpha ?? 1)}` : "";
  if (space === "oklch") {
    const c = toLch(color);
    return `oklch(${round(clamp(c.l) * 100, 2)}% ${round(c.c ?? 0)} ${round(c.h ?? 0, 2)}${alpha})`;
  }
  if (space === "oklab") {
    const c = toLab(color);
    return `oklab(${round(clamp(c.l) * 100, 2)}% ${round(c.a)} ${round(c.b)}${alpha})`;
  }
  const c = mappedColor(color, space === "p3" ? "p3" : "rgb");
  if (space === "p3")
    return `color(display-p3 ${round(c.r)} ${round(c.g)} ${round(c.b)}${alpha})`;
  if (space === "hex") return (c.alpha < 1 ? formatHex8 : formatHex)(c);
  return `rgb(${round(c.r * 255, 1)} ${round(c.g * 255, 1)} ${round(c.b * 255, 1)}${alpha})`;
}
export function contrastOn(color, background) {
  const fg = mappedColor(color),
    bg = toRgb(background),
    alpha = fg.alpha;
  const effective = {
    mode: "rgb",
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  };
  return wcagContrast(effective, bg);
}
export function makePalette(color, gamut = "rgb") {
  return Array.from({ length: 9 }, (_, index) => {
    const original = { ...color, l: 0.96 - index * 0.105, alpha: 1 };
    const mapped = mappedColor(original, gamut);
    return {
      step: (index + 1) * 100,
      color: mapped,
      css: cssColor(mapped),
      hex: cssColor(mapped, "hex"),
    };
  });
}
export function gradientSamples(a, b, mode, count = 32) {
  const mix = interpolateWithPremultipliedAlpha([a, b], mode);
  return Array.from({ length: count }, (_, index) =>
    cssColor(mix(index / (count - 1))),
  );
}
