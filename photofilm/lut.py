"""Parse and apply Adobe .cube 3D LUT files via Pillow's Color3DLUT filter."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter


def load_cube(path: str | Path) -> ImageFilter.Color3DLUT:
    size: int | None = None
    domain_min = (0.0, 0.0, 0.0)
    domain_max = (1.0, 1.0, 1.0)
    table: list[float] = []

    with open(path) as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            head, *rest = line.split()
            if head == "LUT_3D_SIZE":
                size = int(rest[0])
            elif head == "DOMAIN_MIN":
                domain_min = tuple(float(x) for x in rest[:3])  # type: ignore[assignment]
            elif head == "DOMAIN_MAX":
                domain_max = tuple(float(x) for x in rest[:3])  # type: ignore[assignment]
            elif head in {"TITLE", "LUT_1D_SIZE", "LUT_3D_INPUT_RANGE"}:
                continue
            else:
                try:
                    table.extend(float(x) for x in (head, *rest))
                except ValueError:
                    continue

    if size is None:
        raise ValueError("No LUT_3D_SIZE found in .cube file")
    if len(table) != size ** 3 * 3:
        raise ValueError(f"Expected {size ** 3 * 3} values, got {len(table)}")

    # Pillow expects values in [0,1] with no domain remap; rescale if needed.
    if domain_min != (0.0, 0.0, 0.0) or domain_max != (1.0, 1.0, 1.0):
        # Domain remap is on input, not the table itself — Pillow doesn't
        # support custom domains, so warn by raising for now.
        raise NotImplementedError("Custom DOMAIN_MIN/MAX in .cube not yet supported")

    return ImageFilter.Color3DLUT(size, table, channels=3)


def apply_lut(img: Image.Image, lut_path: str | Path) -> Image.Image:
    return img.convert("RGB").filter(load_cube(lut_path))
