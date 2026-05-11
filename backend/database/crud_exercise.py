import json
from typing import List, Optional
from .connection import get_db


def save_exercise_record(record_id: str, exercise_name: str, date: str, sets_json: str, muscle_group: str = "", notes: str = "") -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO exercise_records (id, exercise_name, date, sets, muscle_group, notes) VALUES (?, ?, ?, ?, ?, ?)",
        (record_id, exercise_name, date, sets_json, muscle_group, notes),
    )
    conn.commit()
    conn.close()
    return record_id


def get_exercise_records(date: Optional[str] = None, start: Optional[str] = None, end: Optional[str] = None) -> list:
    conn = get_db()
    cursor = conn.cursor()
    conditions = []
    params = []
    if date:
        conditions.append("date = ?")
        params.append(date)
    if start:
        conditions.append("date >= ?")
        params.append(start)
    if end:
        conditions.append("date <= ?")
        params.append(end)
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    cursor.execute(f"SELECT id, exercise_name, date, sets, muscle_group, notes FROM exercise_records{where} ORDER BY date DESC, id", params)
    rows = cursor.fetchall()
    records = []
    for row in rows:
        records.append({
            "id": row["id"],
            "exercise_name": row["exercise_name"],
            "date": row["date"],
            "sets": row["sets"],
            "muscle_group": row["muscle_group"],
            "notes": row["notes"],
        })
    conn.close()
    return records


def delete_exercise_record(record_id: str) -> bool:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM exercise_records WHERE id = ?", (record_id,))
    conn.commit()
    cnt = cursor.rowcount
    conn.close()
    return cnt > 0


def save_plan(plan_id: str, name: str, name_en: str, muscle_group: str, exercises_json: str) -> str:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO exercise_plans (id, name, name_en, muscle_group, exercises) VALUES (?, ?, ?, ?, ?)",
        (plan_id, name, name_en, muscle_group, exercises_json),
    )
    conn.commit()
    conn.close()
    return plan_id


def get_plans() -> list:
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, name_en, muscle_group, exercises FROM exercise_plans")
    rows = cursor.fetchall()
    records = []
    for row in rows:
        records.append({
            "id": row["id"],
            "name": row["name"],
            "name_en": row["name_en"],
            "muscle_group": row["muscle_group"],
            "exercises": row["exercises"],
        })
    conn.close()
    return records
