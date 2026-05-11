import logging
from fastapi import APIRouter, Query
from models.history import HistoryListResponse
from services.history_service import HistoryService

logger = logging.getLogger(__name__)

router = APIRouter()
history_service = HistoryService()


@router.get("/history", response_model=HistoryListResponse)
async def get_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    return history_service.get_list(limit=limit, offset=offset)
