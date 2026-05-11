from typing import List, Union
from models.analysis import FoodItem
from .base import BaseEngine


class OpenAIEngine(BaseEngine):
    """OpenAI GPT-4V 引擎（预留）"""

    @property
    def name(self) -> str:
        return "openai"

    async def analyze(self, images: Union[str, List[str]], language: str = "zh") -> List[FoodItem]:
        raise NotImplementedError("OpenAI 引擎尚未实现")
