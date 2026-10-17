import "./lab.css";
import {
  toLch,
  toLab,
  toRgb,
  clamp,
  round,
  normalizeHue,
  readColor,
  inColorGamut,
  mappedColor,
  cssColor,
  contrastOn,
  makePalette,
  gradientSamples,
} from "./color.js";
const $ = (selector) => document.querySelector(selector);
let color = readColor("oklch(70% .16 250)"),
  space = "oklch",
  gamut = "rgb",
  planeKey = "",
  toastTimer,
  frame,
  planeAxisLimit = 0.4;
const initialHash = new URLSearchParams(location.hash.slice(1));
const initialColor = readColor(initialHash.get("color") ?? "");
if (initialColor) color = initialColor;
if (initialHash.get("space") === "oklab") space = "oklab";
function notify(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3000);
}
async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    notify("Copied to clipboard.");
  } catch {
    notify("Clipboard unavailable. Select and copy the value instead.");
  }
}
function paintValue(value) {
  return cssColor(value);
}
const labLimit = () =>
  Math.max(
    0.4,
    Math.ceil(
      Math.max(Math.abs(toLab(color).a), Math.abs(toLab(color).b)) * 10,
    ) / 10,
  );
const channelDefs = () =>
  space === "oklch"
    ? [
        {
          id: "l",
          label: "Lightness",
          short: "L",
          min: 0,
          max: 100,
          step: 0.1,
          unit: "%",
        },
        {
          id: "c",
          label: "Chroma",
          short: "C",
          min: 0,
          max: 0.6,
          step: 0.001,
          unit: "",
        },
        {
          id: "h",
          label: "Hue",
          short: "H",
          min: 0,
          max: 360,
          step: 0.1,
          unit: "°",
        },
      ]
    : [
        {
          id: "l",
          label: "Lightness",
          short: "L",
          min: 0,
          max: 100,
          step: 0.1,
          unit: "%",
        },
        {
          id: "a",
          label: "Green ↔ red",
          short: "a",
          min: -labLimit(),
          max: labLimit(),
          step: 0.001,
          unit: "",
        },
        {
          id: "b",
          label: "Blue ↔ yellow",
          short: "b",
          min: -labLimit(),
          max: labLimit(),
          step: 0.001,
          unit: "",
        },
      ];
function channelColor(key, value) {
  if (key === "l") return { ...color, l: value / 100 };
  if (space === "oklch") return { ...color, [key]: value };
  return { ...toLch({ ...toLab(color), [key]: value }), alpha: color.alpha };
}
function buildControls() {
  $("#channel-controls").innerHTML = channelDefs()
    .map(
      (d) =>
        `<div class="channel-control"><div><label for="channel-${d.id}">${d.label} <span>${d.short}</span></label><span><input type="number" aria-label="${d.short} value" id="value-${d.id}" min="${d.min}" max="${d.max}" step="${d.step}"><span>${d.unit}</span></span></div><input type="range" aria-label="${d.label}" id="channel-${d.id}" min="${d.min}" max="${d.max}" step="${d.step}"></div>`,
    )
    .join("");
  for (const d of channelDefs())
    for (const id of [`channel-${d.id}`, `value-${d.id}`])
      document.getElementById(id).addEventListener("input", (event) => {
        const value = event.target.valueAsNumber;
        if (!Number.isFinite(value)) return;
        const current = channelDefs().find((channel) => channel.id === d.id);
        color = channelColor(d.id, clamp(value, current.min, current.max));
        if (color.c > 0.6) {
          color = { ...color, c: 0.6 };
          if (d.id !== "l")
            event.target.value = String(round(toLab(color)[d.id], 3));
          notify("Chroma is limited to 0.6 in this editor.");
        }
        color = { ...color, h: normalizeHue(color.h ?? 250) };
        update();
      });
  document
    .querySelectorAll("[data-space]")
    .forEach((button) =>
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.space === space),
      ),
    );
  $("#plane-title").textContent = space === "oklch" ? "Hue × chroma" : "a × b";
  $("#plane-left").textContent = space === "oklch" ? "0°" : "−0.4";
  $("#plane-right").textContent = space === "oklch" ? "360°" : "+0.4";
  $("#plane-axis-name").textContent =
    space === "oklch" ? "HUE" : "GREEN ← a → RED";
  $(".plane-axis-y").textContent =
    space === "oklch" ? "CHROMA" : "BLUE ← b → YELLOW";
}
function drawPlane() {
  const canvas = $("#color-plane"),
    ctx = canvas.getContext("2d"),
    width = canvas.width,
    height = canvas.height;
  const maxChroma = color.c > 0.4000001 ? 0.6 : 0.4;
  const lab = toLab(color);
  planeAxisLimit =
    Math.max(Math.abs(lab.a), Math.abs(lab.b)) > 0.4000001 ? 0.6 : 0.4;
  if (space === "oklab") {
    $("#plane-left").textContent = `−${planeAxisLimit}`;
    $("#plane-right").textContent = `+${planeAxisLimit}`;
  }
  const key = [round(color.l, 3), space, gamut, maxChroma, planeAxisLimit].join(
    ":",
  );
  if (key !== planeKey) {
    planeKey = key;
    const image = ctx.createImageData(width, height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const point =
          space === "oklch"
            ? {
                mode: "oklch",
                l: color.l,
                c: (1 - y / (height - 1)) * maxChroma,
                h: (x / (width - 1)) * 360,
              }
            : {
                mode: "oklab",
                l: color.l,
                a: ((x / (width - 1)) * 2 - 1) * planeAxisLimit,
                b: (1 - (y / (height - 1)) * 2) * planeAxisLimit,
              };
        const rgb = toRgb(point),
          inside = inColorGamut(point, gamut),
          hatch = !inside && (x + y) % 12 < 3,
          offset = (y * width + x) * 4;
        for (const [index, channel] of ["r", "g", "b"].entries())
          image.data[offset + index] = hatch ? 185 : clamp(rgb[channel]) * 255;
        image.data[offset + 3] = 255;
      }
    ctx.putImageData(image, 0, 0);
  }
  const x =
      space === "oklch"
        ? normalizeHue(color.h) / 360
        : (lab.a / planeAxisLimit + 1) / 2,
    y =
      space === "oklch"
        ? 1 - color.c / maxChroma
        : (1 - lab.b / planeAxisLimit) / 2;
  $(".plane-cursor").style.left = `${clamp(x) * 100}%`;
  $(".plane-cursor").style.top = `${clamp(y) * 100}%`;
}
function updateGradients() {
  const a = readColor($("#gradient-a").value),
    b = readColor($("#gradient-b").value),
    error = $("#gradient-error");
  if (!a || !b) {
    error.hidden = false;
    error.textContent = "Enter valid colors for both endpoints.";
    return;
  }
  error.hidden = true;
  $("#gradient-strips").innerHTML = ["rgb", "oklab", "oklch"]
    .map(
      (mode) =>
        `<div class="gradient-row"><span>${mode === "rgb" ? "sRGB" : mode === "oklab" ? "OKLab" : "OKLCH"}</span><div class="gradient-strip">${gradientSamples(
          a,
          b,
          mode,
          48,
        )
          .map((c) => `<i style="background:${c}"></i>`)
          .join("")}</div></div>`,
    )
    .join("");
}
function updatePalette() {
  const palette = makePalette(color, gamut);
  $("#palette-strip").innerHTML = palette
    .map(
      (swatch) =>
        `<button class="palette-swatch" style="--swatch:${cssColor(swatch.color, gamut === "p3" ? "p3" : "rgb")}" data-step="${swatch.step}" aria-label="Copy ${swatch.step} palette color"><span class="palette-color"></span><strong>${swatch.step}</strong><code>${swatch.hex}</code></button>`,
    )
    .join("");
}
function update() {
  const lab = toLab(color);
  for (const d of channelDefs()) {
    const value =
      d.id === "l"
        ? round(color.l * 100, 1)
        : round(
            (space === "oklch" ? color : lab)[d.id] ?? 0,
            d.id === "h" ? 1 : 3,
          );
    for (const id of [`channel-${d.id}`, `value-${d.id}`]) {
      document.getElementById(id).min = String(d.min);
      document.getElementById(id).max = String(d.max);
    }
    $(`#channel-${d.id}`).value = String(value);
    if (document.activeElement !== $(`#value-${d.id}`))
      $(`#value-${d.id}`).value = String(value);
    const samples = Array.from({ length: 13 }, (_, i) =>
      paintValue(channelColor(d.id, d.min + (i / 12) * (d.max - d.min))),
    );
    $(`#channel-${d.id}`).style.background =
      `linear-gradient(to right,${samples.join(",")})`;
  }
  $("#alpha-range").value = String(round(color.alpha * 100, 0));
  if (document.activeElement !== $("#alpha-value"))
    $("#alpha-value").value = String(round(color.alpha * 100, 0));
  const native = cssColor(color);
  $("#color-preview").style.background = native;
  $("#preview-hex").textContent = cssColor(color, "hex");
  $("#color-preview").style.color =
    contrastOn(color, "#fff") > contrastOn(color, "#0b1726")
      ? "#fff"
      : "#0b1726";
  $("#color-input").value = cssColor(color, space);
  $("#color-outputs").innerHTML = [
    ["oklch", "OKLCH"],
    ["oklab", "OKLab"],
    ["hex", "HEX · sRGB"],
    ["rgb", "RGB · sRGB"],
    ["p3", "Display P3"],
  ]
    .map(
      ([format, label]) =>
        `<button class="code-output" data-format="${format}" aria-label="Copy ${label} value"><span>${label}</span><code>${cssColor(color, format)}</code><span class="copy-symbol" aria-hidden="true">⧉</span></button>`,
    )
    .join("");
  const rgb = inColorGamut(color),
    p3 = inColorGamut(color, "p3");
  $("#srgb-flag").classList.toggle("in-gamut", rgb);
  $("#p3-flag").classList.toggle("in-gamut", p3);
  $("#srgb-flag b").textContent = rgb ? "IN" : "OUT";
  $("#p3-flag b").textContent = p3 ? "IN" : "OUT";
  $("#gamut-status").textContent = rgb
    ? "In sRGB"
    : p3
      ? "Display P3 only"
      : "Outside both";
  $("#gamut-description").textContent = rgb
    ? "Within sRGB and Display P3. No gamut mapping is needed."
    : p3
      ? "Outside sRGB, but inside Display P3. A capable display can show more of the original color."
      : "Outside sRGB and Display P3. Both outputs require mapping; your browser also maps the native preview to its display.";
  $("#map-gamut").textContent =
    `Map to ${gamut === "rgb" ? "sRGB" : "Display P3"}`;
  $("#map-gamut").disabled = gamut === "rgb" ? rgb : p3;
  for (const [id, bg] of [
    ["light", "#fff"],
    ["dark", "#0b1726"],
  ]) {
    const ratio = contrastOn(color, bg);
    $(`#contrast-${id}-ratio`).textContent = `${ratio.toFixed(2)}:1`;
    $(`#contrast-${id}-text`).style.color = cssColor(color, "rgb");
    $(`#contrast-${id}-grade`).textContent =
      ratio >= 7
        ? "AAA · normal text"
        : ratio >= 4.5
          ? "AA · normal text"
          : ratio >= 3
            ? "AA · large text only"
            : "Below AA text contrast";
  }
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    drawPlane();
    updatePalette();
  });
}
$("#color-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const next = readColor($("#color-input").value, color.h);
  const error = $("#input-error");
  if (!next) {
    error.hidden = false;
    error.textContent =
      "Enter a supported CSS color. The editable chroma range is 0–0.6.";
    $("#color-input").setAttribute("aria-invalid", "true");
    return;
  }
  error.hidden = true;
  $("#color-input").removeAttribute("aria-invalid");
  color = next;
  update();
});
document.querySelectorAll("[data-space]").forEach((button) =>
  button.addEventListener("click", () => {
    space = button.dataset.space;
    buildControls();
    update();
  }),
);
for (const id of ["alpha-range", "alpha-value"])
  $(`#${id}`).addEventListener("input", (event) => {
    const value = event.target.valueAsNumber;
    if (!Number.isFinite(value)) return;
    color = { ...color, alpha: clamp(value / 100) };
    update();
  });
$("#plane-gamut").addEventListener("change", (event) => {
  gamut = event.target.value;
  update();
});
$("#map-gamut").addEventListener("click", () => {
  color = { ...toLch(mappedColor(color, gamut)), alpha: color.alpha };
  update();
  notify(`Color mapped to ${gamut === "rgb" ? "sRGB" : "Display P3"}.`);
});
$("#color-outputs").addEventListener("click", (event) => {
  const button = event.target.closest("[data-format]");
  if (button) copy(cssColor(color, button.dataset.format));
});
$("#palette-strip").addEventListener("click", (event) => {
  const button = event.target.closest("[data-step]");
  if (button)
    copy(
      makePalette(color, gamut).find(
        (x) => x.step === Number(button.dataset.step),
      ).css,
    );
});
$("#copy-palette").addEventListener("click", () =>
  copy(
    `:root {\n${makePalette(color, gamut)
      .map((x) => `  --color-${x.step}: ${x.css};`)
      .join("\n")}\n}`,
  ),
);
$("#export-json").addEventListener("click", () => {
  const url = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          Object.fromEntries(
            makePalette(color, gamut).map((x) => [
              x.step,
              { css: x.css, hex: x.hex },
            ]),
          ),
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "color-lab-palette.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
for (const id of ["gradient-a", "gradient-b"])
  $(`#${id}`).addEventListener("input", updateGradients);
for (const [button, input] of [
  ["use-start", "gradient-a"],
  ["use-end", "gradient-b"],
])
  $(`#${button}`).addEventListener("click", () => {
    $(`#${input}`).value = cssColor(color);
    updateGradients();
  });
$("#share").addEventListener("click", () => {
  const params = new URLSearchParams({ color: cssColor(color), space });
  const url = `${location.origin}${location.pathname}#${params}`;
  history.replaceState(null, "", url);
  copy(url);
});
$("#reset").addEventListener("click", () => {
  color = readColor("oklch(70% .16 250)");
  space = "oklch";
  gamut = "rgb";
  $("#plane-gamut").value = gamut;
  $("#input-error").hidden = true;
  $("#color-input").removeAttribute("aria-invalid");
  history.replaceState(null, "", location.pathname);
  buildControls();
  update();
  notify("Color reset.");
});
window.addEventListener("hashchange", () => {
  const params = new URLSearchParams(location.hash.slice(1));
  const next = readColor(params.get("color") ?? "", color.h);
  if (next) {
    color = next;
    space = params.get("space") === "oklab" ? "oklab" : "oklch";
    buildControls();
    update();
  }
});
const canvas = $("#color-plane");
let dragging = false;
function pick(event) {
  const bounds = canvas.getBoundingClientRect(),
    x = clamp((event.clientX - bounds.left) / bounds.width),
    y = clamp((event.clientY - bounds.top) / bounds.height);
  color =
    space === "oklch"
      ? {
          ...color,
          h: normalizeHue(x * 360),
          c: (1 - y) * (color.c > 0.4 ? 0.6 : 0.4),
        }
      : {
          ...toLch({
            mode: "oklab",
            l: color.l,
            a: (x * 2 - 1) * planeAxisLimit,
            b: (1 - y * 2) * planeAxisLimit,
          }),
          alpha: color.alpha,
        };
  if (color.c > 0.6) color = { ...color, c: 0.6 };
  update();
}
canvas.addEventListener("pointerdown", (event) => {
  dragging = true;
  canvas.setPointerCapture(event.pointerId);
  pick(event);
});
canvas.addEventListener("pointermove", (event) => {
  if (dragging) pick(event);
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointercancel", () => (dragging = false));
const displayMedia = matchMedia("(color-gamut: p3)");
function displayStatus() {
  $("#display-capability").textContent = displayMedia.matches
    ? "Display reports P3 support"
    : matchMedia("(color-gamut: srgb)").matches
      ? "Display reports sRGB support"
      : "Display gamut not reported";
}
displayMedia.addEventListener("change", displayStatus);
displayStatus();
buildControls();
update();
updateGradients();

$("#channel-controls").addEventListener("focusout", update);
$("#alpha-value").addEventListener("blur", update);
