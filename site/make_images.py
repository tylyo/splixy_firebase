"""Prepara le immagini del sito a partire dagli screenshot dello store.

Sorgenti (fuori da questo repo): ../../resources/store/screens/{final,raw}/{it,en}/
Uscita: ../public/assets/site/
Richiede Pillow.
"""
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
SRC = HERE.parent.parent / "resources" / "store" / "screens"
OUT = HERE.parent / "public" / "assets" / "site"
OUT.mkdir(parents=True, exist_ok=True)

SHOTS = ["01_group_detail", "02_transactions", "03_share_qr", "04_stats_categories", "05_stats_members", "06_export_menu"]


def save(img, path, width, quality=82):
    img = img.convert("RGB")
    img = img.resize((width, round(img.height * width / img.width)), Image.LANCZOS)
    img.save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    print(path.name, img.size, path.stat().st_size // 1024, "KB")


for lang in ("it", "en"):
    for name in SHOTS:
        save(Image.open(SRC / "final" / lang / f"{name}.png"), OUT / f"shot-{lang}-{name[3:]}.jpg", 540)
    save(Image.open(SRC / "raw" / lang / "02_group_detail.png"), OUT / f"hero-{lang}.jpg", 520)

from PIL import ImageDraw, ImageFont

FONT = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"
W, H = 1200, 630
og = Image.new("RGB", (W, H))
draw = ImageDraw.Draw(og)
for y in range(H):
    t = y / (H - 1)
    draw.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip((0, 98, 168), (0, 52, 110))))

logo_og = Image.open(HERE.parent / "public" / "assets" / "img" / "logo.webp").convert("RGBA").resize((140, 140), Image.LANCZOS)
mask = Image.new("L", (140, 140), 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, 139, 139), 32, fill=255)
og.paste(logo_og, (80, 90), mask)
draw.text((250, 160), "Splixy", font=ImageFont.truetype(FONT, 104), fill="white", anchor="lm")
draw.multiline_text((80, 340), "Split expenses with\nfriends, clearly.", font=ImageFont.truetype(FONT, 58), fill=(214, 233, 250), spacing=14)

for i, (name, x, y) in enumerate((("01_group_detail", 700, 110), ("02_transactions", 940, 190))):
    raw = Image.open(SRC / "raw" / "en" / f"{name[3:] if False else ['02_group_detail','03_transactions'][i]}.png").convert("RGB")
    w = 250
    raw = raw.resize((w, round(raw.height * w / raw.width)), Image.LANCZOS)
    m = Image.new("L", raw.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, raw.width - 1, raw.height - 1), 30, fill=255)
    og.paste((14, 14, 18), (x - 8, y - 8, x + w + 8, y + raw.height + 8), Image.new("L", (w + 16, raw.height + 16), 255))
    og.paste(raw, (x, y), m)
og.save(OUT / "og-image.jpg", "JPEG", quality=86)

logo = Image.open(HERE.parent / "public" / "assets" / "img" / "logo.webp").convert("RGBA")
for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (192, "icon-192.png")):
    logo.resize((size, size), Image.LANCZOS).save(OUT / name)
print("ok")
