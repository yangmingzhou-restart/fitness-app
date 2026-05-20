import json
from typing import List, Optional
from .connection import get_db


async def save_exercise_record(
    user_id: str, record_id: str, exercise_name: str, date: str,
    sets_json: str, muscle_group: str = "", notes: str = "",
) -> str:
    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO exercise_records (id, user_id, exercise_name, date, sets, muscle_group, notes) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (record_id, user_id, exercise_name, date, sets_json, muscle_group, notes),
    )
    return record_id


async def get_exercise_records(
    user_id: str,
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
) -> list:
    db = await get_db()
    conditions = ["user_id=?"]
    params: list = [user_id]
    if date:
        conditions.append("date=?")
        params.append(date)
    if start:
        conditions.append("date>=?")
        params.append(start)
    if end:
        conditions.append("date<=?")
        params.append(end)
    where = " WHERE " + " AND ".join(conditions)
    rows = await db.fetch_all(
        f"SELECT id, exercise_name, date, sets, muscle_group, notes FROM exercise_records{where} ORDER BY date DESC, id",
        tuple(params),
    )
    return [
        {
            "id": row["id"],
            "exercise_name": row["exercise_name"],
            "date": row["date"],
            "sets": row["sets"],
            "muscle_group": row["muscle_group"],
            "notes": row["notes"],
        }
        for row in rows
    ]


async def delete_exercise_record(user_id: str, record_id: str) -> bool:
    db = await get_db()
    cnt = await db.execute(
        "DELETE FROM exercise_records WHERE id=? AND user_id=?",
        (record_id, user_id),
    )
    return cnt > 0


async def save_plan(
    user_id: str, plan_id: str, name: str, name_en: str,
    muscle_group: str, exercises_json: str,
) -> str:
    db = await get_db()
    await db.execute(
        "INSERT OR REPLACE INTO exercise_plans (id, user_id, name, name_en, muscle_group, exercises) VALUES (?, ?, ?, ?, ?, ?)",
        (plan_id, user_id, name, name_en, muscle_group, exercises_json),
    )
    return plan_id


async def get_plans(user_id: str) -> list:
    db = await get_db()
    rows = await db.fetch_all(
        "SELECT id, name, name_en, muscle_group, exercises FROM exercise_plans WHERE user_id=?",
        (user_id,),
    )
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "name_en": row["name_en"],
            "muscle_group": row["muscle_group"],
            "exercises": row["exercises"],
        }
        for row in rows
    ]
