import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DASHSCOPE_API_KEY: str = os.getenv("DASHSCOPE_API_KEY", "")
    ANALYSIS_ENGINE: str = os.getenv("ANALYSIS_ENGINE", "qwen")
    QWEN_MODEL: str = os.getenv("QWEN_MODEL", "qwen3-vl-plus")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/food_analyzer.db")
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    MAX_IMAGE_SIZE_MB: int = int(os.getenv("MAX_IMAGE_SIZE_MB", "10"))
    MAX_IMAGE_SIZE_BYTES: int = MAX_IMAGE_SIZE_MB * 1024 * 1024
    BASIC_AUTH_USER: str = os.getenv("BASIC_AUTH_USER", "test")
    BASIC_AUTH_PASS: str = os.getenv("BASIC_AUTH_PASS", "ymzandcmftest")


settings = Settings()
