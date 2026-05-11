import sqlite3
import os
import json
from datetime import datetime
from typing import Optional

DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "food_analyzer.db")


def get_db() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS analysis_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            image_thumbnail TEXT,
            foods TEXT NOT NULL DEFAULT '[]',
            total_calories REAL DEFAULT 0,
            macros TEXT DEFAULT '{}',
            created_at TEXT NOT NULL
        )
    """)
    try:
        cursor.execute("ALTER TABLE analysis_history ADD COLUMN macros TEXT DEFAULT '{}'")
    except Exception:
        pass
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exercise_records (
            id TEXT PRIMARY KEY,
            exercise_name TEXT NOT NULL,
            date TEXT NOT NULL,
            sets TEXT NOT NULL DEFAULT '[]',
            muscle_group TEXT DEFAULT '',
            notes TEXT DEFAULT ''
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exercise_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT DEFAULT '',
            muscle_group TEXT NOT NULL,
            exercises TEXT NOT NULL DEFAULT '[]'
        )
    """)
    conn.commit()
    conn.close()
