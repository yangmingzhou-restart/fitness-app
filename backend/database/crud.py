import json
from datetime import datetime
from typing import List
from .connection import get_db
from models.history import HistoryRecord


async def save_analysis(
    user_id: str, image_thumbnail: str, foods_json: str,
    total_calories: float, macros_json: str = "{}",
) -> int:
    db = await get_db()
    now = datetime.now().isoformat()
    await db.execute(
        "INSERT INTO analysis_history (user_id, image_thumbnail, foods, total_calories, macros, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user_id, image_thumbnail, foods_json, total_calories, macros_json, now),
    )
    row = await db.fetch_one(
        "SELECT id FROM analysis_history WHERE user_id=? ORDER BY id DESC LIMIT 1",
        (user_id,),
    )
    return row["id"] if row else 0


async def get_history(user_id: str, limit: int = 20, offset: int = 0) -> List[HistoryRecord]:
    db = await get_db()
    rows = await db.fetch_all(
        "SELECT id, image_thumbnail, foods, total_calories, macros, created_at FROM analysis_history WHERE user_id=? ORDER BY id DESC LIMIT ? OFFSET ?",
        (user_id, limit, offset),
    )
    return [
        HistoryRecord(
            id=row["id"],
            image_thumbnail=row["image_thumbnail"] or "",
            foods=row["foods"],
            total_calories=row["total_calories"],
            macros=row["macros"] or "{}",
            created_at=row["created_at"],
        )
        for row in rows
    ]


async def get_history_count(user_id: str) -> int:
    db = await get_db()
    val = await db.fetch_val(
        "SELECT COUNT(*) FROM analysis_history WHERE user_id=?",
        (user_id,),
    )
    return val or 0
