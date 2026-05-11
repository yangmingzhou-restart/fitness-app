"""
Qwen API 测试脚本
用法: python test_qwen.py
从 ../测试图片/ 目录读取图片，调用 Qwen API 分析
"""

import base64
import json
import os
import sys
from pathlib import Path
from openai import OpenAI

# 加载 .env
from dotenv import load_dotenv
load_dotenv()

API_KEY = os.getenv("DASHSCOPE_API_KEY", "")
if not API_KEY:
    print("❌ 错误: DASHSCOPE_API_KEY 未设置，请检查 .env 文件")
    sys.exit(1)

client = OpenAI(
    api_key=API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

IMAGE_DIR = Path(__file__).parent.parent / "测试图片"
if not IMAGE_DIR.exists():
    print(f"❌ 测试图片目录不存在: {IMAGE_DIR}")
    sys.exit(1)

image_files = sorted(IMAGE_DIR.glob("*.jpg")) + sorted(IMAGE_DIR.glob("*.jpeg")) + sorted(IMAGE_DIR.glob("*.png"))
if not image_files:
    print(f"❌ 测试图片目录中没有图片文件: {IMAGE_DIR}")
    sys.exit(1)

print(f"找到 {len(image_files)} 张测试图片:")
for f in image_files:
    print(f"  - {f.name} ({f.stat().st_size / 1024:.1f} KB)")
print()

# 读取并编码所有图片
encoded_images = []
for f in image_files:
    with open(f, "rb") as img_file:
        img_data = img_file.read()
        img_b64 = base64.b64encode(img_data).decode("utf-8")
        encoded_images.append(img_b64)
        print(f"  ✓ {f.name}: base64 编码完成 ({len(img_b64) / 1024:.1f} KB)")

print(f"\n所有图片编码完成，共 {len(encoded_images)} 张")
print()

# ====== 测试1: 单张图片 ======
print("=" * 60)
print("测试1: 发送单张图片 (第1张)")
print("=" * 60)

try:
    content = [
        {"type": "text", "text": (
            "你是一个专业的食物营养分析助手。请识别图片中的所有食物，"
            "给出中英文名称、每千克热量(kcal/kg)、仅根据图片估计的重量(克)和总热量。"
            "务必返回 JSON 格式："
            '{"foods": [{"name":"食物名","nameEn":"English","category":"分类",'
            '"categoryEn":"category","caloriesPerKg":350,"estimatedWeightG":200,'
            '"estimatedCalories":70,"confidence":0.95,"reasoning":"依据"}],'
            '"totalEstimatedCalories":70}'
        )},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded_images[0]}"}}
    ]

    response = client.chat.completions.create(
        model="qwen3-vl-plus",
        messages=[{"role": "user", "content": content}],
        temperature=0.1,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    result = json.loads(raw)
    print(f"  ✅ 解析成功!")
    for food in result.get("foods", []):
        print(f"    食物: {food.get('name', '?')} ({food.get('nameEn', '?')})")
        print(f"    热量: {food.get('caloriesPerKg', '?')} kcal/kg")
        print(f"    估计重量: {food.get('estimatedWeightG', '?')} g")
        print(f"    估计热量: {food.get('estimatedCalories', '?')} kcal")
        print(f"    置信度: {food.get('confidence', '?')}")
        print()
    print(f"  总热量: {result.get('totalEstimatedCalories', '?')} kcal")

except Exception as e:
    print(f"  ❌ 失败: {type(e).__name__}: {e}")

print()

# ====== 测试2: 多张图片 ======
print("=" * 60)
print(f"测试2: 发送 {len(encoded_images)} 张图片 (多角度)")
print("=" * 60)

try:
    content = [
        {"type": "text", "text": (
            "你是一个专业的食物营养分析助手。以下是从不同角度拍摄的同一份食物的多张照片。"
            "请综合分析所有照片，识别食物并估计重量。"
            "务必返回 JSON 格式："
            '{"foods": [{"name":"食物名","nameEn":"English","category":"分类",'
            '"categoryEn":"category","caloriesPerKg":350,"estimatedWeightG":200,'
            '"estimatedCalories":70,"confidence":0.95,"reasoning":"依据"}],'
            '"totalEstimatedCalories":70}'
        )}
    ]
    for enc in encoded_images:
        content.append(
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{enc}"}}
        )

    response = client.chat.completions.create(
        model="qwen3-vl-plus",
        messages=[{"role": "user", "content": content}],
        temperature=0.1,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    result = json.loads(raw)
    print(f"  ✅ {len(image_files)} 张图片分析成功!")
    for food in result.get("foods", []):
        print(f"    食物: {food.get('name', '?')} ({food.get('nameEn', '?')})")
        print(f"    热量: {food.get('caloriesPerKg', '?')} kcal/kg")
        print(f"    估计重量: {food.get('estimatedWeightG', '?')} g")
        print(f"    估计热量: {food.get('estimatedCalories', '?')} kcal")
        print(f"    置信度: {food.get('confidence', '?')}")
        print()
    print(f"  总热量: {result.get('totalEstimatedCalories', '?')} kcal")

except Exception as e:
    print(f"  ❌ 失败: {type(e).__name__}: {e}")

print()
print("=" * 60)
print("测试完成!")
print("=" * 60)
