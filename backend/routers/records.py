import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
from database.crud_exercise import save_exercise_record, get_exercise_records, delete_exercise_record

router = APIRouter()


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
async def create_record(record: ExerciseRecordRequest):
    sets_json = json.dumps([s.model_dump() for s in record.sets], ensure_ascii=False)
    save_exercise_record(
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
    date: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    records = get_exercise_records(date=date, start=start, end=end)
    return {"records": records}


@router.delete("/exercise-records/{record_id}")
async def remove_record(record_id: str):
    ok = delete_exercise_record(record_id)
    return {"success": ok}
