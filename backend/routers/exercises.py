import json
import os
from fastapi import APIRouter, Query

router = APIRouter()
EXERCISES_JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TrainingVideos", "exercises.json")
VIDEOS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "TrainingVideos")


def _load_exercises() -> list:
    if not os.path.exists(EXERCISES_JSON_PATH):
        return []
    with open(EXERCISES_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_folder_name(exercise: dict) -> str | None:
    """Try exercise id first, then Chinese name, to find matching video folder."""
    for key in (exercise.get("id", ""), exercise.get("name", "")):
        if not key:
            continue
        path = os.path.join(VIDEOS_DIR, key)
        if os.path.isdir(path):
            return key
    return None


def _get_videos(exercise: dict) -> list:
    folder_name = _get_folder_name(exercise)
    if not folder_name:
        return []
    folder = os.path.join(VIDEOS_DIR, folder_name)
    videos = []
    for fname in sorted(os.listdir(folder)):
        if fname.endswith(".mp4"):
            angle = fname.replace(".mp4", "")
            videos.append({"angle": angle, "url": f"/videos/{folder_name}/{fname}"})
    return videos


def _has_cover(exercise: dict) -> bool:
    folder_name = _get_folder_name(exercise)
    if not folder_name:
        return False
    cover_path = os.path.join(VIDEOS_DIR, folder_name, "封面.png")
    return os.path.exists(cover_path)


@router.get("/exercises")
async def get_exercises(
    muscle_group: str = Query(default="", description="Filter by muscle group"),
    search: str = Query(default="", description="Fuzzy search by name"),
):
    exercises = _load_exercises()
    results = []
    for ex in exercises:
        # filter
        if muscle_group and ex.get("muscleGroup", "") != muscle_group:
            continue
        if search:
            q = search.lower()
            name = ex.get("name", "").lower()
            name_en = ex.get("nameEn", "").lower()
            mg = ex.get("muscleGroup", "").lower()
            if q not in name and q not in name_en and q not in mg:
                # simple fuzzy: sequential character match
                def fuzzy_match(text: str, query: str) -> bool:
                    ti = 0
                    for qi in range(len(query)):
                        while ti < len(text) and text[ti] != query[qi]:
                            ti += 1
                        if ti >= len(text):
                            return False
                        ti += 1
                    return True
                if not (fuzzy_match(name, q) or fuzzy_match(name_en, q)):
                    continue
        ex["videos"] = _get_videos(ex)
        ex["coverImage"] = f"/videos/{_get_folder_name(ex)}/封面.png" if _has_cover(ex) else ""
        results.append(ex)
    return {"exercises": results}


@router.get("/exercises/{exercise_id}")
async def get_exercise_detail(exercise_id: str):
    exercises = _load_exercises()
    for ex in exercises:
        if ex.get("id", "") == exercise_id:
            ex["videos"] = _get_videos(ex)
            ex["coverImage"] = f"/videos/{_get_folder_name(ex)}/封面.png" if _has_cover(ex) else ""
            return ex
    return {"error": "not found"}
