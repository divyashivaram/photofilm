"""photofilm CLI entry point."""
from __future__ import annotations

import sys
from pathlib import Path

import click
from PIL import Image

try:
    import pillow_heif  # type: ignore[import-not-found]

    pillow_heif.register_heif_opener()
except ImportError:
    pass

try:
    import rawpy  # type: ignore[import-not-found]
except ImportError:
    rawpy = None  # type: ignore[assignment]

from .filters import apply_preset
from .lut import apply_lut
from .presets import list_presets

RAW_EXTS = {".cr2", ".cr3", ".nef", ".arw", ".raf", ".dng", ".orf", ".rw2", ".pef", ".srw"}
SUPPORTED_EXTS = {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".webp", ".heic", ".heif"} | RAW_EXTS


def _open_image(src: Path) -> Image.Image:
    """Open a still image, demosaicing RAW formats via rawpy."""
    if src.suffix.lower() in RAW_EXTS:
        if rawpy is None:
            raise RuntimeError(
                f"{src.name} is a RAW file but rawpy is not installed. "
                'Install with: pip install -e ".[raw]"'
            )
        with rawpy.imread(str(src)) as raw:
            # use_camera_wb keeps the WB the photographer set; no_auto_bright
            # avoids surprising exposure shifts before our filter runs.
            rgb = raw.postprocess(
                use_camera_wb=True,
                no_auto_bright=True,
                output_bps=8,
            )
        return Image.fromarray(rgb, mode="RGB")
    img = Image.open(src)
    img.load()
    return img


def _iter_inputs(path: Path) -> list[Path]:
    if path.is_dir():
        return sorted(p for p in path.iterdir() if p.suffix.lower() in SUPPORTED_EXTS)
    return [path]


def _output_path(src: Path, suffix: str, out_dir: Path | None) -> Path:
    target_dir = out_dir or src.parent
    # RAW files can't be written back — fall back to JPEG.
    ext = ".jpg" if src.suffix.lower() in RAW_EXTS else src.suffix
    return target_dir / f"{src.stem}_{suffix}{ext}"


@click.command(context_settings={"help_option_names": ["-h", "--help"]})
@click.argument("inputs", nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option("--preset", "-p", type=click.Choice(list_presets()), help="Built-in film preset.")
@click.option("--lut", "lut_path", type=click.Path(exists=True, path_type=Path), help="Apply an Adobe .cube LUT instead of a preset.")
@click.option("--out-dir", type=click.Path(file_okay=False, path_type=Path), help="Where to save results (default: alongside source).")
@click.option("--suffix", default=None, help="Filename suffix (default: preset name or 'lut').")
@click.option("--quality", default=95, show_default=True, help="JPEG quality 1–100.")
@click.option("--list-presets", "do_list", is_flag=True, help="List available presets and exit.")
def main(
    inputs: tuple[Path, ...],
    preset: str | None,
    lut_path: Path | None,
    out_dir: Path | None,
    suffix: str | None,
    quality: int,
    do_list: bool,
) -> None:
    """Apply a Fujifilm-inspired filter to one or more photos."""
    if do_list:
        click.echo("Available presets:")
        for name in list_presets():
            click.echo(f"  {name}")
        return

    if not inputs:
        click.echo("Error: pass at least one image path (or a directory).", err=True)
        sys.exit(2)
    if not preset and not lut_path:
        click.echo("Error: specify --preset or --lut.", err=True)
        sys.exit(2)
    if preset and lut_path:
        click.echo("Error: use either --preset or --lut, not both.", err=True)
        sys.exit(2)

    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    effective_suffix = suffix or (preset if preset else "lut")

    files: list[Path] = []
    for path in inputs:
        files.extend(_iter_inputs(path))

    if not files:
        click.echo("No supported images found.", err=True)
        sys.exit(1)

    for src in files:
        try:
            img = _open_image(src)
        except Exception as exc:  # noqa: BLE001
            click.echo(f"  ✗ {src.name}: failed to open ({exc})", err=True)
            continue

        try:
            out = apply_lut(img, lut_path) if lut_path else apply_preset(img, preset)  # type: ignore[arg-type]
        except Exception as exc:  # noqa: BLE001
            click.echo(f"  ✗ {src.name}: filter failed ({exc})", err=True)
            continue

        dest = _output_path(src, effective_suffix, out_dir)
        save_kwargs: dict = {}
        if dest.suffix.lower() in {".jpg", ".jpeg"}:
            save_kwargs["quality"] = quality
            save_kwargs["subsampling"] = 1
        out.save(dest, **save_kwargs)
        click.echo(f"  ✓ {src.name} → {dest.name}")


if __name__ == "__main__":
    main()
