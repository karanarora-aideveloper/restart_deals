import os
import subprocess
import time
import xml.etree.ElementTree as ET
from PIL import Image
import re

out_dir = "myntra_assets/crawl"
icon_dir = "myntra_assets/crawl_icons"
os.makedirs(out_dir, exist_ok=True)
os.makedirs(icon_dir, exist_ok=True)

device_id = "ZA223HTGQL"

def run_adb(cmd):
    return subprocess.run(f"adb -s {device_id} {cmd}", shell=True, capture_output=True)

# Launch Myntra
print("Launching Myntra...")
run_adb("shell monkey -p com.myntra.android -c android.intent.category.LAUNCHER 1")
time.sleep(5)

icon_count = 0

for step in range(10):
    print(f"--- Crawl Step {step} ---")
    
    # Dump UI
    dump_path = f"{out_dir}/dump_{step}.xml"
    run_adb("shell uiautomator dump /sdcard/window_dump.xml")
    run_adb(f"pull /sdcard/window_dump.xml {dump_path}")
    
    # Capture Screenshot
    img_path = f"{out_dir}/screen_{step}.png"
    run_adb(f"exec-out screencap -p > {img_path}")
    
    # Extract icons from this screen
    try:
        tree = ET.parse(dump_path)
        root = tree.getroot()
        img = Image.open(img_path)
        
        for node in root.iter('node'):
            cls = node.attrib.get('class', '')
            if 'ImageView' in cls:
                bounds = node.attrib.get('bounds', '')
                match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds)
                if match:
                    x1, y1, x2, y2 = map(int, match.groups())
                    width = x2 - x1
                    height = y2 - y1
                    if 30 <= width <= 300 and 30 <= height <= 300:
                        try:
                            cropped = img.crop((x1, y1, x2, y2))
                            out_path = os.path.join(icon_dir, f"icon_{icon_count}_{width}x{height}.png")
                            cropped.save(out_path)
                            icon_count += 1
                        except Exception as e:
                            pass
    except Exception as e:
        print(f"Error parsing/extracting step {step}: {e}")
        
    # Scroll down to see new content
    print("Scrolling...")
    run_adb("shell input swipe 500 2000 500 500")
    time.sleep(2)
    
    # Randomly switch tabs midway
    if step == 4:
        print("Switching tabs (Categories)")
        # Tap Categories tab (approx 450, 2500)
        run_adb("shell input tap 450 2500")
        time.sleep(3)
    elif step == 7:
        print("Switching tabs (Studio)")
        # Tap Studio tab (approx 750, 2500)
        run_adb("shell input tap 750 2500")
        time.sleep(3)

print(f"Crawl complete! Extracted {icon_count} icons across the app.")
