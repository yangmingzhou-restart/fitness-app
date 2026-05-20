import logging
from fastapi import APIRouter, Query, Request
from models.history import HistoryListResponse
from services.history_service import HistoryService

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_user_id(request: Request) -> str:
    return request.headers.get("X-User-Id", "default")


@router.get("/history", response_model=HistoryListResponse)
async def get_history(
    request: Request,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    user_id = _get_user_id(request)
    return await HistoryService.get_list(user_id, limit=limit, offset=offset)
