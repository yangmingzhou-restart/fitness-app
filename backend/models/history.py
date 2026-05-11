from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class HistoryRecord(BaseModel):
    id: int = Field(default=0, description="记录ID")
    image_thumbnail: str = Field(default="", description="缩略图 (Base64)")
    foods: str = Field(default="[]", description="食物列表 (JSON字符串)")
    total_calories: float = Field(default=0.0, description="总热量")
    macros: str = Field(default="{}", description="宏量营养素 (JSON字符串)")
    created_at: str = Field(default="", description="创建时间")


class HistoryListResponse(BaseModel):
    success: bool = Field(default=True)
    records: List[HistoryRecord] = Field(default_factory=list)
    total: int = Field(default=0)
