from typing import List, Union
from models.analysis import FoodItem
from .base import BaseEngine


class LocalMLEngine(BaseEngine):
    """本地 ML 模型引擎（预留）"""

    @property
    def name(self) -> str:
        return "ml"

    async def analyze(self, images: Union[str, List[str]], language: str = "zh") -> List[FoodItem]:
        raise NotImplementedError("本地ML引擎尚未实现")
