from pathlib import Path
from shutil import copy2

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BRANDING_ORIGINALS = ROOT / "branding-originals"
SOURCE_ASSETS = ROOT / "src" / "assets"
BRAND_ASSETS = SOURCE_ASSETS / "brand"
PUBLIC = ROOT / "public"
PUBLIC_BRAND = PUBLIC / "brand"
CREAM = (250, 247, 242, 255)
RESAMPLING = Image.Resampling.LANCZOS


def original_path(name):
    preserved = BRANDING_ORIGINALS / name
    source = SOURCE_ASSETS / name
    return preserved if preserved.exists() else source


def trim_transparency(image):
    rgba = image.convert("RGBA")
    bounds = rgba.getchannel("A").getbbox()
    if bounds is None:
        raise ValueError(f"{image.filename} contains no visible pixels")

    left, top, right, bottom = bounds
    margin = round(max(right - left, bottom - top) * 0.02)
    return rgba.crop((
        max(0, left - margin),
        max(0, top - margin),
        min(rgba.width, right + margin),
        min(rgba.height, bottom + margin),
    ))


def resize_to_size(image, dimensions):
    return image.resize(dimensions, RESAMPLING)


def square_icon(image, size, background=None, fill_ratio=0.84):
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    max_side = round(size * fill_ratio)
    scale = min(max_side / image.width, max_side / image.height)
    dimensions = (round(image.width * scale), round(image.height * scale))
    mark = image.resize(dimensions, RESAMPLING)
    canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return canvas


def preserve_original(name):
    source = SOURCE_ASSETS / name
    destination = BRANDING_ORIGINALS / name
    if not destination.exists():
        if not source.exists():
            raise FileNotFoundError(f"Original asset not found: {name}")
        copy2(source, destination)
    return destination


def main():
    BRANDING_ORIGINALS.mkdir(parents=True, exist_ok=True)
    BRAND_ASSETS.mkdir(parents=True, exist_ok=True)
    PUBLIC_BRAND.mkdir(parents=True, exist_ok=True)

    preserve_original("salo_logo_final.png")
    preserve_original("salo_logo_dm_final.png")
    preserve_original("icon_final.png")

    logo = trim_transparency(Image.open(original_path("salo_logo_final.png")))
    dark_logo = trim_transparency(Image.open(original_path("salo_logo_dm_final.png")))
    icon = trim_transparency(Image.open(original_path("icon_final.png")))

    logo.save(BRAND_ASSETS / "salo-logo-master.png")
    dark_logo.save(BRAND_ASSETS / "salo-logo-dark-master.png")
    icon.save(BRAND_ASSETS / "salo-icon-master.png")

    for name, image, dimensions in (
        ("salo-logo", logo, (140, 52)),
        ("salo-logo-dark", dark_logo, (140, 52)),
        ("salo-icon", icon, (32, 38)),
    ):
        resize_to_size(image, dimensions).save(BRAND_ASSETS / f"{name}.png")
        resize_to_size(image, (dimensions[0] * 2, dimensions[1] * 2)).save(
            BRAND_ASSETS / f"{name}@2x.png"
        )

    favicon_source = square_icon(icon, 48, fill_ratio=0.84)
    favicon_source.save(PUBLIC / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

    for size in (192, 512):
        square_icon(icon, size, CREAM, fill_ratio=0.8).save(PUBLIC_BRAND / f"icon-{size}.png")

    square_icon(icon, 180, CREAM, fill_ratio=0.8).save(PUBLIC / "apple-touch-icon.png")
    (PUBLIC / "site.webmanifest").write_text(
        '{\n'
        '  "name": "SALO",\n'
        '  "short_name": "SALO",\n'
        '  "start_url": "/",\n'
        '  "display": "standalone",\n'
        '  "background_color": "#FAF7F2",\n'
        '  "theme_color": "#FAF7F2",\n'
        '  "icons": [\n'
        '    { "src": "/brand/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },\n'
        '    { "src": "/brand/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }\n'
        '  ]\n'
        '}\n',
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
