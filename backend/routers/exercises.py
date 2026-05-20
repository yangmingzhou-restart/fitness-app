import json
import os
from fastapi import APIRouter, Query

router = APIRouter()
EXERCISES_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TrainingVideos", "exercises.json")
VIDEOS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TrainingVideos")

_exercises_cache: list | None = None
_exercises_mtime: float = 0
_processed_cache: list | None = None
_processed_mtime: float = 0


def _load_exercises() -> list:
    global _exercises_cache, _exercises_mtime
    if not os.path.exists(EXERCISES_JSON_PATH):
        return []
    current_mtime = os.path.getmtime(EXERCISES_JSON_PATH)
    if _exercises_cache is not None and current_mtime == _exercises_mtime:
        return _exercises_cache
    with open(EXERCISES_JSON_PATH, "r", encoding="utf-8") as f:
        _exercises_cache = json.load(f)
        _exercises_mtime = current_mtime
        return _exercises_cache


def _get_folder_name(exercise: dict) -> str | None:
    for key in (exercise.get("id", ""), exercise.get("name", "")):
        if not key:
            continue
        path = os.path.join(VIDEOS_DIR, key)
        if os.path.isdir(path):
            return key
    return None


VIDEO_EXTS = ('.mp4', '.gif', '.webm')

def _get_videos(folder_name: str) -> list:
    if not folder_name:
        return []
    folder = os.path.join(VIDEOS_DIR, folder_name)
    videos = []
    for fname in sorted(os.listdir(folder)):
        for ext in VIDEO_EXTS:
            if fname.endswith(ext):
                angle = fname.replace(ext, '')
                videos.append({"angle": angle, "url": f"/videos/{folder_name}/{fname}"})
                break
    return videos


IMAGE_EXTS = ('png', 'jpg', 'jpeg', 'webp')

def _get_cover(folder_name: str) -> str:
    if not folder_name:
        return ''
    folder = os.path.join(VIDEOS_DIR, folder_name)
    for fname in sorted(os.listdir(folder)):
        if fname.startswith('封面'):
            ext = fname.rsplit('.', 1)[-1].lower()
            if ext in IMAGE_EXTS:
                return f"/videos/{folder_name}/{fname}"
    return ''


def _get_processed_exercises() -> list:
    """Build fully processed exercise list with videos/coverImage pre-computed.
    Cached globally so filesystem ops only happen once, not per request."""
    global _processed_cache, _processed_mtime
    current_mtime = os.path.getmtime(EXERCISES_JSON_PATH) if os.path.exists(EXERCISES_JSON_PATH) else 0
    if _processed_cache is not None and current_mtime == _processed_mtime:
        return _processed_cache
    exercises = _load_exercises()
    for ex in exercises:
        folder_name = _get_folder_name(ex)
        ex["videos"] = _get_videos(folder_name)
        ex["coverImage"] = _get_cover(folder_name)
    _processed_cache = exercises
    _processed_mtime = current_mtime
    return _processed_cache


def fuzzy_match(text: str, query: str) -> bool:
    ti = 0
    for qi in range(len(query)):
        while ti < len(text) and text[ti] != query[qi]:
            ti += 1
        if ti >= len(text):
            return False
        ti += 1
    return True


@router.get("/exercises")
async def get_exercises(
    muscle_group: str = Query(default="", description="Filter by muscle group"),
    search: str = Query(default="", description="Fuzzy search by name"),
):
    exercises = _get_processed_exercises()
    results = []
    for ex in exercises:
        if muscle_group and ex.get("muscleGroup", "") != muscle_group:
            continue
        if search:
            q = search.lower()
            name = ex.get("name", "").lower()
            name_en = ex.get("nameEn", "").lower()
            mg = ex.get("muscleGroup", "").lower()
            if q not in name and q not in name_en and q not in mg:
                if not (fuzzy_match(name, q) or fuzzy_match(name_en, q)):
                    continue
        results.append(ex)
    return {"exercises": results}


@router.get("/exercises/{exercise_id}")
async def get_exercise_detail(exercise_id: str):
    exercises = _get_processed_exercises()
    for ex in exercises:
        if ex.get("id", "") == exercise_id:
            return ex
    return {"error": "not found"}
