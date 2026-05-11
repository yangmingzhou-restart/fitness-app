from abc import ABC, abstractmethod
from typing import List, Union
from models.analysis import FoodItem


class BaseEngine(ABC):
    """分析引擎抽象基类 - 所有引擎必须实现此接口"""

    @abstractmethod
    async def analyze(
        self, images: Union[str, List[str]], language: str = "zh"
    ) -> List[FoodItem]:
        """分析图片中的食物

        Args:
            images: Base64编码的图片数据（单张或列表）
            language: 语言 zh/en

        Returns:
            识别出的食物列表
        """

    @property
    @abstractmethod
    def name(self) -> str:
        """引擎名称"""
