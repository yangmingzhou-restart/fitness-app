import json
import logging
from typing import List, Union
from openai import OpenAI
from models.analysis import FoodItem, Macros
from .base import BaseEngine
from config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_SINGLE = """你是一个专业的食物营养分析助手。你需要：
1. 识别图片中的所有食物
2. 判断食物种类和中英文名称
3. 仅根据图片视觉信息，估计当前盘中每种食物的重量（克）
4. 估算每种食物每100克所含的蛋白质、碳水化合物和脂肪克数
5. 根据估重计算每种食物的总蛋白质、总碳水、总脂肪

重要：图片中的食物均为已烹饪/煮熟后的状态。你必须按照熟食的营养成分来估算。
例如：米饭是已煮熟的状态（约28-30g碳水/100g），不是生米；肉类是已煎/煮/炒熟的状态。

注意：热量值由系统根据营养成分自动计算，你不需要估算热量。

必须严格按照以下JSON格式返回，不要包含额外文字：
{
  "foods": [
    {
      "name": "食物中文名",
      "nameEn": "Food English Name",
      "category": "分类中文",
      "categoryEn": "category English",
      "estimatedWeightG": 200,
      "confidence": 0.95,
      "reasoning": "分析依据",
      "proteinGPer100g": 4.5,
      "carbsGPer100g": 3.0,
      "fatGPer100g": 6.0,
      "proteinG": 9.0,
      "carbsG": 6.0,
      "fatG": 12.0
    }
  ]
}"""

SYSTEM_PROMPT_MULTI = """你是一个专业的食物营养分析助手。以下是从不同角度拍摄的同一份食物的多张照片。

你需要综合分析所有照片，更准确地：
1. 识别食物种类（综合多角度信息判断）
2. 给出中英文名称和分类
3. 根据多角度视觉信息，更准确地估计当前盘中每种食物的重量（克）
4. 估算每种食物每100克所含的蛋白质、碳水化合物和脂肪克数
5. 根据估重计算每种食物的总蛋白质、总碳水、总脂肪

多角度分析可以大幅提高估重准确性，请充分利用不同角度的视觉信息。

重要：图片中的食物均为已烹饪/煮熟后的状态。你必须按照熟食的营养成分来估算。
例如：米饭是已煮熟的状态（约28-30g碳水/100g），不是生米；肉类是已煎/煮/炒熟的状态。

注意：热量值由系统根据营养成分自动计算，你不需要估算热量。

必须严格按照以下JSON格式返回，不要包含额外文字：
{
  "foods": [
    {
      "name": "食物中文名",
      "nameEn": "Food English Name",
      "category": "分类中文",
      "categoryEn": "category English",
      "estimatedWeightG": 200,
      "confidence": 0.95,
      "reasoning": "结合多角度视觉信息后的分析依据",
      "proteinGPer100g": 4.5,
      "carbsGPer100g": 3.0,
      "fatGPer100g": 6.0,
      "proteinG": 9.0,
      "carbsG": 6.0,
      "fatG": 12.0
    }
  ]
}"""


class QwenEngine(BaseEngine):
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            self._client = OpenAI(
                api_key=settings.DASHSCOPE_API_KEY,
                base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            )
        return self._client

    @property
    def name(self) -> str:
        return "qwen"

    async def analyze(
        self, images: Union[str, List[str]], language: str = "zh"
    ) -> List[FoodItem]:
        client = self._get_client()

        image_list: List[str] = [images] if isinstance(images, str) else images

        lang_instruction = ""
        if language == "zh":
            lang_instruction = "请使用中文回复，食物名称返回中英文。"
        else:
            lang_instruction = "Please reply in English, return food names in both Chinese and English."

        is_multi = len(image_list) > 1
        base_prompt = SYSTEM_PROMPT_MULTI if is_multi else SYSTEM_PROMPT_SINGLE
        full_prompt = f"{base_prompt}\n\n{lang_instruction}"

        content: list = [{"type": "text", "text": full_prompt}]
        for img in image_list:
            content.append(
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}}
            )

        try:
            response = client.chat.completions.create(
                model="qwen3-vl-plus",
                messages=[{"role": "user", "content": content}],
                temperature=0.1,
                max_tokens=2048,
            )

            raw_text = response.choices[0].message.content.strip()
            raw_text = raw_text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()

            parsed = json.loads(raw_text)
            foods_data = parsed.get("foods", [])

            # 热量转换系数 (kcal/g): 蛋白质4, 碳水4, 脂肪9
            KCAL_PER_G_PROTEIN = 4
            KCAL_PER_G_CARBS = 4
            KCAL_PER_G_FAT = 9

            foods = []
            for item in foods_data:
                protein_g = float(item.get("proteinG", 0))
                carbs_g = float(item.get("carbsG", 0))
                fat_g = float(item.get("fatG", 0))
                protein_per100 = float(item.get("proteinGPer100g", 0))
                carbs_per100 = float(item.get("carbsGPer100g", 0))
                fat_per100 = float(item.get("fatGPer100g", 0))

                # 本地计算热量，不依赖AI返回的热量值
                estimated_cal = protein_g * KCAL_PER_G_PROTEIN + carbs_g * KCAL_PER_G_CARBS + fat_g * KCAL_PER_G_FAT
                calories_per_kg = (protein_per100 * KCAL_PER_G_PROTEIN + carbs_per100 * KCAL_PER_G_CARBS + fat_per100 * KCAL_PER_G_FAT) * 10

                food = FoodItem(
                    name=item.get("name", ""),
                    nameEn=item.get("nameEn", ""),
                    category=item.get("category", ""),
                    categoryEn=item.get("categoryEn", ""),
                    caloriesPerKg=round(calories_per_kg, 1),
                    estimatedWeightG=float(item.get("estimatedWeightG", 0)),
                    estimatedCalories=round(estimated_cal, 1),
                    confidence=float(item.get("confidence", 0)),
                    reasoning=item.get("reasoning", ""),
                    macros=Macros(
                        proteinGPer100g=protein_per100,
                        carbsGPer100g=carbs_per100,
                        fatGPer100g=fat_per100,
                        proteinG=protein_g,
                        carbsG=carbs_g,
                        fatG=fat_g,
                    ),
                )
                foods.append(food)

            return foods

        except json.JSONDecodeError as e:
            logger.error(f"Qwen 返回解析失败: {e}, raw: {raw_text}")
            raise ValueError(f"无法解析AI返回结果: {e}")
        except Exception as e:
            logger.error(f"Qwen API 调用失败: {e}")
            raise
