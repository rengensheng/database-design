#!/usr/bin/env python3
"""Generate DBForge app icons using PIL"""
from PIL import Image, ImageDraw
import math
import os

ICONS_DIR = os.path.join(os.path.dirname(__file__), 'src-tauri', 'icons')

def draw_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Scale factor
    s = size / 1024.0
    
    # Background rounded rect
    bg_color = (30, 30, 34, 255)
    border_color = (51, 51, 56, 255)
    radius = int(180 * s)
    margin = int(80 * s)
    bg_size = size - 2 * margin
    
    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [margin, margin, margin + bg_size, margin + bg_size],
        radius=radius,
        fill=bg_color,
        outline=border_color,
        width=max(1, int(3 * s))
    )
    
    # Colors
    orange = (240, 165, 0, 255)
    orange_dark = (212, 136, 10, 255)
    blue = (74, 144, 217, 255)
    dark_border = (51, 51, 56, 255)
    
    # Database cylinder parameters
    cx = size // 2
    cylinder_width = int(400 * s)
    top_y = int(280 * s)
    bottom_y = int(640 * s)
    ellipse_ry = int(60 * s)
    stroke_w = max(2, int(20 * s))
    
    left_x = cx - cylinder_width // 2
    right_x = cx + cylinder_width // 2
    
    # Top ellipse
    draw.ellipse(
        [left_x, top_y - ellipse_ry, right_x, top_y + ellipse_ry],
        outline=orange,
        width=stroke_w
    )
    
    # Cylinder body (left and right lines)
    draw.line([(left_x, top_y), (left_x, bottom_y)], fill=orange, width=stroke_w)
    draw.line([(right_x, top_y), (right_x, bottom_y)], fill=orange, width=stroke_w)
    
    # Bottom arc (front half of ellipse)
    bbox = [left_x, bottom_y - ellipse_ry, right_x, bottom_y + ellipse_ry]
    draw.arc(bbox, start=0, end=180, fill=orange, width=stroke_w)
    
    # Middle ellipse lines
    mid_stroke = max(2, int(14 * s))
    mid1_y = int(400 * s)
    mid2_y = int(520 * s)
    
    # Arc for middle lines (front half)
    draw.arc([left_x, mid1_y - ellipse_ry, right_x, mid1_y + ellipse_ry], start=0, end=180, fill=blue, width=mid_stroke)
    # Connect with side lines for middle
    draw.line([(left_x, mid1_y), (left_x, mid1_y)], fill=blue, width=mid_stroke)
    
    draw.arc([left_x, mid2_y - ellipse_ry, right_x, mid2_y + ellipse_ry], start=0, end=180, fill=blue, width=mid_stroke)
    
    # Connection dots
    dot_r = max(3, int(8 * s))
    draw.ellipse([left_x - dot_r, int(340*s) - dot_r, left_x + dot_r, int(340*s) + dot_r], fill=orange)
    draw.ellipse([right_x - dot_r, int(340*s) - dot_r, right_x + dot_r, int(340*s) + dot_r], fill=orange)
    
    # Bottom decorative lines (table grid hint)
    line_y_start = int(720 * s)
    for i, (w_factor, alpha) in enumerate([(0.63, 255), (0.52, 153), (0.40, 77)]):
        y = line_y_start + i * int(24 * s)
        w = int(324 * s * w_factor)
        x1 = cx - w // 2
        x2 = cx + w // 2
        line_h = max(2, int(8 * s))
        draw.rounded_rectangle([x1, y, x2, y + line_h], radius=line_h // 2, fill=(51, 51, 56, alpha))
    
    return img

# Generate all required sizes
sizes = {
    '32x32.png': 32,
    '128x128.png': 128,
    '128x128@2x.png': 256,
    'icon.png': 512,
}

for filename, size in sizes.items():
    img = draw_icon(size)
    img.save(os.path.join(ICONS_DIR, filename))
    print(f"Generated {filename} ({size}x{size})")

# Generate 1024x1024 for icns
img_1024 = draw_icon(1024)
img_1024.save(os.path.join(ICONS_DIR, 'icon_1024.png'))
print("Generated icon_1024.png (1024x1024)")

print("\nAll icons generated successfully!")
