"""
统一日志格式：[时间] [级别] [模块] [追踪ID] 信息
"""
import logging
import time
import uuid
from contextvars import ContextVar

# 请求级追踪 ID，无请求时回退到 "SYSTEM"
_request_id: ContextVar[str] = ContextVar("request_id", default="SYSTEM")


def set_request_id(rid: str) -> None:
    _request_id.set(rid)


def get_request_id() -> str:
    return _request_id.get()


class FitnessFormatter(logging.Formatter):
    """自定义格式：[时间] [级别] [模块] [追踪ID] 信息"""

    def format(self, record: logging.LogRecord) -> str:
        ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(record.created))
        level = record.levelname
        module = record.name
        rid = get_request_id()
        msg = record.getMessage()
        return f"{ts} | {level:<5} | {module} | {rid} | {msg}"


def setup_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(FitnessFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    root.addHandler(handler)
