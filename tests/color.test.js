import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readColor,
  toLab,
  inColorGamut,
  mappedColor,
  cssColor,
  contrastOn,
  makePalette,
  gradientSamples,
} from "../src/color.js";
const near = (a, b, tolerance = 1e-5) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} ≈ ${b}`);
test("sRGB red matches published OKLab conversion coordinates", () => {
  const lab = toLab(readColor("#ff0000"));
  near(lab.l, 0.62795536);
  near(lab.a, 0.22486306);
  near(lab.b, 0.1258463);
  assert.equal(cssColor(readColor("#ff0000"), "hex"), "#ff0000");
});
test("OKLCH and OKLab serialize the same color without picking a new one", () => {
  const original = readColor("oklch(65% .18 278 / .7)");
  const restored = readColor(cssColor(original, "oklab"));
  near(restored.l, original.l, 0.0001);
  near(restored.c, original.c, 0.0001);
  near(restored.h, original.h, 0.03);
  near(restored.alpha, 0.7);
});
test("P3 red is outside sRGB, while extreme chroma can exceed both gamuts", () => {
  const red = readColor("color(display-p3 1 0 0)");
  assert.equal(inColorGamut(red), false);
  assert.equal(inColorGamut(red, "p3"), true);
  const extreme = readColor("oklch(60% .5 30)");
  assert.equal(inColorGamut(extreme), false);
  assert.equal(inColorGamut(extreme, "p3"), false);
  for (const target of ["rgb", "p3"])
    assert.equal(inColorGamut(mappedColor(extreme, target), target), true);
});
test("WCAG contrast uses relative luminance and composites transparency", () => {
  near(contrastOn(readColor("black"), "white"), 21);
  near(contrastOn(readColor("white"), "white"), 1);
  const transparentBlack = readColor("rgb(0 0 0 / .5)");
  near(contrastOn(transparentBlack, "white"), 3.976653, 0.0001);
  near(contrastOn({ ...transparentBlack, alpha: 0 }, "white"), 1);
});
test("generated palettes fit the requested gamut and export all nine levels", () => {
  const color = readColor("oklch(70% .32 150)");
  for (const gamut of ["rgb", "p3"]) {
    const palette = makePalette(color, gamut);
    assert.equal(palette.length, 9);
    assert.deepEqual(
      palette.map((x) => x.step),
      [100, 200, 300, 400, 500, 600, 700, 800, 900],
    );
    for (const swatch of palette) {
      assert.equal(inColorGamut(swatch.color, gamut), true);
      assert.match(swatch.hex, /^#[a-f0-9]{6}$/);
    }
  }
});
test("gradient interpolation handles shorter hue paths and premultiplied alpha", () => {
  const samples = gradientSamples(
    readColor("oklch(60% .1 350)"),
    readColor("oklch(60% .1 10)"),
    "oklch",
    3,
  );
  const middle = readColor(samples[1]);
  assert.ok(middle.h < 1 || middle.h > 359);
  const alpha = gradientSamples(
    readColor("rgb(255 0 0 / 0)"),
    readColor("blue"),
    "rgb",
    3,
  );
  near(readColor(alpha[1]).alpha, 0.5);
  for (const value of alpha) assert.ok(readColor(value));
});
test("invalid CSS is rejected and achromatic colors retain a usable hue", () => {
  for (const value of [
    "not a color",
    "var(--accent)",
    "oklch(60% .7 20)",
    "rgb(NaN 0 0)",
  ])
    assert.equal(readColor(value), null);
  assert.equal(readColor("#888", 190).h, 190);
  assert.equal(readColor("oklch(120% 0 30)").l, 1);
  assert.equal(cssColor(readColor("rgb(255 0 0 / .5)"), "hex"), "#ff000080");
});
