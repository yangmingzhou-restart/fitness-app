import json
import logging
from typing import List
from database.crud import save_analysis, get_history, get_history_count
from models.analysis import AnalysisResult
from models.history import HistoryRecord, HistoryListResponse

logger = logging.getLogger(__name__)


class HistoryService:
    def save(self, image_thumbnail: str, result: AnalysisResult) -> int:
        foods_json = json.dumps([f.model_dump() for f in result.foods], ensure_ascii=False)
        macros_json = json.dumps(result.totalMacros.model_dump(), ensure_ascii=False) if result.totalMacros else "{}"
        record_id = save_analysis(
            image_thumbnail=image_thumbnail,
            foods_json=foods_json,
            total_calories=result.totalEstimatedCalories,
            macros_json=macros_json,
        )
        logger.info(f"保存分析记录: id={record_id}")
        return record_id

    def get_list(self, limit: int = 20, offset: int = 0) -> HistoryListResponse:
        records = get_history(limit, offset)
        total = get_history_count()
        return HistoryListResponse(
            success=True,
            records=records,
            total=total,
        )
