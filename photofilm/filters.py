"""Core image operations: tone curves, white balance, saturation, grain."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter

from .presets import PRESETS


def _to_array(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0


def _to_image(arr: np.ndarray) -> Image.Image:
    return Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8), mode="RGB")


def tone_curve(arr: np.ndarray, points: list[tuple[float, float]], channel: str = "rgb") -> np.ndarray:
    xs = np.array([p[0] for p in points], dtype=np.float32)
    ys = np.array([p[1] for p in points], dtype=np.float32)
    lut = np.interp(np.linspace(0, 1, 1024, dtype=np.float32), xs, ys)
    clipped = np.clip(arr, 0.0, 1.0)
    if channel == "rgb":
        return lut[(clipped * 1023).astype(np.int32)]
    idx = "rgb".index(channel)
    out = arr.copy()
    out[..., idx] = lut[(clipped[..., idx] * 1023).astype(np.int32)]
    return out


def white_balance(arr: np.ndarray, temp: float = 0.0, tint: float = 0.0) -> np.ndarray:
    # temp: -1..1 (blue → orange); tint: -1..1 (green → magenta)
    out = arr.copy()
    out[..., 0] += temp * 0.08
    out[..., 2] -= temp * 0.08
    out[..., 1] -= tint * 0.06
    return out


def saturation(arr: np.ndarray, amount: float = 0.0) -> np.ndarray:
    # amount: -1 (grayscale) .. +1 (very saturated)
    luma = (0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2])[..., None]
    return luma + (arr - luma) * (1.0 + amount)


def channel_saturation(arr: np.ndarray, reds: float = 0.0, greens: float = 0.0, blues: float = 0.0) -> np.ndarray:
    # Targeted per-channel saturation boost: scales channel away from luma.
    luma = (0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2])[..., None]
    out = arr.copy()
    out[..., 0] = luma[..., 0] + (arr[..., 0] - luma[..., 0]) * (1.0 + reds)
    out[..., 1] = luma[..., 0] + (arr[..., 1] - luma[..., 0]) * (1.0 + greens)
    out[..., 2] = luma[..., 0] + (arr[..., 2] - luma[..., 0]) * (1.0 + blues)
    return out


def contrast(arr: np.ndarray, amount: float = 0.0) -> np.ndarray:
    return 0.5 + (arr - 0.5) * (1.0 + amount)


def grain(arr: np.ndarray, amount: float = 0.0, seed: int = 0) -> np.ndarray:
    if amount <= 0:
        return arr
    rng = np.random.default_rng(seed)
    noise = rng.standard_normal(arr.shape[:2], dtype=np.float32)[..., None]
    # Grain is stronger in midtones, weaker in shadows/highlights — feels filmic.
    luma = (0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2])[..., None]
    weight = 1.0 - np.abs(luma - 0.5) * 2.0
    return arr + noise * amount * 0.05 * weight


def monochrome(arr: np.ndarray, red: float = 0.3, green: float = 0.5, blue: float = 0.2) -> np.ndarray:
    luma = (red * arr[..., 0] + green * arr[..., 1] + blue * arr[..., 2])[..., None]
    return np.repeat(luma, 3, axis=-1)


def bloom(arr: np.ndarray, threshold: float = 0.6, blur_radius: float = 20.0, amount: float = 0.5) -> np.ndarray:
    # Soft-threshold the bright pixels, blur them, screen-blend back on top.
    # This is the "halation" / neon-glow effect.
    if amount <= 0:
        return arr
    luma = 0.2126 * arr[..., 0] + 0.7152 * arr[..., 1] + 0.0722 * arr[..., 2]
    mask = np.clip((luma - threshold) / max(1e-3, 1.0 - threshold), 0, 1)[..., None]
    bright = np.clip(arr * mask * 255.0, 0, 255).astype(np.uint8)
    blurred_img = Image.fromarray(bright).filter(ImageFilter.GaussianBlur(blur_radius))
    blurred = np.asarray(blurred_img, dtype=np.float32) / 255.0
    return 1.0 - (1.0 - arr) * (1.0 - blurred * amount)


OPS = {
    "tone_curve": tone_curve,
    "white_balance": white_balance,
    "saturation": saturation,
    "channel_saturation": channel_saturation,
    "contrast": contrast,
    "grain": grain,
    "monochrome": monochrome,
    "bloom": bloom,
}


def apply_preset(img: Image.Image, preset_name: str, *, grain_seed: int = 0) -> Image.Image:
    if preset_name not in PRESETS:
        raise ValueError(f"Unknown preset {preset_name!r}. Known: {sorted(PRESETS)}")
    arr = _to_array(img)
    for op_name, kwargs in PRESETS[preset_name]:
        op = OPS[op_name]
        if op_name == "grain":
            kwargs = {**kwargs, "seed": grain_seed}
        arr = op(arr, **kwargs)
    return _to_image(arr)
