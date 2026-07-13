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
All user adjustments compose into a single `userAdjust = {light, color, hsl,
curves, effects}` object held in `PhotofilmContext`. The hero `FilteredPhoto`
runs `applyUserAdjustments` on top of the cached preset output, so changing
any slider re-renders without invalidating the (expensive) preset cache.

- **Light tab** — Exposure, Contrast, Highlights, Shadows, Whites, Blacks,
  Texture, Clarity, Dehaze. Tone adjustments use luma-masked offsets;
  texture/clarity/dehaze use unsharp mask with progressively larger blur
  radii. Browser-only — the CLI doesn't expose these yet.
- **Color tab** — White-balance Kelvin-style Temperature + Tint sliders, WB
  preset pills (As Shot / Daylight / Cloudy / Shade / Tungsten / Fluorescent
  / Flash), Vibrance, Saturation, and Split Toning (two ToneCards for shadow
  + highlight H/S, Balance slider). Drives `opWhiteBalance`, `opVibrance`,
  `opSaturation`, `opSplitTone`.
- **HSL tab** — 8-color (Red/Orange/Yellow/Green/Aqua/Blue/Purple/Magenta) ×
  (Hue, Saturation, Luminance) mixer. ALL/HUE/SAT/LUM filter pills dim the
  inactive columns. Drives `opHSL`, which converts each pixel to HSL once
  and weights contributions by hue distance (smoothstep, ±60° half-width).
- **Curves tab** — Per-channel point-curve editor (RGB / R / G / B). Click
  the graph to add a point, drag to move (clamped between neighbors), shift-
  click a point to delete. IN/OUT readouts show the selected point's source/
  target value in 0–255. Six built-in presets (Linear / Medium Contrast /
  Strong Contrast / Filmic / Crushed Blacks / Lifted Shadows). Drives
  `opToneCurve` per channel.
- **Effects tab** — Grain (Amount / Size / Roughness), Vignette (Amount /
  Midpoint / Roundness / Feather, negative=darken corners), Sharpen
  (Amount / Radius / Detail / Masking, with edge-aware masking gate). Drives
  `opGrain`, `opVignette`, `opSharpen`.
- **Film strip** — clicking a thumbnail sets the active preset; the hero
  re-renders with that preset applied. Seventeen built-in presets (vintage-
  cinematic + clean-cinematic pack + three legacy classics — see
  `filter-guide.md` and `TODOS.md`). The CLI still carries the old eight
  Fuji sims; parity is TODOS.md Phase 5.
- **Strength slider** — 0–100 % intensity blend between original and filtered.
- **Histogram overlay** — derived from the hero ImageData, RGB.
- **EXIF chip** — real source dimensions + active preset + intensity.
- **Open / drag-drop / paste** — supports JPEG/PNG/WebP/HEIC + RAW (CR2/NEF/
  ARW/DNG/RAF/etc) by extracting the embedded JPEG preview.
- **Crop tab — Aspect** — ORIGINAL (cancel pending), FREE (interactive
  overlay), 1:1, 4:5, 5:4, 3:2, 2:3, 16:9, 9:16 buttons. Aspect buttons apply
  a centered crop immediately; FREE puts the user into crop-pending mode
  with a draggable 8-handle frame + rule-of-thirds grid drawn over the hero
  in `EditPreview` / `CropOverlay`. Apply bakes via `bakeCrop`.
- **Crop tab — 90° rotate / flip H/V** — instant.
- **Crop tab — Straighten** — ruler controls a pending rotation angle (-45°
  to +45°); hero shows a live raw preview with the inscribed crop applied;
  Apply bakes via `bakeRotate`.
- **Crop tab — Perspective** — all six sliders (Vertical/Horizontal keystone,
  Rotate, Scale, X-Offset, Y-Offset) feed a single composite pending
  transform that previews live in the hero and bakes together via
  `bakeTransform`. Vertical+horizontal use the same strip-warp approach;
  rotate/scale/offset run as a final affine.
- **Hold to compare** — temporarily renders intensity = 0.
- **Keyboard** — ←/→ step presets; Space toggles active preset in export set.
- **Export tab** — JPEG/PNG/WebP, quality slider, optional long-edge cap
  (FULL / 2048 / 1080 / 720), per-preset checkbox list; downloads each
  selected preset as a separate file. Falls back to active preset if nothing
  is checked.

### Stub (visual only — TODOs below)
- **LUT tab** — `.cube` drop zone, intensity, shelf. The CLI supports `--lut
  path/to/x.cube` (see `photofilm/lut.py`); the browser doesn't load `.cube`
  files yet.

## TODOs to make the stubs real

1. **LUT tab — browser `.cube` loader** — parse `.cube` files (1D + 3D) and
   apply a 3D LUT via trilinear interpolation. Mirror `photofilm/lut.py`.
2. **CLI parity** — the new browser-only ops (`opVibrance`, `opSplitTone`,
   `opVignette`, `opHSL`, `opSharpen`) and the Light-tab ops only exist in
   `pipeline.jsx`. Port them into `photofilm/filters.py` so the CLI can take
   `--exposure`, `--vibrance`, `--vignette-amount`, `--hsl-red-h`, etc., and
   so the eight built-in presets stay portable.
3. **Filters as edit-preset chains** — today the eight built-in presets are
   hand-authored ops chains in `PRESETS_LIST` (`pipeline.jsx`) and
   `photofilm/presets.py`. Adding a filter requires editing both files.
   Goal: treat a "filter" as the same data shape the editor already produces
   so the user can dial in Light/Color/HSL/Curves/Effects/(LUT later) and we
   serialize that into a portable preset JSON.

   - **Phase 1 — share edits as JSON (DONE).** `serializeUserEdits` in
     `pipeline.jsx` + "SAVE EDITS AS JSON" button in the Export tab dump
     `{schemaVersion, savedAt, baselinePreset, intensity, sourceName,
     userAdjust}` to a file. Not yet replayable as a preset — used to share
     edit state for hand-authoring a filter into `PRESETS_LIST`.

   - **Phase 2 — make the JSON itself a runnable preset.** Build
     `filterFromUserAdjust(userAdjust, lutRef)` that emits the same
     `{id, name, sub, blurb, ops: [...]}` shape `applyPreset` consumes.
     Blocker: most userAdjust features have no matching preset op (Light
     tab, vibrance, split_tone, vignette, HSL, sharpen live only inside
     `applyUserAdjustments`). Close the gap by either (a) exposing those
     internals as named ops in the preset dispatcher, or (b) adding a
     single passthrough op `["user_adjust", {...}]` that calls
     `applyUserAdjustments`. Then extend the Export tab to prompt for
     name/sub/blurb and download a paste-ready `PRESETS_LIST` snippet.

   - **Phase 3 — CLI parity + contribution flow.** Subsumes TODO #2: port
     the browser-only ops into `photofilm/filters.py` with identical math
     so JSON presets run in both surfaces. Document the contribution flow
     in `README.md`: drop the JSON into `photofilm/filters/community/`
     (new dir) — both `presets.py` and `pipeline.jsx` auto-pick it up —
     and open a PR. Include a `validate` CLI subcommand that round-trips
     the JSON through both pipelines and diffs the output, so reviewers
     can confirm parity.

## Approach for new pipeline ops

Both the browser (`pipeline.jsx`) and CLI (`photofilm/filters.py`) maintain the
same op vocabulary so presets stay portable. When adding a new op, add it in
both places with identical signatures and identical math. Test by exporting
the same photo via CLI and browser and diffing.

## Empty state

Boot starts with no image loaded. The viewport shows a "DROP A PHOTO HERE ·
OR CLICK OPEN" placeholder until the user drops / pastes / picks a file.

## Files no longer used by index.html

- `viewer.html` — the previous self-contained editor. Old eight-preset Fuji
  pack + crop/rotate/perspective + export. Kept as a fallback / reference.
  (`design-canvas.jsx`, the design-review wrapper, was deleted 2026-07-13.)
