# photofilm — build plan

Vision: a web app with Prequel-style trendy filters + Lightroom-grade editing.
The filters should be film-like, Instagram-worthy — largely **vintage
cinematic** (dusty film, Wes pastel, misty haze, 70s/90s retro, polaroid,
grunge) plus a smaller **clean cinematic** wave (teal-orange, clean film
portrait, bright & airy).

Reference material: 10 Pinterest screenshots shared 2026-07-13 (dusty / WES /
Misty 1999 / Retro Metropolitan / Polaroid recipe / Grunge recipe / 90s VSCO
recipe / 70s Vintage recipe / 1990 Kodak recipe / warm-cinema + green-film
photo refs). Recipes translated into `userAdjust` values in `pipeline.jsx`.

Decisions (2026-07-13):
- Keep CLASSIC CHROME, ACROS, JAPAN NIGHT from the old Fuji pack; retire
  PROVIA, VELVIA, ASTIA, ETERNA, SYNTHWAVE, VINTAGE MUTE (vintage-mute's
  vibe is superseded by the new vintage pack).
- Light leaks / dust / textures: procedural, no image assets.
- Browser first; CLI parity deferred to Phase 5.

## Phase 1 — new filter pack (data-only, existing ops)

- [x] Commit reference photos (`template_photos/`)
- [x] Author new vintage-cinematic presets in `PRESETS_LIST` (pipeline.jsx):
      DUSTY, WES, MISTY, RETRO METRO, SEVENTIES, NINETIES, DISPOSABLE,
      POLAROID, GRUNGE, CINEMA GOLD, GREEN ROOM
- [x] Author clean-cinematic presets: BLOCKBUSTER, PORTRA, CREAM
- [x] Retire old presets (keep classic-chrome, japan-night, acros)
- [x] Update `filter-guide.md` for the new pack
- [ ] Eyeball every preset on real photos in the browser; tune values
- [ ] Pick/shoot a matched thumbnail photo per filter (see filter-guide.md)

## Phase 2 — signature effect ops (the "Prequel feel")

New ops in pipeline.jsx, then a second wave of filters that use them:

- [ ] Halation — red-tinted highlight bleed (Japan Night currently fakes it
      with plain bloom)
- [ ] Light leak — procedural warm gradient blobs, seeded per preset
- [ ] Dust & scratches — procedural speckle/fiber texture
- [ ] Soft glow / mist — highlight-weighted diffusion (Misty, Cinestill vibes)
- [ ] Chromatic aberration — radial RGB fringe
- [ ] Matte fade op — dedicated black-point lift control (today it's baked
      into each preset's curve)
- [ ] Wave-2 filters using the above (e.g. DUSTY + leaks, MISTY + glow)

## Phase 3 — browser .cube LUT loader

- [ ] Parse .cube (1D + 3D), trilinear interpolation; mirror photofilm/lut.py
- [ ] Wire into the LUT tab (drop zone, intensity, shelf are already built)

## Phase 4 — filter browsing UX

- [ ] Categories in the film strip (VINTAGE / CLEAN / CLASSIC / B&W / NIGHT)
- [ ] Favorites / reorder (maybe)

## Phase 5 — CLI parity + shareable preset JSON

- [ ] Port browser-only ops (light tab, vibrance, split tone, HSL, vignette,
      sharpen) into photofilm/filters.py — CLI presets.py still has the OLD
      8-preset pack and has diverged from the browser as of Phase 1
- [ ] Preset JSON pipeline (CLAUDE.md TODO #3 phases 2–3)

## Bugs / follow-ups

- [x] HSL scaling bug: sliders store -100..100 but `opHSL` mapped ±1 → ±36°
      hue (and over-range s/l), so any HSL slider was ~100× too hot, and
      partial preset bands like `{ s: 18 }` NaN'd the buffer. Fixed in
      `opHSL` (coalesce + /100). Presets still avoid `h` shifts (untested
      territory) — revisit while tuning.
- [ ] `photofilm/presets.py` diverged from browser presets (see Phase 5)
