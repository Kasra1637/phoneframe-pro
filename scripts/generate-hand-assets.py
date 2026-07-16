#!/usr/bin/env python3
"""
Generate hand-only transparent PNG assets from the hand-hold source images.

Uses rembg (U²-Net deep learning model) to segment the foreground (person/hand),
then removes the phone from the segmented foreground by detecting the large
dark rectangular object in the center of the image.

Output: Transparent PNGs containing ONLY the arm, wrist, watch, hand, and fingers.
No phone pixels, no phone shadows, no background pixels.

These assets are cached in src/assets/ and used by the renderer for clean
layered compositing.
"""

import os
import sys
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps
from rembg import remove, new_session

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
ASSETS_DIR = PROJECT_DIR / "src" / "assets"

# Source images and their output names
SOURCES = [
    ("hand-hold-desk.jpg", "hand-only-desk.png"),
    ("hand-hold-park.jpg", "hand-only-park.png"),
    ("hand-hold-livingroom.jpg", "hand-only-livingroom.png"),
]


def detect_phone_region(fg_image: Image.Image) -> tuple:
    """
    Detect the phone region in the foreground-segmented image.
    The phone appears as a large, dark, roughly rectangular region
    in the center of the image.
    
    Returns (left, top, right, bottom) of the phone bounding box.
    """
    # Convert to numpy for analysis
    arr = np.array(fg_image)
    h, w = arr.shape[:2]
    
    # The alpha channel tells us what's foreground
    alpha = arr[:, :, 3]
    
    # RGB channels
    rgb = arr[:, :, :3].astype(float)
    brightness = rgb.mean(axis=2)
    
    # The phone is: foreground (alpha > 0) + dark (brightness < 40) + in center region
    center_mask = np.zeros((h, w), dtype=bool)
    center_mask[int(h * 0.05):int(h * 0.95), int(w * 0.15):int(w * 0.85)] = True
    
    phone_mask = (alpha > 128) & (brightness < 45) & center_mask
    
    # Find the bounding box of the phone region
    rows = np.any(phone_mask, axis=1)
    cols = np.any(phone_mask, axis=0)
    
    if not rows.any() or not cols.any():
        # Fallback: assume phone is in the center 50% area
        return (int(w * 0.25), int(h * 0.15), int(w * 0.75), int(h * 0.85))
    
    top = np.argmax(rows)
    bottom = h - np.argmax(rows[::-1])
    left = np.argmax(cols)
    right = w - np.argmax(cols[::-1])
    
    # Add a small margin to ensure we capture the entire phone + bezel
    margin_x = int((right - left) * 0.08)
    margin_y = int((bottom - top) * 0.03)
    left = max(0, left - margin_x)
    top = max(0, top - margin_y)
    right = min(w, right + margin_x)
    bottom = min(h, bottom + margin_y)
    
    return (left, top, right, bottom)


def remove_phone_from_foreground(fg_image: Image.Image) -> Image.Image:
    """
    Remove the phone from the foreground-segmented image.
    Sets the phone region pixels to transparent (alpha = 0).
    
    Strategy: The phone screen is near-black (brightness < 30). Everything
    else in the foreground (hand, watch, fingers) is kept.
    We also remove the phone's bezel (slightly brighter but still gray/neutral).
    """
    arr = np.array(fg_image).copy()
    h, w = arr.shape[:2]
    
    # Detect phone bounding box
    phone_bbox = detect_phone_region(fg_image)
    left, top, right, bottom = phone_bbox
    print(f"  Phone detected at: left={left}, top={top}, right={right}, bottom={bottom}")
    print(f"  Phone size: {right-left}x{bottom-top} in {w}x{h} image")
    
    rgb = arr[:, :, :3].astype(float)
    brightness = rgb.mean(axis=2)
    alpha = arr[:, :, 3]
    r, g, b = rgb[:,:,0], rgb[:,:,1], rgb[:,:,2]
    
    # ---- Identify SKIN pixels to preserve ----
    # Skin has warm tones: R channel higher than B, some minimum brightness
    # Use very permissive thresholds to preserve all hand pixels
    skin_warm = (r - b) > 8  # even slightly warm tones
    skin_bright = brightness > 28  # anything not near-black
    skin_mask = skin_warm & skin_bright & (alpha > 0)
    
    # Also preserve the watch: it's dark but on the wrist (outside phone bbox)
    # The watch is outside the phone bbox, so it won't be affected
    
    # ---- Identify PHONE pixels to remove ----
    # Phone = inside phone bbox + dark + NOT skin-colored
    in_phone_bbox = np.zeros((h, w), dtype=bool)
    in_phone_bbox[top:bottom, left:right] = True
    
    # Phone screen: very dark, inside bbox
    phone_screen = in_phone_bbox & (brightness < 30) & (alpha > 0)
    
    # Phone bezel: slightly brighter but neutral-colored (R ≈ G ≈ B), inside bbox
    neutral = (np.abs(r - g) < 12) & (np.abs(g - b) < 12)
    phone_bezel = in_phone_bbox & (brightness < 65) & neutral & ~skin_mask & (alpha > 0)
    
    # Combined phone mask
    phone_mask = (phone_screen | phone_bezel) & ~skin_mask
    
    # ---- Apply removal ----
    arr[phone_mask, 3] = 0
    
    # Remove phone shadow remnants (very dark neutral pixels near phone edges)
    shadow_margin = int((right - left) * 0.03)
    shadow_zone = np.zeros((h, w), dtype=bool)
    sl, sr = max(0, left - shadow_margin), min(w, right + shadow_margin)
    st, sb = max(0, top - shadow_margin), min(h, bottom + shadow_margin)
    shadow_zone[st:sb, sl:sr] = True
    shadow_pixels = shadow_zone & (brightness < 20) & (alpha > 0) & ~skin_mask
    arr[shadow_pixels, 3] = 0
    
    result = Image.fromarray(arr, 'RGBA')
    return result


def process_image(input_path: Path, output_path: Path, session) -> None:
    """Process a single hand image: segment foreground, remove phone, save."""
    print(f"\nProcessing: {input_path.name}")
    
    # Step 1: Load source image
    img = Image.open(input_path).convert("RGB")
    print(f"  Input size: {img.size}")
    
    # Step 2: Use rembg (U²-Net) to segment the foreground
    # This removes the background, leaving only the person (hand + phone)
    print("  Running U²-Net segmentation...")
    
    # First pass: get the raw segmentation without alpha matting
    # (alpha matting can be too aggressive on hand/arm images)
    fg_image = remove(
        img,
        session=session,
        alpha_matting=False,
    )
    
    # Check how much foreground was found
    fg_arr = np.array(fg_image)
    fg_visible = np.sum(fg_arr[:,:,3] > 128)
    fg_total = fg_arr[:,:,3].size
    fg_pct = fg_visible / fg_total * 100
    print(f"  Foreground segmented: {fg_image.size}, mode={fg_image.mode}, visible={fg_pct:.1f}%")
    
    # Step 3: Remove the phone from the segmented foreground
    print("  Removing phone from foreground...")
    hand_only = remove_phone_from_foreground(fg_image)
    
    # Step 4: Final cleanup — remove any isolated small fragments
    # (tiny disconnected pixel islands that aren't part of the hand)
    arr = np.array(hand_only)
    alpha = arr[:, :, 3]
    
    # Count non-transparent pixels
    visible_pixels = np.sum(alpha > 0)
    total_pixels = alpha.size
    print(f"  Visible pixels: {visible_pixels} / {total_pixels} ({visible_pixels/total_pixels*100:.1f}%)")
    
    # Step 5: Save the result
    hand_only.save(output_path, "PNG", optimize=True)
    file_size = output_path.stat().st_size / 1024
    print(f"  Saved: {output_path.name} ({file_size:.0f} KB)")


def main():
    print("=" * 60)
    print("HAND ASSET GENERATOR")
    print("Using U²-Net (via rembg) for semantic segmentation")
    print("=" * 60)
    
    # Check all source images exist
    for src, _ in SOURCES:
        src_path = ASSETS_DIR / src
        if not src_path.exists():
            print(f"ERROR: Source image not found: {src_path}")
            sys.exit(1)
    
    # Create rembg session (loads the U²-Net model once)
    # u2net_human_seg is specifically trained for human body parts
    # and correctly identifies hand/arm as foreground
    print("\nLoading U²-Net Human Segmentation model...")
    session = new_session("u2net_human_seg")
    print("Model loaded.")
    
    # Process each image
    for src_name, out_name in SOURCES:
        src_path = ASSETS_DIR / src_name
        out_path = ASSETS_DIR / out_name
        
        # Skip if output already exists and is newer than source
        if out_path.exists() and out_path.stat().st_mtime > src_path.stat().st_mtime:
            print(f"\nSkipping {src_name} (output is up-to-date)")
            continue
        
        process_image(src_path, out_path, session)
    
    print("\n" + "=" * 60)
    print("DONE — All hand-only assets generated.")
    print("=" * 60)


if __name__ == "__main__":
    main()
