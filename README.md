# Code Playground

Fun little experiments and toy projects by [Bri Stanback](https://bristanback.com). A place to try ideas, learn something, and build small things for the sake of it.

[Explore the playground →](https://stanback.github.io/code-playground/)

## Experiments

### [Color Lab: OKLCH & OKLab](https://stanback.github.io/code-playground/oklch-explorer/)

An interactive color-space explorer with synchronized OKLCH and OKLab controls, a two-dimensional color plane, real sRGB/Display P3 gamut checks, CSS color import, mapped color outputs, palette generation/export, gradient comparisons, and WCAG contrast calculations.

The original OKLCH experiment has been expanded and corrected. Gamut membership is calculated from converted RGB channels rather than a chroma threshold. Wide-gamut support is distinguished from HDR, and contrast is calculated from relative luminance rather than OKLCH lightness. The existing `oklch-explorer/` URL is retained.

Everything runs in the browser. No accounts, analytics, backend, or uploads. Colors can be shared through URL fragments; exports are downloaded locally.

## Run locally

Requires Node.js 22.12+.

```sh
npm ci
npm run dev
```

Vite serves the playground at `/code-playground/`. The root is a small experiment index; `oklch-explorer/` contains Color Lab. Color calculations live in `src/color.js` and use [Culori](https://culorijs.org/).

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

GitHub Actions checks calculations and desktop/mobile behavior, then publishes the static build to GitHub Pages. Future experiments can be added as additional HTML entries in `vite.config.js`.

## Color notes

- OKLab and OKLCH are two coordinate systems for the same perceptual color space. Switching editors preserves the underlying color.
- The editable lightness range is 0–100%, chroma is 0–0.6, and OKLab a/b controls start at −0.4 to 0.4 and expand to show the selected color; edits stay within the same 0–0.6 chroma limit. Imported lightness follows CSS’s 0–100% clamp. Unsupported/unresolved CSS values are rejected.
- Gamut checks convert the original color to sRGB and Display P3, then test channel bounds with a 1e-7 tolerance for floating-point roundoff.
- HEX/RGB/P3 outputs use Culori’s OKLCH gamut mapping where necessary. Mapping is an approximation; browser rendering can differ. The color plane is an sRGB raster, and hatching marks points outside the selected gamut.
- WCAG 2 ratios use the sRGB-mapped color. Alpha is composited onto each named background before contrast is calculated. Ratios are not a complete accessibility assessment.
- Palette steps are evenly spaced in OKLCH lightness at a fixed hue and starting chroma, then mapped to the selected gamut. They are generated scales, not an existing design system’s tokens.
- Gradients use the same endpoints, interpolated separately in sRGB, OKLab, and OKLCH with premultiplied alpha. OKLCH follows the shorter hue path.
- A wide-gamut display does not imply HDR. OKLCH lightness above 100% is not a way to request HDR brightness.

References: [OKLab by Björn Ottosson](https://bottosson.github.io/posts/oklab/), [CSS Color 4](https://www.w3.org/TR/css-color-4/#ok-lab), [Culori API](https://culorijs.org/api/).
