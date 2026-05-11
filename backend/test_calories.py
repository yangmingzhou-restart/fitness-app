"""End-to-end test: Full pipeline (AI → DB校准 → 最终结果)"""
import base64, sys, os, io, asyncio
sys.path.insert(0, os.path.dirname(__file__))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from services.analyzer import AnalyzerService

async def main():
    img_path = os.path.join(os.path.dirname(__file__), "..", "测试图片", "1.jpg")
    with open(img_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    svc = AnalyzerService()
    result = await svc.analyze([img_b64], "zh")

    print(f"\n{'='*60}")
    print(f"  最终返回给前端的分析结果")
    print(f"{'='*60}")
    print(f"食物数: {len(result.foods)}")
    print(f"总热量: {result.totalEstimatedCalories:.1f} kcal")
    if result.totalMacros:
        m = result.totalMacros
        print(f"总蛋白: {m.proteinG:.1f}g  总碳水: {m.carbsG:.1f}g  总脂肪: {m.fatG:.1f}g")
    print()

    print(f"{'食物':<14} {'估重':<6} {'蛋白':<8} {'碳水':<8} {'脂肪':<8} {'热量':<10} {'校准':<6}")
    print("-" * 60)
    for f in result.foods:
        m = f.macros
        db_flag = "✓" if "[数据库校准" in f.reasoning else "✗"
        name = f.name[:12]
        print(f"{name:<14} {f.estimatedWeightG:<6.0f} {m.proteinG if m else 0:<8.1f} {m.carbsG if m else 0:<8.1f} {m.fatG if m else 0:<8.1f} {f.estimatedCalories:<10.1f} {db_flag:<6}")

    # Verify: total from sum of individual foods
    sum_cal = sum(f.estimatedCalories for f in result.foods)
    print(f"\n单品热量之和: {sum_cal:.1f} kcal")
    print(f"总热量(宏量计算): {result.totalEstimatedCalories:.1f} kcal")
    print(f"一致: {'✓' if abs(sum_cal - result.totalEstimatedCalories) < 1 else '✗ 偏差=' + str(abs(sum_cal - result.totalEstimatedCalories))}")

asyncio.run(main())
