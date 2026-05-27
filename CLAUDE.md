# photofilm — repo notes for Claude

photofilm is a photo editor that applies Fujifilm-inspired film simulations.
Two surfaces:

- **CLI** — `photofilm/` Python package, `pyproject.toml`, `.venv/`. Authoritative
  pipeline implementation (lives in `photofilm/filters.py` and `photofilm/presets.py`).
- **Browser app** — `index.html` + `pipeline.jsx` + `app.jsx` + `tabs.jsx`.
  React + Babel-in-browser; no build step. JS port of the Python pipeline so
  outputs match what the CLI produces. Open via a local server (`python -m
  http.server 8000`, then http://localhost:8000/). The legacy `viewer.html`
  is a self-contained earlier version of the same app; keep it around as a
  fallback.

## Browser app architecture

```
index.html        # mounts <PhotofilmRoot />, loads the .jsx files
├─ pipeline.jsx   # presets, pipeline ops, image loading, edit bakers,
│                 # PhotofilmLogo, Histogram, Slider, FilteredPhoto
├─ tabs.jsx       # the 8 side-rail tab bodies
└─ app.jsx        # Darkroom shell + PhotofilmProvider + PhotofilmRoot
                  #   + EditPreview (live rotate/perspective preview)
                  #   + GlobalInputs (drag/paste/keyboard)
                  #   + DragOverlay
```

State flows through `PhotofilmContext` (in app.jsx). Tab bodies pull what
they need via `usePhotofilm()`.

## What's functional vs. stub

### Functional (real pipeline)
- **Film strip** — clicking a thumbnail sets the active preset; the hero
  re-renders with that preset applied. Eight built-in presets match the CLI.
- **Strength slider** — 0–100 % intensity blend between original and filtered.
- **Histogram overlay** — derived from the hero ImageData, RGB.
- **EXIF chip** — real source dimensions + active preset + intensity.
- **Open / drag-drop / paste** — supports JPEG/PNG/WebP/HEIC + RAW (CR2/NEF/
  ARW/DNG/RAF/etc) by extracting the embedded JPEG preview.
- **Crop tab — Aspect** — 1:1, 4:5, 5:4, 3:2, 2:3, 16:9, 9:16 buttons apply a
  centered crop immediately.
- **Crop tab — 90° rotate / flip H/V** — instant.
- **Crop tab — Straighten** — ruler controls a pending rotation angle (-45° to
  +45°); hero shows a live raw preview with the inscribed crop applied; Apply
  button bakes it into `sourceCanvas`.
- **Crop tab — Perspective Vertical** — slider controls a pending keystone
  amount (-0.5 to +0.5); hero shows a live raw preview; Apply bakes.
- **Hold to compare** — temporarily renders intensity = 0.
- **Keyboard** — ←/→ step presets; Space toggles active preset in export set.
- **Export tab** — JPEG/PNG/WebP, quality slider, optional long-edge cap
  (FULL / 2048 / 1080 / 720), per-preset checkbox list; downloads each
  selected preset as a separate file. Falls back to active preset if nothing
  is checked.

### Stub (visual only — TODOs below)
- **Light tab** — Exposure / Contrast / Highlights / Shadows / Whites /
  Blacks / Texture / Clarity / Dehaze sliders. None apply.
- **Color tab** — White-balance presets, Temperature/Tint sliders, Vibrance/
  Saturation, Split-toning hue/sat cards.
- **HSL tab** — 8-color × (Hue, Saturation, Luminance) mixer.
- **Curves tab** — RGB / per-channel curve editor + curve presets.
- **Effects tab** — Grain, Vignette, Sharpen, Noise reduction. Note: grain is
  partially exposed via the per-preset `grain` op, but there's no standalone
  user-facing control yet.
- **LUT tab** — `.cube` drop zone, intensity, shelf. The CLI supports `--lut
  path/to/x.cube` (see `photofilm/lut.py`); the browser doesn't load `.cube`
  files yet.
- **Crop tab — FREE aspect / ORIGINAL** — placeholder buttons; need an
  interactive crop overlay with draggable handles.
- **Crop tab — Perspective Horizontal / Rotate / Scale / X-Offset / Y-Offset
  sliders** — visual only. Pipeline only supports the vertical keystone.

## TODOs to make the stubs real

### High-value, partly-supported by CLI pipeline
1. **Effects → Grain** — `opGrain` already exists in `pipeline.jsx`. Add a
   user-controlled grain amount that's applied *after* the preset's own
   grain, and wire it to the slider.
2. **Effects → Vignette** — not in pipeline. Add `opVignette({amount,
   midpoint, roundness, feather})` to both `pipeline.jsx` (browser) and
   `photofilm/filters.py` (CLI). Simple radial mask.
3. **Color → White balance** — `opWhiteBalance({temp, tint})` already exists.
   Surface it as a user adjustment layer that runs after the preset.
4. **Color → Vibrance/Saturation** — `opSaturation` exists; wire user-driven
   amount.
5. **Light → Exposure** — straightforward gain in linear space. Add op.
6. **Light → Contrast** — `opContrast` exists.
7. **HSL** — requires per-color hue-shift logic; can be approximated by
   converting RGB → HSL, applying selective adjustments by hue range,
   converting back.

### Bigger lifts
8. **LUT tab — browser `.cube` loader** — parse `.cube` files (1D + 3D) and
   apply a 3D LUT via trilinear interpolation. Mirror `photofilm/lut.py`.
9. **Curves tab — interactive curve editor** — pipeline `opToneCurve` already
   exists. Need draggable point editor + per-channel switching.
10. **Crop tab — interactive crop overlay** — port the draggable handles +
    rule-of-thirds grid from `viewer.html` (lines 2053-2093). Hook to a
    pending `crop: {x,y,w,h}` in the provider so Apply bakes it.
11. **Crop tab — Perspective Horizontal** — extend `bakePerspective` /
    `opPerspective` to support horizontal keystone (strip-scaling along the
    other axis).
12. **Light → Highlights/Shadows/Whites/Blacks** — local tone adjustment; non-
    trivial without a proper local-contrast op. Probably do this as parametric
    curve points feeding `opToneCurve`.
13. **Light → Texture/Clarity/Dehaze** — needs local contrast / detail
    extraction; mid-frequency unsharp mask for clarity, larger-radius for
    dehaze. Probably WebGL or worker territory if performance matters.

## Approach for new pipeline ops

Both the browser (`pipeline.jsx`) and CLI (`photofilm/filters.py`) maintain the
same op vocabulary so presets stay portable. When adding a new op, add it in
both places with identical signatures and identical math. Test by exporting
the same photo via CLI and browser and diffing.

## Demo photo

Boot loads `https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?...`
into the source canvas so the app is usable before the user supplies a file.
Falls back to `https://picsum.photos/seed/photofilm/1600/1000`. Offline mode
shows an empty viewport with a "drop a photo here" hint.

## Files no longer used by index.html

- `design-canvas.jsx` — DesignCanvas wrapper used during the design-review
  phase. Not loaded by `index.html` anymore. Safe to delete once you're sure
  the design is locked in.
- `viewer.html` — the previous self-contained editor. Same eight presets +
  crop/rotate/perspective + export. Kept as a fallback / reference.
