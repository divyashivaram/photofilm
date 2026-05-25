"""Hand-tuned Fujifilm-inspired presets.

Each preset is a list of (op_name, kwargs) applied in order. These are
approximations — for true Fuji simulations, apply an official .cube LUT
via the --lut flag instead.
"""
from __future__ import annotations

# Lifted-shadow, rolled-highlight S-curve used by most "film" looks.
_FILM_CURVE = [(0.0, 0.04), (0.25, 0.22), (0.5, 0.5), (0.75, 0.78), (1.0, 0.96)]

PRESETS: dict[str, list[tuple[str, dict]]] = {
    # Muted, cinematic, slight warmth — Fuji's most popular look.
    "classic-chrome": [
        ("tone_curve", {"points": _FILM_CURVE}),
        ("white_balance", {"temp": 0.15, "tint": -0.05}),
        ("saturation", {"amount": -0.25}),
        ("channel_saturation", {"reds": -0.15, "greens": 0.05, "blues": 0.10}),
        ("contrast", {"amount": 0.10}),
        ("grain", {"amount": 0.4}),
    ],
    # Punchy, high-saturation landscape film.
    "velvia": [
        ("tone_curve", {"points": _FILM_CURVE}),
        ("contrast", {"amount": 0.25}),
        ("saturation", {"amount": 0.35}),
        ("channel_saturation", {"reds": 0.25, "greens": 0.30, "blues": 0.15}),
        ("grain", {"amount": 0.2}),
    ],
    # Balanced everyday standard.
    "provia": [
        ("tone_curve", {"points": _FILM_CURVE}),
        ("saturation", {"amount": 0.10}),
        ("contrast", {"amount": 0.08}),
        ("grain", {"amount": 0.25}),
    ],
    # Warm, pastel portrait film.
    "astia": [
        ("tone_curve", {"points": [(0.0, 0.06), (0.3, 0.30), (0.7, 0.74), (1.0, 0.95)]}),
        ("white_balance", {"temp": 0.20, "tint": 0.05}),
        ("saturation", {"amount": 0.05}),
        ("channel_saturation", {"reds": 0.15, "greens": -0.10, "blues": -0.05}),
        ("grain", {"amount": 0.2}),
    ],
    # Moody B&W with strong reds (dramatic skies, smooth skin).
    "acros": [
        ("monochrome", {"red": 0.4, "green": 0.4, "blue": 0.2}),
        ("tone_curve", {"points": [(0.0, 0.02), (0.3, 0.22), (0.7, 0.80), (1.0, 0.98)]}),
        ("contrast", {"amount": 0.15}),
        ("grain", {"amount": 0.6}),
    ],
    # Synthwave / cyberpunk: purple shadows, hot-pink/cyan highlights, neon bloom.
    # Needs a source with existing nighttime lights — this can recolor and glow them,
    # not invent them.
    "synthwave": [
        ("contrast", {"amount": 0.20}),
        ("tone_curve", {"points": [(0.0, 0.08), (0.3, 0.32), (0.7, 0.78), (1.0, 1.0)], "channel": "r"}),
        ("tone_curve", {"points": [(0.0, 0.0),  (0.3, 0.16), (0.7, 0.48), (1.0, 0.82)], "channel": "g"}),
        ("tone_curve", {"points": [(0.0, 0.28), (0.3, 0.50), (0.7, 0.78), (1.0, 0.95)], "channel": "b"}),
        ("saturation", {"amount": 0.40}),
        ("bloom", {"threshold": 0.55, "blur_radius": 30.0, "amount": 0.55}),
        ("grain", {"amount": 0.25}),
    ],
    # Tokyo back-alley at night: warm orange/red glowing signage against
    # cool teal shadows, soft halation on the lights, wet-asphalt mood.
    # Needs a source with practical lights — this grades them, doesn't invent them.
    "japan-night": [
        ("tone_curve", {"points": [(0.0, 0.03), (0.25, 0.20), (0.5, 0.48), (0.75, 0.78), (1.0, 0.97)]}),
        ("tone_curve", {"points": [(0.0, 0.02), (0.3, 0.28), (0.7, 0.82), (1.0, 1.0)],  "channel": "r"}),
        ("tone_curve", {"points": [(0.0, 0.04), (0.3, 0.24), (0.7, 0.70), (1.0, 0.92)], "channel": "g"}),
        ("tone_curve", {"points": [(0.0, 0.10), (0.3, 0.32), (0.7, 0.58), (1.0, 0.80)], "channel": "b"}),
        ("saturation", {"amount": -0.10}),
        ("channel_saturation", {"reds": 0.25, "greens": -0.10, "blues": 0.15}),
        ("contrast", {"amount": 0.12}),
        ("bloom", {"threshold": 0.60, "blur_radius": 22.0, "amount": 0.35}),
        ("grain", {"amount": 0.35}),
    ],
    # Faded, low-contrast nostalgic look.
    "eterna": [
        ("tone_curve", {"points": [(0.0, 0.08), (0.5, 0.48), (1.0, 0.88)]}),
        ("saturation", {"amount": -0.30}),
        ("white_balance", {"temp": 0.05, "tint": -0.05}),
        ("contrast", {"amount": -0.10}),
        ("grain", {"amount": 0.3}),
    ],
}


def list_presets() -> list[str]:
    return sorted(PRESETS)
