import json
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from database.crud_exercise import save_plan, get_plans

router = APIRouter()


def _get_user_id(request: Request) -> str:
    return request.headers.get("X-User-Id", "default")


class PlanExercise(BaseModel):
    exercise_name: str
    target_sets: int = 3
    target_reps: str = "8-12"
    target_weight: Optional[float] = None
    target_rpe: Optional[int] = None


class PlanRequest(BaseModel):
    id: str
    name: str
    name_en: str = ""
    muscle_group: str
    exercises: List[PlanExercise] = Field(default_factory=list)


@router.post("/plans")
async def create_plan(plan: PlanRequest, request: Request):
    user_id = _get_user_id(request)
    exercises_json = json.dumps([e.model_dump() for e in plan.exercises], ensure_ascii=False)
    await save_plan(
        user_id=user_id,
        plan_id=plan.id,
        name=plan.name,
        name_en=plan.name_en,
        muscle_group=plan.muscle_group,
        exercises_json=exercises_json,
    )
    return {"success": True}


@router.get("/plans")
async def list_plans(request: Request):
    user_id = _get_user_id(request)
    plans = await get_plans(user_id)
    return {"plans": plans}
