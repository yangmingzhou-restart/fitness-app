"""Database connection factory. Reads DATABASE_URL to select SQLite or PostgreSQL."""

import os
import logging
from config import settings
from .interface import AsyncDatabase
from .sqlite_impl import SQLiteDatabase

logger = logging.getLogger(__name__)

_db: AsyncDatabase | None = None
DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "food_analyzer.db")


def _create_db() -> AsyncDatabase:
    url = settings.DATABASE_URL

    if url.startswith("postgresql://") or url.startswith("postgres://"):
        from .postgres_impl import PostgresDatabase  # lazy import — only needed for PG
        logger.info("使用 PostgreSQL 数据库")
        return PostgresDatabase(url)

    # Default: SQLite
    path = DB_PATH
    if url.startswith("sqlite:///"):
        path = url.replace("sqlite:///", "")
        if not os.path.isabs(path):
            path = os.path.join(os.path.dirname(os.path.dirname(__file__)), path.lstrip("./"))
    logger.info(f"使用 SQLite 数据库: {path}")
    return SQLiteDatabase(path)


async def get_db() -> AsyncDatabase:
    global _db
    if _db is None:
        _db = _create_db()
        await _db.connect()
    return _db


async def init_db():
    db = await get_db()
    is_pg = settings.DATABASE_URL.startswith("postgresql://") or settings.DATABASE_URL.startswith("postgres://")

    if is_pg:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL DEFAULT 'default',
                image_thumbnail TEXT,
                foods TEXT NOT NULL DEFAULT '[]',
                total_calories REAL DEFAULT 0,
                macros TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS exercise_records (
                id TEXT NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                exercise_name TEXT NOT NULL,
                date TEXT NOT NULL,
                sets TEXT NOT NULL DEFAULT '[]',
                muscle_group TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                PRIMARY KEY (id, user_id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS exercise_plans (
                id TEXT NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                name TEXT NOT NULL,
                name_en TEXT DEFAULT '',
                muscle_group TEXT NOT NULL,
                exercises TEXT NOT NULL DEFAULT '[]',
                PRIMARY KEY (id, user_id)
            )
        """)
        for table in ("analysis_history", "exercise_records", "exercise_plans"):
            try:
                await db.execute(
                    f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default'"
                )
            except Exception:
                pass
    else:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL DEFAULT 'default',
                image_thumbnail TEXT,
                foods TEXT NOT NULL DEFAULT '[]',
                total_calories REAL DEFAULT 0,
                macros TEXT DEFAULT '{}',
                created_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS exercise_records (
                id TEXT NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                exercise_name TEXT NOT NULL,
                date TEXT NOT NULL,
                sets TEXT NOT NULL DEFAULT '[]',
                muscle_group TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                PRIMARY KEY (id, user_id)
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS exercise_plans (
                id TEXT NOT NULL,
                user_id TEXT NOT NULL DEFAULT 'default',
                name TEXT NOT NULL,
                name_en TEXT DEFAULT '',
                muscle_group TEXT NOT NULL,
                exercises TEXT NOT NULL DEFAULT '[]',
                PRIMARY KEY (id, user_id)
            )
        """)
        # Add user_id to legacy tables that lack it (one-time migration, safe to re-run)
        for table in ("analysis_history", "exercise_records", "exercise_plans"):
            cols = await db.fetch_all(f"PRAGMA table_info({table})")
            col_names = [c["name"] for c in cols]
            if "user_id" not in col_names:
                await db.execute(
                    f"ALTER TABLE {table} ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default'"
                )

    logger.info("数据库表初始化完成")


async def close_db():
    global _db
    if _db:
        await _db.close()
        _db = None
