# photofilm

A terminal-based photo editor that applies Fujifilm-inspired film simulations
(and a synthwave neon look) to photos. Hand-tuned presets cover most everyday
looks; for higher fidelity, drop in any Adobe `.cube` 3D LUT.

## Install

Requires Python 3.10+.

```bash
python3 -m venv .venv
.venv/bin/pip install -e .

# Optional extras
.venv/bin/pip install -e ".[heic]"   # iPhone HEIC support
.venv/bin/pip install -e ".[raw]"    # Canon CR2/CR3, Nikon NEF, Sony ARW, DNG, etc.
```

## Quick start

```bash
# Single photo
photofilm photo.jpg --preset classic-chrome

# Whole directory (recurses one level)
photofilm ~/Pictures/vacation --preset velvia --out-dir ~/Pictures/vacation_filtered

# Apply an Adobe .cube 3D LUT instead of a built-in preset
photofilm photo.jpg --lut FujiClassicChrome.cube

# List available presets
photofilm --list-presets
```

Output saves alongside the source as `<name>_<preset>.<ext>` by default
(or into `--out-dir` if you want to keep things tidy). RAW files always
output as JPEG since we can't write back to camera RAW formats.

## Presets

| Preset            | Character                                                          |
| ----------------- | ------------------------------------------------------------------ |
| `classic-chrome`  | Muted, cinematic, slightly warm — Fuji's signature documentary look |
| `velvia`          | Punchy saturation, high contrast — landscape film                  |
| `provia`          | Balanced everyday standard with mild boost                         |
| `astia`           | Warm pastel — flattering for portraits                             |
| `acros`           | Dramatic black and white with strong reds                          |
| `eterna`          | Faded, low-contrast, nostalgic cinema look                         |
| `synthwave`       | Cyberpunk neon: purple shadows, hot-pink/cyan highlights, bloom    |

All presets are hand-tuned approximations. For true Fuji film simulations,
use `--lut path/to/fuji.cube` with an official or community LUT instead.

## Supported formats

**Read:** JPEG, PNG, TIFF, WebP, HEIC/HEIF (with `[heic]` extra),
and most camera RAW formats with the `[raw]` extra:
CR2, CR3, NEF, ARW, RAF, DNG, ORF, RW2, PEF, SRW.

**Write:** Same format as input, except RAW files write as JPEG.

## Project layout

```
photofilm/
├── cli.py        # CLI entry point and file I/O orchestration
├── filters.py    # Core image ops (curves, WB, saturation, grain, bloom)
├── presets.py    # Named presets — each a sequence of (op, kwargs)
└── lut.py        # Adobe .cube LUT loader
```

## Adding your own preset

A preset is just a list of `(op_name, kwargs)` tuples. Edit `photofilm/presets.py`:

```python
"my-look": [
    ("contrast", {"amount": 0.10}),
    ("tone_curve", {"points": [(0.0, 0.05), (0.5, 0.5), (1.0, 0.95)]}),
    ("saturation", {"amount": 0.15}),
    ("grain", {"amount": 0.3}),
],
```

Available ops live in `OPS` in `photofilm/filters.py`:
`tone_curve`, `white_balance`, `saturation`, `channel_saturation`,
`contrast`, `grain`, `monochrome`, `bloom`. The `tone_curve` op also
accepts a `channel` argument (`"r"`, `"g"`, or `"b"`) for per-channel
split-toning.

## Limitations

A filter recolors and reshapes light that's already in the photo. It cannot
invent scene elements. The synthwave preset, for instance, will get you a
convincing neon palette on a night-city source, but won't add neon signs,
wet pavement, or atmospheric haze to a photo that doesn't already have them.
For the strongest results, match the preset to the source: landscape film
for landscapes, B&W for high-contrast scenes, synthwave for night photos
with existing lights.
