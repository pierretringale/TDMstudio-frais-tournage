#!/usr/bin/env python3
"""
Génère les icons PWA Galactus (placeholder cosmic + lettre G).
Sortie : icons/icon-192.png + icons/icon-512.png.

Usage : python3 icons/_generate.py (depuis racine repo)
"""
import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: Pillow non installé. Installer avec : pip3 install Pillow")
    sys.exit(1)


def make_icon(size, path):
    """Crée un PNG carré : fond cosmos + halo radial violet→accent→gold + lettre G blanche."""
    img = Image.new('RGB', (size, size), '#050513')
    draw = ImageDraw.Draw(img, 'RGBA')

    cx, cy = size / 2, size / 2
    outer_r = int(size * 0.48)

    # Couche violet (large, diffuse)
    for i in range(outer_r, int(outer_r * 0.55), -1):
        t = (outer_r - i) / max(1, outer_r * 0.45)
        alpha = int(70 * (1 - t))
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(139, 61, 255, alpha))

    # Couche accent magenta (medium)
    for i in range(int(outer_r * 0.7), int(outer_r * 0.25), -1):
        t = (outer_r * 0.7 - i) / max(1, outer_r * 0.45)
        alpha = int(120 * (1 - t))
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(255, 31, 109, alpha))

    # Coeur or
    core_r = int(outer_r * 0.22)
    for i in range(core_r, 0, -1):
        t = (core_r - i) / max(1, core_r)
        alpha = int(180 * (1 - t))
        draw.ellipse([cx - i, cy - i, cx + i, cy + i], fill=(255, 200, 87, alpha))

    # === Lettre G ===
    font_size = int(size * 0.52)
    font = None
    candidates = [
        '/System/Library/Fonts/Helvetica.ttc',
        '/System/Library/Fonts/HelveticaNeue.ttc',
        '/Library/Fonts/Arial Bold.ttf',
        '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    ]
    for fp in candidates:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, font_size)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    text = 'G'
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    tx = (size - tw) / 2 - bbox[0]
    ty = (size - th) / 2 - bbox[1]

    # Ombre subtile
    draw.text((tx + max(2, size // 100), ty + max(2, size // 100)),
              text, fill=(0, 0, 0, 140), font=font)
    # Lettre principale
    draw.text((tx, ty), text, fill='white', font=font)

    img.save(path, 'PNG', optimize=True)
    print(f"OK {path} ({size}x{size})")


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    make_icon(192, os.path.join(here, 'icon-192.png'))
    make_icon(512, os.path.join(here, 'icon-512.png'))
