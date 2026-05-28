// ============================================================================
// PHOTOFILM — shared utilities, real image pipeline, and presentational
// components used by the V1 Darkroom UI.
//
// The pipeline (PRESETS + ops + applyPreset) is a JS mirror of the Python CLI
// in photofilm/presets.py + photofilm/filters.py. Eight built-in looks render
// identically here and in `photofilm` on the command line.
// ============================================================================

// ---------- File-format gates ----------------------------------------------
const RAW_EXT = /\.(cr2|cr3|nef|arw|dng|raf|orf|rw2|pef|srw|crw|x3f|nrw|3fr)$/i;
const IMG_EXT = /\.(jpe?g|png|gif|bmp|tiff?|webp|heic|heif|avif)$/i;

// Pipeline resolutions. Thumb size is what the film strip + LUT shelf use;
// hero is what fills the viewport. Both are tradeoffs between fidelity and
// per-frame compute cost.
const THUMB_MAX = 280;
const HERO_MAX  = 1200;

// Demo photo used until the user drops / pastes / picks one of their own.
const DEMO_PHOTO          = "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1600&q=80";
const DEMO_PHOTO_FALLBACK = "https://picsum.photos/seed/photofilm/1600/1000";

// ============================================================================
// PRESETS — ops chains ported from viewer.html (which in turn mirror
// photofilm/presets.py).
// ============================================================================
const FILM_CURVE = [[0.0, 0.04], [0.25, 0.22], [0.5, 0.5], [0.75, 0.78], [1.0, 0.96]];

// `id` keys the cache + URL. `name` / `sub` / `blurb` drive UI text.
const PRESETS_LIST = [
  {
    id: "provia", name: "PROVIA", sub: "STANDARD",
    blurb: "Balanced daily driver. Restrained, realistic, neutral.",
    ops: [
      ["tone_curve", { points: FILM_CURVE }],
      ["saturation", { amount: 0.10 }],
      ["contrast",   { amount: 0.08 }],
      ["grain",      { amount: 0.25 }],
    ],
  },
  {
    id: "velvia", name: "VELVIA", sub: "VIVID",
    blurb: "Punchy landscape stock with rich greens and blues.",
    ops: [
      ["tone_curve", { points: FILM_CURVE }],
      ["contrast",   { amount: 0.25 }],
      ["saturation", { amount: 0.35 }],
      ["channel_saturation", { reds: 0.25, greens: 0.30, blues: 0.15 }],
      ["grain",      { amount: 0.2 }],
    ],
  },
  {
    id: "astia", name: "ASTIA", sub: "SOFT",
    blurb: "Portrait stock — soft skin, creamy highlights.",
    ops: [
      ["tone_curve",    { points: [[0.0, 0.06], [0.3, 0.30], [0.7, 0.74], [1.0, 0.95]] }],
      ["white_balance", { temp: 0.20, tint: 0.05 }],
      ["saturation",    { amount: 0.05 }],
      ["channel_saturation", { reds: 0.15, greens: -0.10, blues: -0.05 }],
      ["grain",         { amount: 0.2 }],
    ],
  },
  {
    id: "classic-chrome", name: "CLASSIC CHROME", sub: "DOCUMENTARY",
    blurb: "Muted travel-doc tones. Lifted blacks, cyan shadows.",
    ops: [
      ["tone_curve",         { points: FILM_CURVE }],
      ["white_balance",      { temp: 0.15, tint: -0.05 }],
      ["saturation",         { amount: -0.25 }],
      ["channel_saturation", { reds: -0.15, greens: 0.05, blues: 0.10 }],
      ["contrast",           { amount: 0.10 }],
      ["grain",              { amount: 0.4 }],
    ],
  },
  {
    id: "eterna", name: "ETERNA", sub: "CINEMA",
    blurb: "Cinematic flat profile. Soft, expensive, understated.",
    ops: [
      ["tone_curve",    { points: [[0.0, 0.08], [0.5, 0.48], [1.0, 0.88]] }],
      ["saturation",    { amount: -0.30 }],
      ["white_balance", { temp: 0.05, tint: -0.05 }],
      ["contrast",      { amount: -0.10 }],
      ["grain",         { amount: 0.3 }],
    ],
  },
  {
    id: "acros", name: "ACROS", sub: "MONOCHROME",
    blurb: "Silver-halide monochrome with deep, painterly grain.",
    ops: [
      ["monochrome", { red: 0.4, green: 0.4, blue: 0.2 }],
      ["tone_curve", { points: [[0.0, 0.02], [0.3, 0.22], [0.7, 0.80], [1.0, 0.98]] }],
      ["contrast",   { amount: 0.15 }],
      ["grain",      { amount: 0.6 }],
    ],
  },
  {
    id: "synthwave", name: "SYNTHWAVE", sub: "NEON DUSK",
    blurb: "Neon dreams. Magenta bloom and retro-future glow.",
    ops: [
      ["contrast",   { amount: 0.20 }],
      ["tone_curve", { points: [[0.0, 0.08], [0.3, 0.32], [0.7, 0.78], [1.0, 1.0]],  channel: "r" }],
      ["tone_curve", { points: [[0.0, 0.0 ], [0.3, 0.16], [0.7, 0.48], [1.0, 0.82]], channel: "g" }],
      ["tone_curve", { points: [[0.0, 0.28], [0.3, 0.50], [0.7, 0.78], [1.0, 0.95]], channel: "b" }],
      ["saturation", { amount: 0.40 }],
      ["bloom",      { threshold: 0.55, blur_radius: 30.0, amount: 0.55 }],
      ["grain",      { amount: 0.25 }],
    ],
  },
  {
    id: "japan-night", name: "JAPAN NIGHT", sub: "TUNGSTEN",
    blurb: "CineStill 800T tungsten with halation and neon haze.",
    ops: [
      ["tone_curve",         { points: [[0.0, 0.03], [0.25, 0.20], [0.5, 0.48], [0.75, 0.78], [1.0, 0.97]] }],
      ["tone_curve",         { points: [[0.0, 0.02], [0.3, 0.28], [0.7, 0.82], [1.0, 1.0]],  channel: "r" }],
      ["tone_curve",         { points: [[0.0, 0.04], [0.3, 0.24], [0.7, 0.70], [1.0, 0.92]], channel: "g" }],
      ["tone_curve",         { points: [[0.0, 0.10], [0.3, 0.32], [0.7, 0.58], [1.0, 0.80]], channel: "b" }],
      ["saturation",         { amount: -0.10 }],
      ["channel_saturation", { reds: 0.25, greens: -0.10, blues: 0.15 }],
      ["contrast",           { amount: 0.12 }],
      ["bloom",              { threshold: 0.60, blur_radius: 22.0, amount: 0.35 }],
      ["grain",              { amount: 0.35 }],
    ],
  },
  {
    // Imported from 20160910-DSC06091.xmp. Best-effort: matte tone curves,
    // mild WB warmth, global desat, RGB-channel sat shift, grain. Lightroom
    // exposure/highlights/shadows/whites/blacks/clarity, vibrance, HSL hue+
    // lum shifts, and sharpen don't have preset-op equivalents yet — see
    // CLAUDE.md TODO #3 Phase 2.
    id: "vintage-mute", name: "VINTAGE MUTE", sub: "FADED",
    blurb: "Matte-lifted shadows, muted palette, warm tint. Imported from XMP.",
    ops: [
      ["white_balance",      { temp: 0.03, tint: 0.05 }],
      ["contrast",           { amount: 0.06 }],
      ["tone_curve",         { points: [[0, 0.1529], [0.1451, 0.1804], [0.3216, 0.3059], [0.7137, 0.7294], [1.0, 0.9647]] }],
      ["tone_curve",         { points: [[0, 0], [0.2000, 0.1176], [0.5020, 0.5059], [0.6784, 0.7451], [1.0, 1.0]], channel: "r" }],
      ["tone_curve",         { points: [[0, 0], [0.2000, 0.1176], [0.5020, 0.5020], [0.7098, 0.7843], [1.0, 1.0]], channel: "g" }],
      ["tone_curve",         { points: [[0, 0], [0.1804, 0.0824], [0.4824, 0.4706], [0.7216, 0.7843], [1.0, 1.0]], channel: "b" }],
      ["saturation",         { amount: -0.28 }],
      ["channel_saturation", { reds: 0.02, greens: -0.20, blues: -0.40 }],
      ["grain",              { amount: 0.50 }],
    ],
  },
];

const PRESETS = Object.fromEntries(PRESETS_LIST.map((p) => [p.id, p]));
const PRESET_IDS = PRESETS_LIST.map((p) => p.id);

// ============================================================================
// PIPELINE OPS — operate on a flat Float32Array of length n*3 (interleaved
// RGB, values in [0,1]). All ops mutate in place; bloom uses canvas blur and
// returns through buf.
// ============================================================================
const CH = { r: 0, g: 1, b: 2 };

function buildLut(points) {
  const lut = new Float32Array(1024);
  let seg = 0;
  for (let i = 0; i < 1024; i++) {
    const x = i / 1023;
    while (seg < points.length - 2 && x > points[seg + 1][0]) seg++;
    const [x0, y0] = points[seg];
    const [x1, y1] = points[seg + 1];
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    lut[i] = y0 + (y1 - y0) * t;
  }
  return lut;
}

function opToneCurve(buf, n, { points, channel = "rgb" }) {
  const lut = buildLut(points);
  if (channel === "rgb") {
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] < 0 ? 0 : buf[i] > 1 ? 1 : buf[i];
      buf[i] = lut[(v * 1023) | 0];
    }
  } else {
    const c = CH[channel];
    for (let i = 0; i < n; i++) {
      const idx = i * 3 + c;
      const v = buf[idx] < 0 ? 0 : buf[idx] > 1 ? 1 : buf[idx];
      buf[idx] = lut[(v * 1023) | 0];
    }
  }
}

function opWhiteBalance(buf, n, { temp = 0, tint = 0 }) {
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    buf[idx]     += temp * 0.08;
    buf[idx + 2] -= temp * 0.08;
    buf[idx + 1] -= tint * 0.06;
  }
}

function opSaturation(buf, n, { amount = 0 }) {
  const k = 1.0 + amount;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const luma = 0.2126 * buf[idx] + 0.7152 * buf[idx + 1] + 0.0722 * buf[idx + 2];
    buf[idx]     = luma + (buf[idx]     - luma) * k;
    buf[idx + 1] = luma + (buf[idx + 1] - luma) * k;
    buf[idx + 2] = luma + (buf[idx + 2] - luma) * k;
  }
}

function opChannelSaturation(buf, n, { reds = 0, greens = 0, blues = 0 }) {
  const kr = 1.0 + reds, kg = 1.0 + greens, kb = 1.0 + blues;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const luma = 0.2126 * buf[idx] + 0.7152 * buf[idx + 1] + 0.0722 * buf[idx + 2];
    buf[idx]     = luma + (buf[idx]     - luma) * kr;
    buf[idx + 1] = luma + (buf[idx + 1] - luma) * kg;
    buf[idx + 2] = luma + (buf[idx + 2] - luma) * kb;
  }
}

function opContrast(buf, n, { amount = 0 }) {
  const k = 1.0 + amount;
  for (let i = 0; i < buf.length; i++) {
    buf[i] = 0.5 + (buf[i] - 0.5) * k;
  }
}

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function opGrain(buf, n, { amount = 0, seed = 0 }) {
  if (amount <= 0) return;
  const rng = mulberry32(seed || 1);
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const luma = 0.2126 * buf[idx] + 0.7152 * buf[idx + 1] + 0.0722 * buf[idx + 2];
    const weight = 1.0 - Math.abs(luma - 0.5) * 2.0;
    const noise = gaussian(rng) * amount * 0.05 * weight;
    buf[idx]     += noise;
    buf[idx + 1] += noise;
    buf[idx + 2] += noise;
  }
}

function opMonochrome(buf, n, { red = 0.3, green = 0.5, blue = 0.2 }) {
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const v = red * buf[idx] + green * buf[idx + 1] + blue * buf[idx + 2];
    buf[idx] = v; buf[idx + 1] = v; buf[idx + 2] = v;
  }
}

// ---------- Color-space helpers -------------------------------------------
// All three channels in [0,1]; outputs h, s, l in [0,1].
function rgb2hsl(r, g, b) {
  const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
  const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
  const l = (max + min) * 0.5;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if      (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else                h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hsl2rgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2 = (t) => {
    if (t < 0) t += 1; else if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 0.5)   return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue2(h + 1 / 3), hue2(h), hue2(h - 1 / 3)];
}

// ---------- Light-panel ops (user adjustments) ----------------------------
// These run after the preset, sourced from the Light tab. Sliders pass
// integer slider units; the ops scale them into pleasant ranges.

function opExposure(buf, { ev }) {
  if (!ev) return;
  const k = Math.pow(2, ev);
  for (let i = 0; i < buf.length; i++) buf[i] *= k;
}

// Combined highlights/shadows/whites/blacks. All inputs in [-1, +1].
// Positive = brighter in that tonal region (matches Lightroom).
function opLightTone(buf, n, { highlights = 0, shadows = 0, whites = 0, blacks = 0 }) {
  if (!highlights && !shadows && !whites && !blacks) return;
  const hAmt = highlights * 0.35;
  const sAmt = shadows    * 0.35;
  const wAmt = whites     * 0.30;
  const bAmt = blacks     * 0.30;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const luma = 0.2126 * buf[idx] + 0.7152 * buf[idx + 1] + 0.0722 * buf[idx + 2];
    // Soft masks ramped against luma; smoothstep keeps transitions painless.
    const tH = Math.max(0, (luma - 0.5)  * 2.0);  // 0 at 0.5 → 1 at 1.0
    const tS = Math.max(0, (0.5  - luma) * 2.0);  // 0 at 0.5 → 1 at 0.0
    const tW = Math.max(0, (luma - 0.7)  / 0.3);  // 0 at 0.7 → 1 at 1.0
    const tB = Math.max(0, (0.3  - luma) / 0.3);  // 0 at 0.3 → 1 at 0.0
    const mH = tH * tH * (3 - 2 * tH);
    const mS = tS * tS * (3 - 2 * tS);
    const mW = tW * tW * (3 - 2 * tW);
    const mB = tB * tB * (3 - 2 * tB);
    const delta = hAmt * mH + sAmt * mS + wAmt * mW + bAmt * mB;
    buf[idx]     += delta;
    buf[idx + 1] += delta;
    buf[idx + 2] += delta;
  }
}

// Unsharp mask: detail = original - blurred; output = original + amount*detail.
// texture/clarity/dehaze in the Light panel all funnel through here with
// different radii. amount=0 short-circuits — blur is the expensive step.
function opUnsharp(buf, n, width, height, { amount, radius }) {
  if (!amount || radius <= 0) return;
  const tmp = new ImageData(width, height);
  floatToImageData(buf, tmp);
  const src = document.createElement("canvas");
  src.width = width; src.height = height;
  src.getContext("2d").putImageData(tmp, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = width; dst.height = height;
  const dctx = dst.getContext("2d");
  dctx.filter = `blur(${radius}px)`;
  dctx.drawImage(src, 0, 0);
  const blurred = dctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < n; i++) {
    const idx = i * 3, j = i * 4;
    buf[idx]     += amount * (buf[idx]     - blurred[j]     / 255);
    buf[idx + 1] += amount * (buf[idx + 1] - blurred[j + 1] / 255);
    buf[idx + 2] += amount * (buf[idx + 2] - blurred[j + 2] / 255);
  }
}

// ---------- Color-tab ops --------------------------------------------------
// Vibrance: like saturation but biased toward less-saturated pixels. Slider
// in [-1, +1]. At +1, near-grey pixels get a strong push and already-vibrant
// pixels are mostly left alone (which avoids the over-pop look).
function opVibrance(buf, n, { amount = 0 }) {
  if (!amount) return;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
    const maxC = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const minC = r < g ? (r < b ? r : b) : (g < b ? g : b);
    const sat = maxC - minC;
    const k = 1 + amount * (1 - sat);
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    buf[idx]     = luma + (r - luma) * k;
    buf[idx + 1] = luma + (g - luma) * k;
    buf[idx + 2] = luma + (b - luma) * k;
  }
}

// Split toning: tint shadows + highlights with separate hues. shadowSat /
// highlightSat in [-1, +1] (negative just reverses the lift direction);
// balance in [-1, +1] shifts the midpoint between shadow and highlight masks.
function opSplitTone(buf, n, { shadowHue = 0, shadowSat = 0, highlightHue = 0, highlightSat = 0, balance = 0 }) {
  if (!shadowSat && !highlightSat) return;
  const sCol = hsl2rgb((shadowHue    % 360 + 360) % 360 / 360, 1, 0.5);
  const hCol = hsl2rgb((highlightHue % 360 + 360) % 360 / 360, 1, 0.5);
  const mid = 0.5 + balance * 0.5;
  const sStrength = shadowSat    * 0.5;
  const hStrength = highlightSat * 0.5;
  const sDen = mid > 0 ? mid : 1e-3;
  const hDen = (1 - mid) > 0 ? (1 - mid) : 1e-3;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const sT = Math.max(0, mid - luma) / sDen;
    const hT = Math.max(0, luma - mid) / hDen;
    const sM = sT * sT * (3 - 2 * sT) * sStrength;
    const hM = hT * hT * (3 - 2 * hT) * hStrength;
    buf[idx]     = r + (sCol[0] - 0.5) * sM + (hCol[0] - 0.5) * hM;
    buf[idx + 1] = g + (sCol[1] - 0.5) * sM + (hCol[1] - 0.5) * hM;
    buf[idx + 2] = b + (sCol[2] - 0.5) * sM + (hCol[2] - 0.5) * hM;
  }
}

// ---------- HSL-tab op -----------------------------------------------------
// Eight color bands, each with hue/sat/lum offsets in [-1, +1]. We convert
// each pixel to HSL once, sum the weighted contributions across overlapping
// bands (60° half-width smoothstep), and convert back. Near-grey pixels are
// gated out so neutral tones don't drift on big saturation pushes.
const HSL_HUE_CENTERS = {
  red:     0   / 360,
  orange:  30  / 360,
  yellow:  60  / 360,
  green:   120 / 360,
  aqua:    180 / 360,
  blue:    240 / 360,
  purple:  280 / 360,
  magenta: 320 / 360,
};
const HSL_HUE_KEYS = Object.keys(HSL_HUE_CENTERS);

function isHSLAdjustActive(a) {
  if (!a) return false;
  for (const k of HSL_HUE_KEYS) {
    const c = a[k];
    if (c && (c.h || c.s || c.l)) return true;
  }
  return false;
}

function opHSL(buf, n, adj) {
  if (!isHSLAdjustActive(adj)) return;
  const HALF = 60 / 360;
  // Pre-flatten band data into parallel arrays for the inner loop.
  const bands = HSL_HUE_KEYS.map((k) => {
    const a = adj[k] || { h: 0, s: 0, l: 0 };
    return { c: HSL_HUE_CENTERS[k], dh: a.h, ds: a.s, dl: a.l };
  });
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const r = buf[idx], g = buf[idx + 1], b = buf[idx + 2];
    const [h, s, l] = rgb2hsl(r, g, b);
    const satGate = Math.min(1, s * 4);
    if (satGate <= 0) continue;
    let dH = 0, dS = 0, dL = 0;
    for (let j = 0; j < bands.length; j++) {
      const band = bands[j];
      if (!band.dh && !band.ds && !band.dl) continue;
      let d = h - band.c;
      if (d < -0.5) d += 1; else if (d > 0.5) d -= 1;
      d = Math.abs(d);
      if (d >= HALF) continue;
      const t = 1 - d / HALF;
      const w = t * t * (3 - 2 * t);
      dH += band.dh * w;
      dS += band.ds * w;
      dL += band.dl * w;
    }
    // Slider [-1,+1] mappings: hue ±0.1 (~36°), sat ±0.8, lum ±0.4.
    const newH = ((h + dH * 0.1 * satGate) % 1 + 1) % 1;
    const newS = Math.max(0, Math.min(1, s + dS * 0.8 * satGate));
    const newL = Math.max(0, Math.min(1, l + dL * 0.4 * satGate));
    const [nr, ng, nb] = hsl2rgb(newH, newS, newL);
    buf[idx]     = nr;
    buf[idx + 1] = ng;
    buf[idx + 2] = nb;
  }
}

// ---------- Effects-tab ops ------------------------------------------------
// Vignette: p-norm radial mask. roundness in [-1, +1] morphs the shape
// between circle (1) and squircle (4); midpoint and feather control where
// the falloff starts/ends in normalized image-radius units. amount<0 darkens
// corners (the usual look); amount>0 brightens.
function opVignette(buf, n, w, h, { amount = 0, midpoint = 0.5, roundness = 0, feather = 0.5 }) {
  if (!amount) return;
  const cx = w * 0.5, cy = h * 0.5;
  const power = Math.max(1.2, 2 + roundness * 2);
  const startR = midpoint;
  const endR   = midpoint + Math.max(0.05, 1 - midpoint) * feather + 0.05;
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / cy;
    const ady = Math.abs(dy);
    const adyP = Math.pow(ady, power);
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / cx;
      const adxP = Math.pow(Math.abs(dx), power);
      const d = Math.pow(adxP + adyP, 1 / power);
      let mask;
      if (d <= startR)      mask = 0;
      else if (d >= endR)   mask = 1;
      else {
        const t = (d - startR) / (endR - startR);
        mask = t * t * (3 - 2 * t);
      }
      if (!mask) continue;
      const idx = (y * w + x) * 3;
      const delta = amount * mask;
      buf[idx]     += delta;
      buf[idx + 1] += delta;
      buf[idx + 2] += delta;
    }
  }
}

// Sharpen: opUnsharp with masking threshold so flat areas aren't amplified.
// masking in [0, 1] gates the unsharp delta by local contrast; detail in
// [0, 1] adds a second small-radius pass for fine texture.
function opSharpen(buf, n, width, height, { amount = 0, radius = 1.5, detail = 0, masking = 0 }) {
  if (!amount || radius <= 0) return;
  if (!masking && !detail) {
    opUnsharp(buf, n, width, height, { amount, radius });
    return;
  }
  // Bake current buf into a canvas so we can blur it.
  const tmp = new ImageData(width, height);
  floatToImageData(buf, tmp);
  const src = document.createElement("canvas");
  src.width = width; src.height = height;
  src.getContext("2d").putImageData(tmp, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = width; dst.height = height;
  const dctx = dst.getContext("2d");
  dctx.filter = `blur(${radius}px)`;
  dctx.drawImage(src, 0, 0);
  const blurred = dctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < n; i++) {
    const idx = i * 3, j = i * 4;
    const dr = buf[idx]     - blurred[j]     / 255;
    const dg = buf[idx + 1] - blurred[j + 1] / 255;
    const db = buf[idx + 2] - blurred[j + 2] / 255;
    const mag = Math.abs(dr) + Math.abs(dg) + Math.abs(db);
    // edge-mask: at masking=0 everything passes; at masking=1 only strong
    // edges contribute. Curve is intentionally gentle.
    const gate = 1 - masking * (1 - Math.min(1, mag * 6));
    buf[idx]     += amount * dr * gate;
    buf[idx + 1] += amount * dg * gate;
    buf[idx + 2] += amount * db * gate;
  }
  if (detail > 0) {
    // Second pass at a smaller radius brings micro-detail back.
    opUnsharp(buf, n, width, height, { amount: amount * detail * 0.7, radius: Math.max(0.5, radius * 0.3) });
  }
}

// ---------- Adjustment-state defaults / activity checks -------------------
// Light-panel adjustments. Stored in slider units (see ZERO_LIGHT).
const ZERO_LIGHT = {
  exposure: 0, contrast: 0,
  highlights: 0, shadows: 0, whites: 0, blacks: 0,
  texture: 0, clarity: 0, dehaze: 0,
};

const ZERO_COLOR = {
  temp: 0, tint: 0,
  vibrance: 0, saturation: 0,
  shadowHue: 210, shadowSat: 0,
  highlightHue: 40, highlightSat: 0,
  balance: 0,
};

const ZERO_HSL = Object.fromEntries(HSL_HUE_KEYS.map((k) => [k, { h: 0, s: 0, l: 0 }]));

// Curves: points in [0,1] in increasing x order. Identity is [[0,0],[1,1]].
const IDENTITY_CURVE = [[0, 0], [1, 1]];
const ZERO_CURVES = {
  rgb: IDENTITY_CURVE.map((p) => [...p]),
  r:   IDENTITY_CURVE.map((p) => [...p]),
  g:   IDENTITY_CURVE.map((p) => [...p]),
  b:   IDENTITY_CURVE.map((p) => [...p]),
};

const ZERO_EFFECTS = {
  grainAmount: 0, grainSize: 50, grainRoughness: 30,
  vignetteAmount: 0, vignetteMidpoint: 50, vignetteRoundness: 0, vignetteFeather: 50,
  sharpenAmount: 0, sharpenRadius: 10, sharpenDetail: 25, sharpenMasking: 0,
};

function isLightAdjustActive(a) {
  if (!a) return false;
  for (const k in ZERO_LIGHT) if (a[k]) return true;
  return false;
}

function isColorAdjustActive(a) {
  if (!a) return false;
  return !!(a.temp || a.tint || a.vibrance || a.saturation || a.shadowSat || a.highlightSat);
}

function isCurveIdentity(points) {
  if (!points || points.length !== 2) return points && points.length > 2 ? false : true;
  return points[0][0] === 0 && points[0][1] === 0 && points[1][0] === 1 && points[1][1] === 1;
}

function isCurvesAdjustActive(a) {
  if (!a) return false;
  return !isCurveIdentity(a.rgb) || !isCurveIdentity(a.r) || !isCurveIdentity(a.g) || !isCurveIdentity(a.b);
}

function isEffectsAdjustActive(a) {
  if (!a) return false;
  return !!(a.grainAmount || a.vignetteAmount || a.sharpenAmount);
}

function isUserAdjustActive(u) {
  if (!u) return false;
  return isLightAdjustActive(u.light)
      || isColorAdjustActive(u.color)
      || isHSLAdjustActive(u.hsl)
      || isCurvesAdjustActive(u.curves)
      || isEffectsAdjustActive(u.effects);
}

// Run all user adjustments after the preset, in Lightroom-ish order:
// WB → exposure/contrast → tonal regions → presence → curves → HSL → vibrance/
// saturation → split tone → sharpen → vignette → grain. One buffer round-trip.
function applyUserAdjustments(imageData, width, height, u) {
  if (!isUserAdjustActive(u)) return imageData;
  const out = new ImageData(new Uint8ClampedArray(imageData.data), width, height);
  const buf = imageDataToFloat(out);
  const n = width * height;
  const L = u.light, C = u.color, H = u.hsl, CV = u.curves, FX = u.effects;

  if (C) {
    if (C.temp || C.tint) opWhiteBalance(buf, n, { temp: C.temp / 100, tint: C.tint / 100 });
  }
  if (L) {
    if (L.exposure) opExposure(buf, { ev: L.exposure / 10 });
    if (L.contrast) opContrast(buf, n, { amount: L.contrast / 100 });
    opLightTone(buf, n, {
      highlights: L.highlights / 100,
      shadows:    L.shadows    / 100,
      whites:     L.whites     / 100,
      blacks:     L.blacks     / 100,
    });
    if (L.texture) opUnsharp(buf, n, width, height, { amount: L.texture / 100, radius: 2  });
    if (L.clarity) opUnsharp(buf, n, width, height, { amount: L.clarity / 100, radius: 15 });
    if (L.dehaze)  opUnsharp(buf, n, width, height, { amount: L.dehaze  / 100, radius: 45 });
  }
  if (CV) {
    if (!isCurveIdentity(CV.rgb)) opToneCurve(buf, n, { points: CV.rgb, channel: "rgb" });
    if (!isCurveIdentity(CV.r))   opToneCurve(buf, n, { points: CV.r,   channel: "r"   });
    if (!isCurveIdentity(CV.g))   opToneCurve(buf, n, { points: CV.g,   channel: "g"   });
    if (!isCurveIdentity(CV.b))   opToneCurve(buf, n, { points: CV.b,   channel: "b"   });
  }
  if (H) opHSL(buf, n, H);
  if (C) {
    if (C.vibrance)   opVibrance(buf, n, { amount: C.vibrance / 100 });
    if (C.saturation) opSaturation(buf, n, { amount: C.saturation / 100 });
    if (C.shadowSat || C.highlightSat) {
      opSplitTone(buf, n, {
        shadowHue: C.shadowHue, shadowSat: C.shadowSat / 100,
        highlightHue: C.highlightHue, highlightSat: C.highlightSat / 100,
        balance: C.balance / 100,
      });
    }
  }
  if (FX) {
    if (FX.sharpenAmount) {
      opSharpen(buf, n, width, height, {
        amount: FX.sharpenAmount / 100,
        radius: Math.max(0.3, FX.sharpenRadius / 10),
        detail: FX.sharpenDetail / 100,
        masking: FX.sharpenMasking / 100,
      });
    }
    if (FX.vignetteAmount) {
      opVignette(buf, n, width, height, {
        amount: FX.vignetteAmount / 100,
        midpoint: FX.vignetteMidpoint / 100,
        roundness: FX.vignetteRoundness / 100,
        feather: FX.vignetteFeather / 100,
      });
    }
    if (FX.grainAmount) {
      // Size shrinks the per-pixel scale; roughness boosts variance.
      opGrain(buf, n, {
        amount: (FX.grainAmount / 100) * (1 + FX.grainRoughness / 200),
        seed: 17 + ((FX.grainSize | 0) * 7),
      });
    }
  }
  floatToImageData(buf, out);
  return out;
}

// Back-compat shim so older callers that pass only a light slice still work.
function applyLightAdjust(imageData, width, height, lightAdjust) {
  return applyUserAdjustments(imageData, width, height, { light: lightAdjust });
}

function opBloom(buf, n, width, height, { threshold = 0.6, blur_radius = 20.0, amount = 0.5 }) {
  if (amount <= 0) return;
  const denom = Math.max(1e-3, 1.0 - threshold);
  const brightImg = new ImageData(width, height);
  const bd = brightImg.data;
  for (let i = 0; i < n; i++) {
    const idx = i * 3;
    const luma = 0.2126 * buf[idx] + 0.7152 * buf[idx + 1] + 0.0722 * buf[idx + 2];
    let mask = (luma - threshold) / denom;
    if (mask < 0) mask = 0; else if (mask > 1) mask = 1;
    const j = i * 4;
    bd[j]     = Math.min(255, Math.max(0, buf[idx]     * mask * 255));
    bd[j + 1] = Math.min(255, Math.max(0, buf[idx + 1] * mask * 255));
    bd[j + 2] = Math.min(255, Math.max(0, buf[idx + 2] * mask * 255));
    bd[j + 3] = 255;
  }
  const src = document.createElement("canvas");
  src.width = width; src.height = height;
  src.getContext("2d").putImageData(brightImg, 0, 0);
  const dst = document.createElement("canvas");
  dst.width = width; dst.height = height;
  const dctx = dst.getContext("2d");
  dctx.filter = `blur(${blur_radius}px)`;
  dctx.drawImage(src, 0, 0);
  const blurred = dctx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < n; i++) {
    const idx = i * 3, j = i * 4;
    const br = (blurred[j]     / 255) * amount;
    const bg = (blurred[j + 1] / 255) * amount;
    const bb = (blurred[j + 2] / 255) * amount;
    buf[idx]     = 1.0 - (1.0 - buf[idx])     * (1.0 - br);
    buf[idx + 1] = 1.0 - (1.0 - buf[idx + 1]) * (1.0 - bg);
    buf[idx + 2] = 1.0 - (1.0 - buf[idx + 2]) * (1.0 - bb);
  }
}

function imageDataToFloat(imageData) {
  const src = imageData.data;
  const n = src.length / 4;
  const buf = new Float32Array(n * 3);
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    buf[i * 3]     = src[j]     / 255;
    buf[i * 3 + 1] = src[j + 1] / 255;
    buf[i * 3 + 2] = src[j + 2] / 255;
  }
  return buf;
}

function floatToImageData(buf, imageData) {
  const dst = imageData.data;
  const n = buf.length / 3;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    let r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    if (r < 0) r = 0; else if (r > 1) r = 1;
    if (g < 0) g = 0; else if (g > 1) g = 1;
    if (b < 0) b = 0; else if (b > 1) b = 1;
    dst[j]     = (r * 255) | 0;
    dst[j + 1] = (g * 255) | 0;
    dst[j + 2] = (b * 255) | 0;
    dst[j + 3] = 255;
  }
}

function applyPreset(srcImageData, presetId, width, height) {
  const preset = PRESETS[presetId];
  if (!preset) return srcImageData;
  const out = new ImageData(new Uint8ClampedArray(srcImageData.data), width, height);
  const buf = imageDataToFloat(out);
  const n = width * height;
  for (const [op, args] of preset.ops) {
    switch (op) {
      case "tone_curve":         opToneCurve(buf, n, args); break;
      case "white_balance":      opWhiteBalance(buf, n, args); break;
      case "saturation":         opSaturation(buf, n, args); break;
      case "channel_saturation": opChannelSaturation(buf, n, args); break;
      case "contrast":           opContrast(buf, n, args); break;
      case "grain":              opGrain(buf, n, { ...args, seed: 42 }); break;
      case "monochrome":         opMonochrome(buf, n, args); break;
      case "bloom":              opBloom(buf, n, width, height, args); break;
    }
  }
  floatToImageData(buf, out);
  return out;
}

// ============================================================================
// IMAGE LOADING — drag/paste/picker entry point. Decodes blobs into canvases
// with EXIF orientation baked in (so a portrait photo reads as portrait
// pixels). RAW files are scanned for an embedded JPEG preview.
// ============================================================================
function isLoadableImage(file) {
  if (file.type && file.type.startsWith("image/")) return true;
  return RAW_EXT.test(file.name) || IMG_EXT.test(file.name);
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function loadOrientedCanvas(blob) {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    c.getContext("2d").drawImage(bitmap, 0, 0);
    bitmap.close && bitmap.close();
    return c;
  } catch (e) {
    const img = await loadImageFromBlob(blob);
    const c = document.createElement("canvas");
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  }
}

// Walk JPEG markers starting at SOI; return the Start-Of-Frame marker byte.
// Used to reject Canon CR2's raw sensor data (SOF3 lossless JPEG, not
// browser-decodable).
function jpegSofMarker(bytes, start) {
  let i = start;
  if (bytes[i] !== 0xFF || bytes[i + 1] !== 0xD8) return null;
  i += 2;
  const end = bytes.length - 1;
  while (i < end) {
    if (bytes[i] !== 0xFF) return null;
    while (i < end && bytes[i] === 0xFF) i++;
    const marker = bytes[i++];
    if (marker === 0xD9 || marker === 0xDA) return marker;
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) continue;
    if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
      return marker;
    }
    if (i + 1 >= bytes.length) return null;
    const length = (bytes[i] << 8) | bytes[i + 1];
    i += length;
  }
  return null;
}

function isBrowserDecodableSof(marker) {
  return marker === 0xC0 || marker === 0xC1 || marker === 0xC2;
}

function findLargestJpeg(bytes) {
  const n = bytes.length;
  let bestStart = -1, bestLen = 0;
  let i = 0;
  while (i < n - 3) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD8 && bytes[i + 2] === 0xFF) {
      const limit = Math.min(n - 1, i + 64 * 1024 * 1024);
      let j = i + 3, end = -1;
      while (j < limit) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) { end = j + 2; break; }
        j++;
      }
      if (end > 0) {
        const len = end - i;
        if (len > bestLen && isBrowserDecodableSof(jpegSofMarker(bytes, i))) {
          bestStart = i; bestLen = len;
        }
        i = end;
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  if (bestStart < 0) return null;
  return { start: bestStart, length: bestLen };
}

async function extractEmbeddedJpeg(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const found = findLargestJpeg(bytes);
  if (!found) return null;
  return new Blob([bytes.slice(found.start, found.start + found.length)], { type: "image/jpeg" });
}

function downscaleToImageData(srcCanvas, maxEdge) {
  const sw = srcCanvas.width, sh = srcCanvas.height;
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h), w, h };
}

// ============================================================================
// EDIT BAKERS — pure functions that consume a source canvas and return a new
// canvas. Same algorithms as viewer.html; lifted out of module state.
// ============================================================================

// Largest axis-aligned rectangle that fits inside a WxH rectangle rotated by
// `angleRad`. Used to auto-crop the empty triangular corners after rotation.
function inscribedRect(w, h, angleRad) {
  const a = Math.abs(angleRad) % (Math.PI / 2);
  const sinA = Math.sin(a), cosA = Math.cos(a);
  const widthLonger = w >= h;
  const longSide  = widthLonger ? w : h;
  const shortSide = widthLonger ? h : w;
  let wr, hr;
  if (shortSide <= 2 * sinA * cosA * longSide || Math.abs(sinA - cosA) < 1e-10) {
    const x = 0.5 * shortSide;
    wr = widthLonger ? x / sinA : x / cosA;
    hr = widthLonger ? x / cosA : x / sinA;
  } else {
    const cos2A = cosA * cosA - sinA * sinA;
    wr = (w * cosA - h * sinA) / cos2A;
    hr = (h * cosA - w * sinA) / cos2A;
  }
  return { w: Math.max(1, wr), h: Math.max(1, hr) };
}

// crop = {x, y, w, h} in [0,1] source fractions
function bakeCrop(src, crop) {
  const sx = Math.max(0, Math.round(crop.x * src.width));
  const sy = Math.max(0, Math.round(crop.y * src.height));
  const sw = Math.max(1, Math.min(src.width  - sx, Math.round(crop.w * src.width)));
  const sh = Math.max(1, Math.min(src.height - sy, Math.round(crop.h * src.height)));
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  c.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

function bakeRotate(src, angleDeg) {
  if (Math.abs(angleDeg) < 0.01) return src;
  const angle = angleDeg * Math.PI / 180;
  const ins = inscribedRect(src.width, src.height, angle);
  const w = Math.max(1, Math.round(ins.w));
  const h = Math.max(1, Math.round(ins.h));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

function bakeQuarterTurn(src, deg) {
  const c = document.createElement("canvas");
  // ±90° swaps dims; 180° doesn't.
  if (Math.abs(deg) === 90) { c.width = src.height; c.height = src.width; }
  else                      { c.width = src.width;  c.height = src.height; }
  const ctx = c.getContext("2d");
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(deg * Math.PI / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
}

function bakeFlip(src, axis) {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext("2d");
  if (axis === "h") { ctx.translate(src.width, 0); ctx.scale(-1, 1); }
  else              { ctx.translate(0, src.height); ctx.scale(1, -1); }
  ctx.drawImage(src, 0, 0);
  return c;
}

// Composite transform — keystone (vertical+horizontal), rotation, scale, and
// pan offset, all baked in one pass on top of the source canvas. Used by the
// Crop tab's PERSPECTIVE section. The output canvas matches the source size;
// empty pixels stay black.
function bakeTransform(src, t) {
  const v   = t.vertical   || 0;
  const h   = t.horizontal || 0;
  const rot = (t.rotateDeg || 0) * Math.PI / 180;
  const s   = t.scale  || 0;   // -1..+1
  const ox  = t.offsetX || 0;  // normalized to width
  const oy  = t.offsetY || 0;  // normalized to height
  if (!v && !h && !rot && !s && !ox && !oy) return src;
  const sw = src.width, sh = src.height;
  const out = document.createElement("canvas");
  out.width = sw; out.height = sh;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, sw, sh);

  // Translate the keystone-bearing source through a strip composite, then
  // rotate / scale / offset the whole thing on top. That ordering matches the
  // mental model of "warp the image, then frame it."
  const keystoneNeeded = Math.abs(v) > 0.001 || Math.abs(h) > 0.001;
  const keyCanvas = keystoneNeeded ? document.createElement("canvas") : src;
  if (keystoneNeeded) {
    keyCanvas.width = sw; keyCanvas.height = sh;
    const kctx = keyCanvas.getContext("2d");
    kctx.imageSmoothingQuality = "high";
    const maxScale = 1 + Math.max(Math.abs(v), Math.abs(h));
    const baseScale = 1 / maxScale;
    // Vertical keystone: width varies along Y. Horizontal keystone: height
    // varies along X. We composite once per axis; if both are set, vertical
    // happens first (to a temp), then horizontal on the result.
    const verticalPass = (srcCanvas, dstCtx) => {
      const strips = Math.max(150, Math.min(400, Math.round(sh / 4)));
      for (let i = 0; i < strips; i++) {
        const t2 = i / (strips - 1);
        const sy = i * sh / strips;
        const shStrip = sh / strips + 1;
        const stripScale = baseScale * (1 + v * (2 * t2 - 1));
        const dw = sw * stripScale;
        const dx = (sw - dw) / 2;
        const dy = i * sh / strips;
        const dh = sh / strips + 1;
        dstCtx.drawImage(srcCanvas, 0, sy, sw, shStrip, dx, dy, dw, dh);
      }
    };
    const horizontalPass = (srcCanvas, dstCtx) => {
      const strips = Math.max(150, Math.min(400, Math.round(sw / 4)));
      for (let i = 0; i < strips; i++) {
        const t2 = i / (strips - 1);
        const sxs = i * sw / strips;
        const swStrip = sw / strips + 1;
        const stripScale = baseScale * (1 + h * (2 * t2 - 1));
        const dh = sh * stripScale;
        const dy = (sh - dh) / 2;
        const dx = i * sw / strips;
        const dw = sw / strips + 1;
        dstCtx.drawImage(srcCanvas, sxs, 0, swStrip, sh, dx, dy, dw, dh);
      }
    };
    if (Math.abs(v) > 0.001 && Math.abs(h) > 0.001) {
      const mid = document.createElement("canvas");
      mid.width = sw; mid.height = sh;
      verticalPass(src, mid.getContext("2d"));
      kctx.fillStyle = "#000"; kctx.fillRect(0, 0, sw, sh);
      horizontalPass(mid, kctx);
    } else if (Math.abs(v) > 0.001) {
      verticalPass(src, kctx);
    } else {
      horizontalPass(src, kctx);
    }
  }

  // Final framing: rotate, scale, offset. The "scale" slider zooms in on the
  // image (positive) or out (negative); offsets pan in normalized units.
  const zoom = Math.pow(2, s);  // s=0 → 1.0, s=1 → 2.0, s=-1 → 0.5
  ctx.save();
  ctx.translate(sw / 2 + ox * sw, sh / 2 + oy * sh);
  ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.drawImage(keyCanvas, -sw / 2, -sh / 2);
  ctx.restore();
  return out;
}

// amount in [-0.5, 0.5]. Positive = top wider than bottom (correct converging
// verticals when shooting up at a building).
function bakePerspective(src, amount) {
  if (Math.abs(amount) < 0.01) return src;
  const sw = src.width, sh = src.height;
  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const maxScale = 1 + Math.abs(amount);
  const baseScale = 1 / maxScale;
  // Strip count scales with source height — keeps banding artifacts subtle on
  // tall photos without blowing compute on small ones.
  const strips = Math.max(150, Math.min(400, Math.round(sh / 4)));
  for (let i = 0; i < strips; i++) {
    const t = i / (strips - 1);
    const sy = i * sh / strips;
    const shStrip = sh / strips + 1;
    const stripScale = baseScale * (1 + amount * (2 * t - 1));
    const dw = sw * stripScale;
    const dx = (sw - dw) / 2;
    const dy = i * sh / strips;
    const dh = sh / strips + 1;
    ctx.drawImage(src, 0, sy, sw, shStrip, dx, dy, dw, dh);
  }
  return c;
}

// ============================================================================
// PRESENTATIONAL COMPONENTS
// ============================================================================

// ---------- Logo: aperture iris + wordmark ---------------------------------
function PhotofilmLogo({ size = 22, color = "currentColor", showWord = true, font = "inherit", weight = 600, tracking = "0.02em" }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color, lineHeight: 1 }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <circle cx="16" cy="16" r="14" stroke={color} strokeWidth="1.5" />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <path
            key={deg}
            d="M 16 16 L 16 4 L 26.4 10"
            stroke={color} strokeWidth="1.5"
            strokeLinejoin="round" fill="none"
            transform={`rotate(${deg} 16 16)`} opacity="0.85"
          />
        ))}
        <circle cx="16" cy="16" r="2.2" fill={color} />
      </svg>
      {showWord && (
        <span style={{ fontFamily: font, fontWeight: weight, letterSpacing: tracking, fontSize: size * 0.78 }}>
          photofilm
        </span>
      )}
    </span>
  );
}

// ---------- Histogram: derived from a real ImageData when one is provided;
// otherwise renders a plausible fake (used in the design preview only). -----
function Histogram({ imageData, width = 180, height = 48 }) {
  const points = React.useMemo(() => {
    const n = 64;
    if (!imageData) {
      // Two-bump fake so the design renders before a photo is loaded.
      const arr = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        arr.push({
          r: Math.exp(-Math.pow((t - 0.45) * 4, 2)) * 0.9,
          g: Math.exp(-Math.pow((t - 0.50) * 4, 2)) * 0.85,
          b: Math.exp(-Math.pow((t - 0.55) * 4, 2)) * 0.8,
        });
      }
      return arr;
    }
    // Real histogram: 64-bucket per-channel count.
    const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n);
    const data = imageData.data;
    const px = data.length / 4;
    for (let i = 0, j = 0; i < px; i++, j += 4) {
      r[Math.min(n - 1, (data[j]     * n / 256) | 0)]++;
      g[Math.min(n - 1, (data[j + 1] * n / 256) | 0)]++;
      b[Math.min(n - 1, (data[j + 2] * n / 256) | 0)]++;
    }
    let max = 0;
    for (let i = 0; i < n; i++) {
      if (r[i] > max) max = r[i];
      if (g[i] > max) max = g[i];
      if (b[i] > max) max = b[i];
    }
    if (max === 0) max = 1;
    const arr = [];
    for (let i = 0; i < n; i++) arr.push({ r: r[i] / max, g: g[i] / max, b: b[i] / max });
    return arr;
  }, [imageData]);

  const buildPath = (key) => {
    const n = points.length;
    let d = `M 0 ${height} `;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * width;
      const y = height - points[i][key] * height * 0.92;
      d += `L ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    d += `L ${width} ${height} Z`;
    return d;
  };

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <path d={buildPath("r")} fill="#e74c3c" opacity="0.55" />
      <path d={buildPath("g")} fill="#27ae60" opacity="0.55" />
      <path d={buildPath("b")} fill="#3498db" opacity="0.55" />
    </svg>
  );
}

// ---------- Slider: visual only — the design uses these for many controls.
// Values are display-only; the controlled ones (strength, rotate, perspective)
// have their own purpose-built sliders in the relevant tabs. ---------------
function Slider({ label, value, unit = "", min = -100, max = 100, color = "#fff", trackBg = "rgba(255,255,255,0.08)", labelStyle = {}, valueStyle = {}, onChange, format }) {
  const trackRef = React.useRef(null);
  const pct = ((value - min) / (max - min)) * 100;
  const mid = ((0 - min) / (max - min)) * 100;

  const startDrag = React.useCallback((e) => {
    if (!onChange) return;
    const track = trackRef.current;
    if (!track) return;
    e.preventDefault();
    const update = (clientX) => {
      const r = track.getBoundingClientRect();
      const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      const v = min + f * (max - min);
      onChange(Math.round(v));
    };
    update(e.clientX);
    const move = (ev) => update(ev.clientX);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [onChange, min, max]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, ...labelStyle }}>
        <span>{label}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", opacity: 0.7, ...valueStyle }}>
          {format ? format(value) : `${value > 0 ? "+" : ""}${value}${unit}`}
        </span>
      </div>
      <div
        ref={trackRef}
        onMouseDown={startDrag}
        style={{ position: "relative", height: 4, background: trackBg, borderRadius: 2, cursor: onChange ? "pointer" : "default" }}
      >
        <div style={{ position: "absolute", left: `${mid}%`, top: -2, bottom: -2, width: 1, background: "rgba(255,255,255,0.15)" }} />
        <div style={{
          position: "absolute", top: 0, bottom: 0,
          left: `${Math.min(pct, mid)}%`, width: `${Math.abs(pct - mid)}%`,
          background: color, borderRadius: 2,
        }} />
        <div style={{
          position: "absolute", top: "50%", left: `${pct}%`,
          transform: "translate(-50%, -50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: color, boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
        }} />
      </div>
    </div>
  );
}

// ---------- FilteredPhoto: renders a presetId applied to either a source
// ImageData (real pipeline) or a URL with CSS filter fallback (used by stub
// UI elements that don't have a sourceCanvas yet). Memoizes via a per-photo
// cache keyed by presetId so the same thumb isn't recomputed on every render.
// --------------------------------------------------------------------------
function FilteredPhoto({ sourceData, sourceW, sourceH, cache, presetId, intensity = 1, userAdjust, style = {}, className = "", objectFit = "contain", fallbackUrl = DEMO_PHOTO, fallbackFilter = "" }) {
  const canvasRef = React.useRef(null);

  React.useEffect(() => {
    if (!sourceData) return;
    let cancelled = false;
    // Yield a frame so initial paint can finish before the (potentially
    // heavy) pipeline run blocks the main thread.
    requestAnimationFrame(() => {
      if (cancelled) return;
      let filtered = cache && cache.get(presetId);
      if (!filtered) {
        filtered = applyPreset(sourceData, presetId, sourceW, sourceH);
        if (cache) cache.set(presetId, filtered);
      }
      if (cancelled) return;
      // Apply user adjustments on top — never mutate the cached preset output.
      const display = isUserAdjustActive(userAdjust)
        ? applyUserAdjustments(filtered, sourceW, sourceH, userAdjust)
        : filtered;
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = sourceW; canvas.height = sourceH;
      canvas.getContext("2d").putImageData(display, 0, 0);
    });
    return () => { cancelled = true; };
  }, [sourceData, sourceW, sourceH, presetId, cache, userAdjust]);

  // object-fit on a <canvas> uses the canvas's bitmap as the "object" and the
  // CSS box as the "container" — `contain` preserves aspect on the hero, and
  // `cover` center-crops on the square thumb strip.
  const canvasStyle = {
    position: "absolute", inset: 0,
    width: "100%", height: "100%",
    display: "block", objectFit,
  };

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden", background: "#111", ...style }}>
      {sourceData ? (
        <>
          <OriginalCanvas sourceData={sourceData} sourceW={sourceW} sourceH={sourceH} style={canvasStyle} />
          <canvas ref={canvasRef} style={{ ...canvasStyle, opacity: intensity }} />
        </>
      ) : (
        <img
          src={fallbackUrl}
          alt=""
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit, filter: fallbackFilter, display: "block" }}
          onError={(e) => { e.currentTarget.src = DEMO_PHOTO_FALLBACK; }}
          draggable="false"
        />
      )}
    </div>
  );
}

// Cheap dedicated canvas for the unfiltered source — drawn under the filtered
// overlay so intensity blending works without recomputing the original.
function OriginalCanvas({ sourceData, sourceW, sourceH, style }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const c = ref.current;
    if (!c || !sourceData) return;
    c.width = sourceW; c.height = sourceH;
    c.getContext("2d").putImageData(sourceData, 0, 0);
  }, [sourceData, sourceW, sourceH]);
  return <canvas ref={ref} style={style} />;
}

// ----------------------------------------------------------------------------
// Phase 1 of the "filters as JSON" plan (see CLAUDE.md TODOs): dump the
// current editor state as a portable spec the user can share. Not yet a
// runnable preset — Claude / a human authors the ops chain from this.
// ----------------------------------------------------------------------------
function serializeUserEdits({ baselinePreset, intensity, sourceName, userAdjust }) {
  return {
    schemaVersion: 1,
    savedAt: new Date().toISOString(),
    baselinePreset: baselinePreset || null,
    intensity: typeof intensity === "number" ? intensity : null,
    sourceName: sourceName || null,
    userAdjust: userAdjust || null,
  };
}

// ============================================================================
Object.assign(window, {
  // file-format
  RAW_EXT, IMG_EXT, THUMB_MAX, HERO_MAX,
  DEMO_PHOTO, DEMO_PHOTO_FALLBACK,
  // presets
  PRESETS, PRESETS_LIST, PRESET_IDS, FILM_CURVE,
  serializeUserEdits,
  // pipeline
  applyPreset, imageDataToFloat, floatToImageData,
  opToneCurve, opWhiteBalance, opSaturation, opChannelSaturation,
  opContrast, opGrain, opMonochrome, opBloom,
  opExposure, opLightTone, opUnsharp,
  opVibrance, opSplitTone, opVignette, opSharpen, opHSL,
  rgb2hsl, hsl2rgb,
  applyUserAdjustments, isUserAdjustActive,
  applyLightAdjust, isLightAdjustActive,
  isColorAdjustActive, isHSLAdjustActive, isCurvesAdjustActive, isEffectsAdjustActive,
  ZERO_LIGHT, ZERO_COLOR, ZERO_HSL, ZERO_CURVES, ZERO_EFFECTS,
  HSL_HUE_KEYS, HSL_HUE_CENTERS,
  isCurveIdentity, IDENTITY_CURVE,
  // loaders
  isLoadableImage, loadImageFromBlob, loadOrientedCanvas,
  extractEmbeddedJpeg, downscaleToImageData,
  // edits
  inscribedRect, bakeCrop, bakeRotate, bakeQuarterTurn, bakeFlip, bakePerspective, bakeTransform,
  // components
  PhotofilmLogo, Histogram, Slider, FilteredPhoto,
});
