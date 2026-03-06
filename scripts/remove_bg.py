#!/usr/bin/env python3
"""
Remove background from a PNG image and optionally add a sticker outline.
Reads base64 PNG from stdin, writes base64 transparent PNG to stdout.

Usage:
  echo "<base64_png_data>" | python3 remove_bg.py [--outline]
"""

import sys
import base64
import io
import numpy as np

from rembg import remove
from PIL import Image, ImageFilter


def add_sticker_outline(img, outline_width=3, outline_color=(255, 255, 255, 220)):
    """Add a subtle white outline around the subject using numpy for speed."""
    alpha = np.array(img.split()[-1])
    expanded = np.array(
        Image.fromarray(alpha).filter(ImageFilter.MaxFilter(size=outline_width * 2 + 1))
    )
    # Outline = pixels that are in expanded but not in original
    outline_mask = (expanded > 20) & (alpha < 128)

    outline_layer = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    outline_layer[outline_mask] = outline_color

    outline_img = Image.fromarray(outline_layer, 'RGBA')
    result = Image.new('RGBA', img.size, (0, 0, 0, 0))
    result = Image.alpha_composite(result, outline_img)
    result = Image.alpha_composite(result, img)
    return result


def auto_crop(img, padding=10):
    """Crop to content bounding box with some padding, keeping it square."""
    alpha = np.array(img.split()[-1])
    rows = np.any(alpha > 20, axis=1)
    cols = np.any(alpha > 20, axis=0)

    if not rows.any() or not cols.any():
        return img

    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    # Make it square (use the larger dimension)
    h = rmax - rmin
    w = cmax - cmin
    side = max(h, w)
    cx = (cmin + cmax) // 2
    cy = (rmin + rmax) // 2

    half = side // 2 + padding
    x1 = max(0, cx - half)
    y1 = max(0, cy - half)
    x2 = min(img.width, cx + half)
    y2 = min(img.height, cy + half)

    cropped = img.crop((x1, y1, x2, y2))

    # Resize to a nice power-of-2 size for game use
    target = 512
    cropped = cropped.resize((target, target), Image.LANCZOS)
    return cropped


def main():
    add_outline = '--outline' in sys.argv

    raw = sys.stdin.read().strip()
    img_bytes = base64.b64decode(raw)

    # Remove background
    result_bytes = remove(img_bytes)
    img = Image.open(io.BytesIO(result_bytes)).convert('RGBA')

    # Auto-crop to content
    img = auto_crop(img)

    # Optional sticker outline
    if add_outline:
        img = add_sticker_outline(img, outline_width=3)

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    out_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    sys.stdout.write(out_b64)


if __name__ == '__main__':
    main()
