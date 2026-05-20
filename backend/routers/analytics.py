import json
from collections import defaultdict
from datetime import date, timedelta
from fastapi import APIRouter, HTTPException, Query, Request
from database.crud_exercise import get_exercise_records

router = APIRouter()


def _get_user_id(request: Request) -> str:
    return request.headers.get("X-User-Id", "default")


def _parse_date(param: str, label: str) -> date:
    try:
        return date.fromisoformat(param)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail=f"日期格式无效 ({label}): 请使用 YYYY-MM-DD 格式")


@router.get("/analytics/summary")
async def get_summary(
    request: Request,
    start: str = Query(default="", description="Start date YYYY-MM-DD"),
    end: str = Query(default="", description="End date YYYY-MM-DD"),
):
    user_id = _get_user_id(request)

    if not start:
        start = (date.today() - timedelta(days=6)).isoformat()
    if not end:
        end = date.today().isoformat()

    records = await get_exercise_records(user_id=user_id, start=start, end=end)

    # Daily frequency
    daily_map = defaultdict(int)
    for r in records:
        daily_map[r["date"]] += 1

    current = _parse_date(start, "start")
    end_d = _parse_date(end, "end")
    daily_frequency = []
    while current <= end_d:
        d = current.isoformat()
        daily_frequency.append({"date": d, "count": daily_map.get(d, 0)})
        current += timedelta(days=1)

    # Muscle group distribution
    group_map = defaultdict(int)
    for r in records:
        g = r.get("muscle_group", "other") or "other"
        group_map[g] += 1

    muscle_distribution = [
        {"group": k, "count": v} for k, v in sorted(group_map.items(), key=lambda x: -x[1])
    ]

    most_trained = muscle_distribution[0]["group"] if muscle_distribution else ""

    return {
        "totalWorkouts": len(records),
        "dailyFrequency": daily_frequency,
        "muscleGroupDistribution": muscle_distribution,
        "mostTrainedGroup": most_trained,
    }
