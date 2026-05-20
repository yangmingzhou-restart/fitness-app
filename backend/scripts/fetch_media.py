"""
Download exercise images and demo videos for all 205 exercises.

Sources:
  1. Free Exercise DB (Unlicense) — 873 exercises, 2 images each
  2. Exercises Dataset (MIT) — 1411 exercise GIFs → convert to MP4

Output: TrainingVideos/{exercise_name}/封面.jpg + {angle}.mp4
"""

import json
import os
import sys
import time
import shutil
import subprocess
import tempfile
from pathlib import Path
from difflib import SequenceMatcher
from io import BytesIO

import requests
from PIL import Image

# ---- Config ----

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
VIDEOS_DIR = BACKEND_DIR / "TrainingVideos"
EXERCISES_JSON = VIDEOS_DIR / "exercises.json"

FREE_EXERCISE_DB_URL = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json"
FREE_EXERCISE_IMG_BASE = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises"
EXERCISES_DATASET_URL = "https://cdn.jsdelivr.net/gh/azilRababe/Exercises_Dataset@main/gifs_data.json"

# Image optimization
COVER_WIDTH = 800
COVER_HEIGHT = 600
JPEG_QUALITY = 80

# Rate limiting
REQUEST_DELAY = 0.3  # seconds between HTTP requests

# ---- Helpers ----

def normalize(text: str) -> str:
    """Normalize text for matching: lowercase, remove punctuation."""
    return ''.join(c.lower() for c in text if c.isalnum() or c.isspace())

def similarity(a: str, b: str) -> float:
    """Fuzzy match score between two strings, 0-1."""
    return SequenceMatcher(None, normalize(a), normalize(b)).ratio()

def find_best_match(name_en: str, candidates: list[dict], key: str = 'name', min_score: float = 0.6) -> dict | None:
    """Find the best matching exercise from a candidate list by English name."""
    best, best_score = None, 0
    for c in candidates:
        score = similarity(name_en, c.get(key, ''))
        if score > best_score:
            best_score = score
            best = c
    return best if best_score >= min_score else None

def download_file(url: str, dest: Path) -> bool:
    """Download a file to dest. Returns True on success."""
    try:
        resp = requests.get(url, timeout=30, stream=True)
        resp.raise_for_status()
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, 'wb') as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)
        return True
    except Exception as e:
        print(f"    download error: {e}")
        return False

def download_image(url: str) -> Image.Image | None:
    """Download an image and return as PIL Image."""
    try:
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return Image.open(BytesIO(resp.content))
    except Exception as e:
        print(f"    download error: {e}")
        return None

def optimize_cover(img: Image.Image, dest: Path) -> bool:
    """Resize and save cover image as optimized JPG."""
    try:
        img = img.convert('RGB')
        img.thumbnail((COVER_WIDTH, COVER_HEIGHT), Image.LANCZOS)
        # Pad to exact dimensions with white background
        canvas = Image.new('RGB', (COVER_WIDTH, COVER_HEIGHT), (255, 255, 255))
        x = (COVER_WIDTH - img.width) // 2
        y = (COVER_HEIGHT - img.height) // 2
        canvas.paste(img, (x, y))
        dest.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(dest, 'JPEG', quality=JPEG_QUALITY, optimize=True)
        return True
    except Exception as e:
        print(f"    optimize error: {e}")
        return False

def convert_gif_to_mp4(gif_path: Path, mp4_path: Path) -> bool:
    """Convert GIF to MP4 using ffmpeg."""
    try:
        mp4_path.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([
            'ffmpeg', '-y', '-i', str(gif_path),
            '-vf', 'scale=480:-2,fps=15',
            '-c:v', 'libx264', '-crf', '28',
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
            '-an',
            str(mp4_path)
        ], check=True, capture_output=True, timeout=60)
        return True
    except Exception as e:
        print(f"    ffmpeg error: {e}")
        return False

def has_ffmpeg() -> bool:
    return shutil.which('ffmpeg') is not None

# ---- Main ----

def load_exercise_db() -> list:
    """Load Free Exercise DB combined JSON."""
    print(f"Fetching Free Exercise DB...")
    resp = requests.get(FREE_EXERCISE_DB_URL, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    print(f"  {len(data)} exercises loaded")
    return data

def load_gif_data() -> list:
    """Load Exercises Dataset GIF metadata."""
    print(f"Fetching Exercises Dataset...")
    resp = requests.get(EXERCISES_DATASET_URL, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    print(f"  {len(data)} exercises with GIFs loaded")
    return data

def process_exercise(
    ex: dict,
    free_db: list,
    gif_data: list,
    stats: dict,
):
    """Process a single exercise: download cover + videos, create folder."""
    name = ex['name']
    name_en = ex.get('nameEn', '')
    folder = VIDEOS_DIR / name

    # Skip if already has media
    if folder.exists():
        has_cover = any(
            f.name.startswith('封面')
            for f in folder.iterdir()
            if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')
        )
        has_videos = any(
            f.suffix.lower() in ('.mp4', '.gif', '.webm')
            for f in folder.iterdir()
        )
        if has_cover and has_videos:
            print(f"  [skip] already complete")
            stats['skipped'] += 1
            return
        if has_cover:
            print(f"  cover exists, looking for videos...")

    print(f"  {name} ({name_en})")

    # ---- Cover image from Free Exercise DB ----
    cover_downloaded = False
    if name_en:
        match = find_best_match(name_en, free_db, key='name')
        if match and match.get('images'):
            img_path = match['images'][0]  # Use first image as cover
            img_url = f"{FREE_EXERCISE_IMG_BASE}/{img_path}"
            print(f"    matched: {match['name']} (score={similarity(name_en, match['name']):.2f})")
            print(f"    downloading cover: {img_url}")
            img = download_image(img_url)
            if img:
                cover_dest = folder / '封面.jpg'
                if optimize_cover(img, cover_dest):
                    size_kb = cover_dest.stat().st_size // 1024
                    print(f"    cover saved: {size_kb} KB")
                    cover_downloaded = True
                    stats['cover_downloaded'] += 1
        else:
            print(f"    no Free Exercise DB match found")
            stats['no_match'] += 1
    else:
        stats['no_match'] += 1

    # ---- Demo GIFs/videos from Exercises Dataset ----
    gif_downloaded = 0
    if name_en:
        gif_match = find_best_match(name_en, gif_data, key='title', min_score=0.55)
        if gif_match and gif_match.get('gif_url'):
            gif_url = gif_match['gif_url']
            print(f"    GIF matched: {gif_match['title']} (score={similarity(name_en, gif_match['title']):.2f})")
            print(f"    downloading GIF: {gif_url}")

            with tempfile.NamedTemporaryFile(suffix='.gif', delete=False) as tmp:
                tmp_path = Path(tmp.name)

            if download_file(gif_url, tmp_path):
                size_kb = tmp_path.stat().st_size // 1024
                print(f"    GIF downloaded: {size_kb} KB")

                if has_ffmpeg():
                    # Convert GIF → MP4 for 侧面 angle
                    mp4_dest = folder / '侧面.mp4'
                    if convert_gif_to_mp4(tmp_path, mp4_dest):
                        size_kb = mp4_dest.stat().st_size // 1024
                        print(f"    MP4 saved: {size_kb} KB (侧面)")
                        gif_downloaded += 1
                        stats['video_downloaded'] += 1
                else:
                    # Keep as GIF — backend supports it
                    gif_dest = folder / '侧面.gif'
                    shutil.move(str(tmp_path), str(gif_dest))
                    print(f"    GIF saved (no ffmpeg), kept as GIF")
                    gif_downloaded += 1
                    stats['video_downloaded'] += 1

            if tmp_path.exists():
                tmp_path.unlink()
        else:
            print(f"    no GIF match found")
    else:
        print(f"    no English name, skipping GIF search")

    if not cover_downloaded and gif_downloaded == 0:
        stats['empty'] += 1

    time.sleep(REQUEST_DELAY)


def main():
    print("=" * 60)
    print("Exercise Media Fetcher")
    print(f"Output dir: {VIDEOS_DIR}")
    print(f"ffmpeg available: {has_ffmpeg()}")
    print("=" * 60)

    # Load sources
    free_db = load_exercise_db()
    gif_data = load_gif_data()

    # Load our exercises
    with open(EXERCISES_JSON, 'r', encoding='utf-8') as f:
        exercises = json.load(f)
    print(f"\nOur exercises: {len(exercises)}")

    # Stats
    stats = {
        'total': len(exercises),
        'skipped': 0,
        'cover_downloaded': 0,
        'video_downloaded': 0,
        'no_match': 0,
        'empty': 0,
    }

    # Process each exercise
    print(f"\nProcessing exercises...\n")
    for i, ex in enumerate(exercises):
        print(f"[{i+1}/{len(exercises)}]", end=" ")
        try:
            process_exercise(ex, free_db, gif_data, stats)
        except Exception as e:
            print(f"  ERROR: {e}")
            stats['empty'] += 1

    # Print summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total exercises:    {stats['total']}")
    print(f"Already complete:    {stats['skipped']}")
    print(f"Covers downloaded:   {stats['cover_downloaded']}")
    print(f"Videos downloaded:   {stats['video_downloaded']}")
    print(f"No match found:      {stats['no_match']}")
    print(f"Still empty:         {stats['empty']}")

    # List empty exercises
    if stats['empty'] > 0:
        print(f"\nExercises with no media:")
        for ex in exercises:
            folder = VIDEOS_DIR / ex['name']
            if not folder.exists() or not any(
                f.name.startswith('封面')
                for f in folder.iterdir()
                if f.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp')
            ):
                print(f"  - {ex['name']} ({ex.get('nameEn', '')})")

    print("\nDone!")


if __name__ == '__main__':
    main()
