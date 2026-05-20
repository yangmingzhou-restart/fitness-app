import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from database.crud_exercise import save_exercise_record, get_exercise_records, delete_exercise_record

router = APIRouter()


def _get_user_id(request: Request) -> str:
    return request.headers.get("X-User-Id", "default")


class ExerciseSet(BaseModel):
    weight: float = 0.0
    reps: int = 0
    rpe: Optional[int] = None
    completed: bool = False


class ExerciseRecordRequest(BaseModel):
    id: str = ""
    exercise_name: str
    date: str
    sets: List[ExerciseSet] = Field(default_factory=list)
    muscle_group: str = ""
    notes: str = ""


@router.post("/exercise-records")
async def create_record(record: ExerciseRecordRequest, request: Request):
    if not record.id or not record.id.strip():
        raise HTTPException(status_code=400, detail="记录ID不能为空")
    user_id = _get_user_id(request)
    sets_json = json.dumps([s.model_dump() for s in record.sets], ensure_ascii=False)
    await save_exercise_record(
        user_id=user_id,
        record_id=record.id,
        exercise_name=record.exercise_name,
        date=record.date,
        sets_json=sets_json,
        muscle_group=record.muscle_group,
        notes=record.notes,
    )
    return {"success": True}


@router.get("/exercise-records")
async def list_records(
    request: Request,
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    user_id = _get_user_id(request)
    records = await get_exercise_records(user_id=user_id, date=date, start=start, end=end)
    return {"records": records}


@router.delete("/exercise-records/{record_id}")
async def remove_record(record_id: str, request: Request):
    user_id = _get_user_id(request)
    ok = await delete_exercise_record(user_id, record_id)
    return {"success": ok}
