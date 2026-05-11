import json
from datetime import datetime
from typing import List
from .connection import get_db
from models.history import HistoryRecord


def save_analysis(image_thumbnail: str, foods_json: str, total_calories: float, macros_json: str = "{}") -> int:
    conn = get_db()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO analysis_history (image_thumbnail, foods, total_calories, macros, created_at) VALUES (?, ?, ?, ?, ?)",
        (image_thumbnail, foods_json, total_calories, macros_json, now),
    )
    conn.commit()
    record_id = cursor.lastrowid
    conn.close()
    return record_id


def get_history(limit: int = 20, offset: int = 0) -> List[HistoryRecord]:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, image_thumbnail, foods, total_calories, macros, created_at FROM analysis_history ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    rows = cursor.fetchall()
    records = []
    for row in rows:
        records.append(HistoryRecord(
            id=row["id"],
            image_thumbnail=row["image_thumbnail"] or "",
            foods=row["foods"],
            total_calories=row["total_calories"],
            macros=row["macros"] or "{}",
            created_at=row["created_at"],
        ))
    conn.close()
    return records


def get_history_count() -> int:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) as count FROM analysis_history")
    result = cursor.fetchone()
    count = result["count"] if result else 0
    conn.close()
    return count
