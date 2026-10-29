# SALO Brand Asset Rules

- Use the approved SALO logo and icon assets without recoloring, stretching, rotating, outlining, or adding effects.
- Keep clear space on every side equal to at least 25% of the displayed logo height.
- The full logo must be at least 48px tall on desktop, 44px on tablet, and 40px on mobile. Do not reduce the mobile logo below 40px.
- Use the icon by itself only in collapsed navigation or icon-sized spaces; keep it at least 24px tall.
- On dark surfaces or over photos in light mode, place the light artwork on a rounded cream plate. Dark mode uses the supplied dark wordmark on the dark surface; the collapsed-navigation icon keeps its cream plate. Do not modify either artwork to improve contrast.
- The supplied wordmark includes the tagline. Do not add a duplicate tagline beside or below it.
- The tagline is part of the supplied artwork. At the smallest header size it may be difficult to read; do not edit the artwork to compensate. Request a no-tagline variant if needed.
- Use `salo_logo_final.png` in light mode and `salo_logo_dm_final.png` in dark mode. Keep both originals unchanged in `branding-originals/`; generated theme variants belong in `src/assets/brand/`.
- Keep the original supplied PNGs unchanged in `branding-originals/`. Trimmed masters and display-density variants belong in `src/assets/brand/`.
- The one-time asset preparation utility is `scripts/prepare_brand_assets.py`. It requires Pillow and is not part of the frontend runtime.
