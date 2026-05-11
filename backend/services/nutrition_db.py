"""食物营养数据库查询服务。

从 data/food_nutrition.json 加载已知食物的营养成分，
通过模糊匹配覆盖 AI 对常见食物的错误估算。
"""
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "food_nutrition.json")


class NutritionDB:
    def __init__(self):
        self._foods: list[dict] = []
        self._loaded = False

    def _load(self):
        if self._loaded:
            return
        if os.path.exists(DB_PATH):
            with open(DB_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._foods = data.get("foods", [])
            logger.info(f"营养数据库已加载 {len(self._foods)} 种食物")
        else:
            logger.warning(f"营养数据库文件不存在: {DB_PATH}")
        self._loaded = True

    def reload(self):
        """重新加载数据库（手动编辑 JSON 后调用）"""
        self._loaded = False
        self._foods = []
        self._load()

    def _normalize(self, text: str) -> str:
        """去除空格、标点，转小写，用于模糊匹配"""
        import re
        return re.sub(r"[\s\-_、，。！？·]+", "", text).lower()

    def lookup(self, food_name: str, food_name_en: str = "") -> Optional[dict]:
        """根据食物名称查找数据库中的营养成分。

        匹配策略（按优先级）：
        1. name / nameEn 精确匹配
        2. aliases 精确匹配
        3. name 包含在 food_name 中（或反之）

        返回格式：{"proteinGPer100g", "carbsGPer100g", "fatGPer100g", "source": "匹配到的数据库名称"}
        未匹配返回 None。
        """
        self._load()

        if not self._foods:
            return None

        name_norm = self._normalize(food_name)
        name_en_norm = self._normalize(food_name_en)

        for entry in self._foods:
            # 主名称精确匹配
            if self._normalize(entry["name"]) == name_norm:
                return self._build_result(entry)
            if food_name_en and self._normalize(entry.get("nameEn", "")) == name_en_norm:
                return self._build_result(entry)

            # 别名精确匹配
            for alias in entry.get("aliases", []):
                if self._normalize(alias) == name_norm:
                    return self._build_result(entry)
                if food_name_en and self._normalize(alias) == name_en_norm:
                    return self._build_result(entry)

        # 第二层：包含匹配（较宽松，但需避免短词误匹配）
        for entry in self._foods:
            entry_name = self._normalize(entry["name"])
            if len(entry_name) >= 2 and entry_name in name_norm:
                return self._build_result(entry)
            if food_name_en:
                entry_en = self._normalize(entry.get("nameEn", ""))
                if len(entry_en) >= 2 and entry_en in name_en_norm:
                    return self._build_result(entry)

            # AI名称包含在数据库名称中（如 AI: "牛排切片" 匹配 "牛排"）
            for alias in entry.get("aliases", []):
                alias_norm = self._normalize(alias)
                if len(alias_norm) >= 2 and alias_norm in name_norm:
                    return self._build_result(entry)

        return None

    def _build_result(self, entry: dict) -> dict:
        return {
            "proteinGPer100g": entry["proteinGPer100g"],
            "carbsGPer100g": entry["carbsGPer100g"],
            "fatGPer100g": entry["fatGPer100g"],
            "source": entry["name"],
        }

    def list_all(self) -> list[dict]:
        self._load()
        return self._foods


# 单例
_nutrition_db: Optional[NutritionDB] = None


def get_nutrition_db() -> NutritionDB:
    global _nutrition_db
    if _nutrition_db is None:
        _nutrition_db = NutritionDB()
    return _nutrition_db
