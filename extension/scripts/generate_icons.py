import os
from PIL import Image

SRC_ICON = os.path.abspath('frontend/assets/icon.png')
DEST_DIR = os.path.abspath('extension/icons')

os.makedirs(DEST_DIR, exist_ok=True)

sizes = [16, 32, 48, 128]

with Image.open(SRC_ICON) as img:
    img = img.convert('RGBA')
    for size in sizes:
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        out_path = os.path.join(DEST_DIR, f'icon-{size}.png')
        resized.save(out_path, format='PNG')
        print(f'Generated {out_path} ({size}x{size})')

print('All icons generated successfully.')
