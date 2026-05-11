import asyncio
import base64
import logging
import time
from fastapi import APIRouter, HTTPException, Request
from models.analysis import AnalyzeRequest, AnalyzeResponse, TimingInfo
from services.analyzer import AnalyzerService
from services.history_service import HistoryService
from utils.image import compress_image, create_thumbnail
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter()
analyzer_service = AnalyzerService()
history_service = HistoryService()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_image(request: AnalyzeRequest, req: Request):
    t_total_start = time.time()
    try:
        if not request.images or len(request.images) == 0:
            raise HTTPException(status_code=400, detail="请提供至少一张图片")

        if len(request.images) > 4:
            raise HTTPException(status_code=400, detail="最多支持4张图片同时分析")

        client_compressed = req.headers.get("x-client-compressed") == "true"

        compressed_images = []
        t_decode_start = time.time()
        for i, img_b64 in enumerate(request.images):
            image_data = base64.b64decode(img_b64)
            image_size_mb = len(image_data) / (1024 * 1024)
            if image_size_mb > settings.MAX_IMAGE_SIZE_MB:
                raise HTTPException(
                    status_code=400,
                    detail=f"第{i+1}张图片过大 ({image_size_mb:.1f}MB)，最大支持 {settings.MAX_IMAGE_SIZE_MB}MB",
                )

            if client_compressed:
                compressed_images.append(img_b64)
            else:
                compressed = await asyncio.to_thread(compress_image, image_data, 1024)
                compressed_b64 = base64.b64encode(compressed).decode("utf-8")
                compressed_images.append(compressed_b64)

        t_decode = time.time() - t_decode_start
        logger.info(f"[timing] decode+compress {len(request.images)} images: {t_decode*1000:.0f}ms (client_compressed={client_compressed})")

        # AI 调用和缩略图并行执行
        t_ai_start = time.time()
        first_image_data = base64.b64decode(request.images[0])

        ai_task = analyzer_service.analyze(compressed_images, request.language)
        thumb_task = asyncio.to_thread(create_thumbnail, first_image_data, 200)

        result, thumbnail_bytes = await asyncio.gather(ai_task, thumb_task)
        result.imageCount = len(request.images)
        t_ai = time.time() - t_ai_start
        logger.info(f"[timing] AI + thumbnail (parallel): {t_ai*1000:.0f}ms")

        thumbnail_base64 = base64.b64encode(thumbnail_bytes).decode("utf-8")
        history_service.save(thumbnail_base64, result)

        t_total = time.time() - t_total_start
        logger.info(f"[timing] total /analyze: {t_total*1000:.0f}ms (decode={t_decode*1000:.0f}ms, ai+thumb={t_ai*1000:.0f}ms)")

        timing = TimingInfo(
            decodeMs=round(t_decode * 1000),
            aiTotalMs=round(t_ai * 1000),
            totalMs=round(t_total * 1000),
        )

        return AnalyzeResponse(success=True, data=result, timing=timing)

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"分析失败: {e}")
        return AnalyzeResponse(success=False, error=str(e))
    except Exception as e:
        logger.error(f"分析失败: {e}", exc_info=True)
        return AnalyzeResponse(success=False, error=f"分析失败: {str(e)}")
