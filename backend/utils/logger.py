"""
统一日志格式：[时间] [级别] [模块] [追踪ID] 信息
同时输出到控制台和文件 (logs/app.log)
"""
import logging
import os
import time
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler

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
    formatter = FitnessFormatter()

    # 控制台输出
    console = logging.StreamHandler()
    console.setFormatter(formatter)

    # 文件输出（自动轮转，单文件最大 5MB，保留 3 个备份）
    log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "app.log")
    file_handler = RotatingFileHandler(log_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)
    root.addHandler(console)
    root.addHandler(file_handler)
