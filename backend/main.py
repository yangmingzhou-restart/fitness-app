import base64
import logging
import secrets
import socket
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from database.connection import init_db
from routers.analyze import router as analyze_router
from routers.history import router as history_router
from routers.exercises import router as exercises_router
from routers.records import router as records_router
from routers.plans import router as plans_router
from routers.analytics import router as analytics_router
from config import settings
from utils.logger import setup_logging, set_request_id

setup_logging()
logger = logging.getLogger("main")


def get_lan_ip() -> str:
    """获取本机局域网 IPv4 地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return '127.0.0.1'

# ---- Security Settings ----
ALLOWED_IPS = None #{"10.70.230.216", "127.0.0.1", "::1"}
BASIC_AUTH_USER = "test"
BASIC_AUTH_PASS = "ymzandcmftest"
PUBLIC_PATHS = {"/health", "/"}
PUBLIC_PREFIXES = {"/videos/"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("正在初始化数据库...")
    init_db()
    logger.info("数据库初始化完成")
    lan_ip = get_lan_ip()
    logger.info(f"本机局域网 IP: {lan_ip}")
    logger.info(f"前端 API 地址: http://{lan_ip}:{settings.SERVER_PORT}")
    logger.info(f"健康检查: http://{lan_ip}:{settings.SERVER_PORT}/health")
    yield


app = FastAPI(
    title="智能食物热量识别 API",
    description="拍照识别食物种类并估算热量",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """为每个 HTTP 请求生成追踪 ID"""

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:8]
        set_request_id(rid)
        logger.info(f"{request.method} {request.url.path} from {request.client.host if request.client else '?'}")
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


app.add_middleware(RequestIDMiddleware)


class SecurityMiddleware(BaseHTTPMiddleware):
    """IP whitelist + Basic Auth for all non-public paths."""

    async def dispatch(self, request: Request, call_next):
        if request.url.path in PUBLIC_PATHS or any(request.url.path.startswith(p) for p in PUBLIC_PREFIXES):
            return await call_next(request)

        # 1. IP whitelist check
        client_ip = (
            request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
            or request.headers.get("X-Real-IP", "")
            or request.client.host if request.client else ""
        )
        if ALLOWED_IPS and client_ip and client_ip not in ALLOWED_IPS:
            logger.warning(f"IP 白名单拦截: {client_ip}")
            return Response(
                content='{"detail":"Access denied: IP not in whitelist"}',
                status_code=403,
                media_type="application/json",
            )

        # 2. Basic Auth check
        auth = request.headers.get("Authorization", "")
        expected = "Basic " + base64.b64encode(
            f"{BASIC_AUTH_USER}:{BASIC_AUTH_PASS}".encode()
        ).decode()
        # Use compare_digest to prevent timing attacks
        if not secrets.compare_digest(auth, expected):
            logger.warning(f"认证失败 来源IP: {client_ip}")
            return Response(
                content='{"detail":"Access denied: invalid credentials"}',
                status_code=401,
                media_type="application/json",
                headers={"WWW-Authenticate": "Basic"},
            )

        return await call_next(request)


app.add_middleware(SecurityMiddleware)

app.include_router(analyze_router, tags=["分析"])
app.include_router(history_router, tags=["历史"])
app.include_router(exercises_router, tags=["锻炼"])
app.include_router(records_router, tags=["记录"])
app.include_router(plans_router, tags=["计划"])
app.include_router(analytics_router, tags=["分析"])

import os
videos_path = os.path.join(os.path.dirname(__file__), "TrainingVideos")
if os.path.isdir(videos_path):
    app.mount("/videos", StaticFiles(directory=videos_path), name="videos")


@app.get("/")
async def root():
    return {
        "service": "智能食物热量识别 API",
        "version": "1.0.0",
        "engine": settings.ANALYSIS_ENGINE,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=True,
    )
