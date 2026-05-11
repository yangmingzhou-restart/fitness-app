from pydantic import BaseModel, Field
from typing import List, Optional


class Macros(BaseModel):
    proteinG: float = Field(default=0.0, description="总蛋白质 (克)")
    carbsG: float = Field(default=0.0, description="总碳水 (克)")
    fatG: float = Field(default=0.0, description="总脂肪 (克)")
    proteinGPer100g: float = Field(default=0.0, description="每100克蛋白质")
    carbsGPer100g: float = Field(default=0.0, description="每100克碳水")
    fatGPer100g: float = Field(default=0.0, description="每100克脂肪")


class FoodItem(BaseModel):
    name: str = Field(..., description="食物中文名称")
    nameEn: str = Field(..., description="食物英文名称")
    category: str = Field(default="", description="食物分类（中文）")
    categoryEn: str = Field(default="", description="食物分类（英文）")
    caloriesPerKg: float = Field(..., description="每千克热量 (kcal/kg)")
    estimatedWeightG: float = Field(..., description="估计重量 (克)")
    estimatedCalories: float = Field(..., description="估计总热量 (kcal)")
    confidence: float = Field(default=0.0, description="置信度 (0-1)", ge=0, le=1)
    reasoning: str = Field(default="", description="分析依据")
    macros: Optional[Macros] = Field(default=None, description="宏量营养素")


class AnalysisResult(BaseModel):
    foods: List[FoodItem] = Field(default_factory=list, description="识别出的食物列表")
    totalEstimatedCalories: float = Field(default=0.0, description="总热量 (kcal)")
    totalMacros: Optional[Macros] = Field(default=None, description="总宏量营养素")
    imageCount: int = Field(default=1, description="使用的图片数量")
    note: str = Field(default="估算仅供参考", description="备注")


class AnalyzeRequest(BaseModel):
    images: List[str] = Field(..., description="Base64编码的图片数据列表（1-4张）")
    language: str = Field(default="zh", description="语言: zh/en")


class TimingInfo(BaseModel):
    decodeMs: float = Field(default=0, description="图片解码+压缩耗时 (ms)")
    aiTotalMs: float = Field(default=0, description="AI调用+缩略图 并行耗时 (ms)")
    totalMs: float = Field(default=0, description="后端总处理耗时 (ms)")


class AnalyzeResponse(BaseModel):
    success: bool = Field(default=True)
    data: Optional[AnalysisResult] = None
    error: Optional[str] = None
    timing: Optional[TimingInfo] = None
