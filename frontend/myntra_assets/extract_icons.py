import xml.etree.ElementTree as ET
from PIL import Image
import os
import re

dump_path = "myntra_assets/window_dump_2.xml"
img_path = "myntra_assets/myntra_home_scroll_1.png"
out_dir = "myntra_assets/icons"

os.makedirs(out_dir, exist_ok=True)

try:
    tree = ET.parse(dump_path)
    root = tree.getroot()
except Exception as e:
    print(f"Error parsing XML: {e}")
    exit(1)

img = Image.open(img_path)

icon_count = 0
for node in root.iter('node'):
    # Look for ImageViews or Views that might be icons
    cls = node.attrib.get('class', '')
    if 'ImageView' in cls:
        bounds = node.attrib.get('bounds', '')
        # bounds format: [x1,y1][x2,y2]
        match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds)
        if match:
            x1, y1, x2, y2 = map(int, match.groups())
            # Basic filter: must be roughly square, or within typical icon sizes
            width = x2 - x1
            height = y2 - y1
            
            # Icons usually aren't 1000px wide, and aren't 1px wide
            if 30 <= width <= 300 and 30 <= height <= 300:
                # Crop and save
                try:
                    cropped = img.crop((x1, y1, x2, y2))
                    out_path = os.path.join(out_dir, f"icon_{icon_count}_{width}x{height}.png")
                    cropped.save(out_path)
                    icon_count += 1
                except Exception as e:
                    print(f"Failed to crop {bounds}: {e}")

print(f"Successfully extracted {icon_count} icons to {out_dir}")
