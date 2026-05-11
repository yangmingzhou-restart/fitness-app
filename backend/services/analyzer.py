import logging
from typing import List, Optional, Union
from models.analysis import FoodItem, AnalysisResult, Macros
from engines.base import BaseEngine
from engines.qwen_engine import QwenEngine
from engines.gemini_engine import GeminiEngine
from config import settings
from services.nutrition_db import get_nutrition_db

logger = logging.getLogger(__name__)

KCAL_PER_G_PROTEIN = 4
KCAL_PER_G_CARBS = 4
KCAL_PER_G_FAT = 9


def _calc_calories(protein_g: float, carbs_g: float, fat_g: float) -> float:
    return protein_g * KCAL_PER_G_PROTEIN + carbs_g * KCAL_PER_G_CARBS + fat_g * KCAL_PER_G_FAT


def _apply_nutrition_db(foods: List[FoodItem]) -> List[FoodItem]:
    """用本地营养数据库校准 AI 返回的食物营养值。保留 AI 的估重，替换每100g营养数据。"""
    db = get_nutrition_db()
    corrected = 0

    for food in foods:
        match = db.lookup(food.name, food.nameEn)
        if match is None:
            continue

        weight_g = food.estimatedWeightG
        p_per100 = match["proteinGPer100g"]
        c_per100 = match["carbsGPer100g"]
        f_per100 = match["fatGPer100g"]

        # 用数据库每100g值 + AI估重 重新计算总量
        protein_total = p_per100 * weight_g / 100
        carbs_total = c_per100 * weight_g / 100
        fat_total = f_per100 * weight_g / 100
        calories = _calc_calories(protein_total, carbs_total, fat_total)
        calories_per_kg = (p_per100 * KCAL_PER_G_PROTEIN + c_per100 * KCAL_PER_G_CARBS + f_per100 * KCAL_PER_G_FAT) * 10

        food.macros = Macros(
            proteinGPer100g=p_per100,
            carbsGPer100g=c_per100,
            fatGPer100g=f_per100,
            proteinG=round(protein_total, 1),
            carbsG=round(carbs_total, 1),
            fatG=round(fat_total, 1),
        )
        food.estimatedCalories = round(calories, 1)
        food.caloriesPerKg = round(calories_per_kg, 1)
        food.reasoning = f"{food.reasoning} [数据库校准: {match['source']}]"
        corrected += 1
        logger.info(f"数据库校准: {food.name} → {match['source']} (每100g: P{p_per100}/C{c_per100}/F{f_per100})")

    if corrected > 0:
        logger.info(f"共校准 {corrected}/{len(foods)} 种食物")
    return foods


class AnalyzerService:
    def __init__(self):
        self._engine: Optional[BaseEngine] = None

    def _get_engine(self) -> BaseEngine:
        if self._engine is not None:
            return self._engine

        engine_name = settings.ANALYSIS_ENGINE
        if engine_name == "qwen":
            self._engine = QwenEngine()
        elif engine_name == "gemini":
            self._engine = GeminiEngine()
        else:
            logger.warning(f"未知引擎 {engine_name}，使用 Qwen 作为默认")
            self._engine = QwenEngine()

        return self._engine

    def set_engine(self, engine: BaseEngine):
        """允许动态切换引擎（模块化关键）"""
        self._engine = engine

    async def analyze(
        self, images: Union[str, List[str]], language: str = "zh"
    ) -> AnalysisResult:
        engine = self._get_engine()
        count = len(images) if isinstance(images, list) else 1
        logger.info(f"使用引擎: {engine.name} 分析 {count} 张图片")

        foods = await engine.analyze(images, language)

        # 用本地数据库校准常见食物的营养值
        foods = _apply_nutrition_db(foods)

        total_macros = Macros(
            proteinG=sum(f.macros.proteinG for f in foods if f.macros),
            carbsG=sum(f.macros.carbsG for f in foods if f.macros),
            fatG=sum(f.macros.fatG for f in foods if f.macros),
            proteinGPer100g=0,
            carbsGPer100g=0,
            fatGPer100g=0,
        )
        total_calories = _calc_calories(total_macros.proteinG, total_macros.carbsG, total_macros.fatG)

        logger.info(
            f"[总热量对比] 本地计算: {total_calories:.1f}kcal = "
            f"P({total_macros.proteinG:.1f}g×4) + C({total_macros.carbsG:.1f}g×4) + F({total_macros.fatG:.1f}g×9)"
        )

        return AnalysisResult(
            foods=foods,
            totalEstimatedCalories=total_calories,
            totalMacros=total_macros,
            imageCount=count,
            note="估算仅供参考，实际热量可能因烹饪方式、食材配比等因素而有所不同",
        )
