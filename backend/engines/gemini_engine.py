import json
import logging
from typing import List, Union
from google import genai
from models.analysis import FoodItem
from .base import BaseEngine
from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """你是一个专业的食物营养分析助手。你需要：
1. 识别图片中的所有食物
2. 判断食物种类和中英文名称
3. 给出每种食物每1千克的热量值（kcal/kg）
4. 仅根据图片视觉信息，估计当前盘中每种食物的重量（克）
5. 计算每种食物的估算总热量

必须严格按照以下JSON格式返回，不要包含额外文字：
{
  "foods": [
    {
      "name": "食物中文名",
      "nameEn": "Food English Name",
      "category": "分类中文",
      "categoryEn": "category English",
      "caloriesPerKg": 350,
      "estimatedWeightG": 200,
      "estimatedCalories": 70,
      "confidence": 0.95,
      "reasoning": "分析依据"
    }
  ],
  "totalEstimatedCalories": 70
}"""


class GeminiEngine(BaseEngine):
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._client

    @property
    def name(self) -> str:
        return "gemini"

    async def analyze(self, images: Union[str, List[str]], language: str = "zh") -> List[FoodItem]:
        client = self._get_client()

        image_list: List[str] = [images] if isinstance(images, str) else images
        image_data = {"mime_type": "image/jpeg", "data": image_list[0]}

        lang_instruction = ""
        if language == "zh":
            lang_instruction = "请使用中文回复，食物名称返回中英文。"
        else:
            lang_instruction = "Please reply in English, return food names in both Chinese and English."

        full_prompt = f"{SYSTEM_PROMPT}\n\n{lang_instruction}"

        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=[full_prompt, image_data],
            )

            raw_text = response.text.strip()
            raw_text = raw_text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

            parsed = json.loads(raw_text)
            foods_data = parsed.get("foods", [])

            foods = []
            for item in foods_data:
                food = FoodItem(
                    name=item.get("name", ""),
                    nameEn=item.get("nameEn", ""),
                    category=item.get("category", ""),
                    categoryEn=item.get("categoryEn", ""),
                    caloriesPerKg=float(item.get("caloriesPerKg", 0)),
                    estimatedWeightG=float(item.get("estimatedWeightG", 0)),
                    estimatedCalories=float(item.get("estimatedCalories", 0)),
                    confidence=float(item.get("confidence", 0)),
                    reasoning=item.get("reasoning", ""),
                )
                foods.append(food)

            return foods

        except json.JSONDecodeError as e:
            logger.error(f"Gemini 返回解析失败: {e}, raw: {raw_text}")
            raise ValueError(f"无法解析AI返回结果: {e}")
        except Exception as e:
            logger.error(f"Gemini API 调用失败: {e}")
            raise
