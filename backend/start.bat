@echo off
chcp 65001 >nul
echo ========================================
echo   智能食物热量识别 API - 启动脚本
echo ========================================
echo.

:: 使用 conda base 环境的 Python 启动后端
echo [1/2] 正在检查环境...
D:\Anaconda3\python.exe -c "import fastapi; import openai" 2>nul
if %errorlevel% neq 0 (
    echo 错误: 请先安装依赖: conda run -n base pip install fastapi uvicorn python-multipart aiofiles openai
    pause
    exit /b 1
)

:: 检查 .env 是否配置了 API Key
findstr /C:"your_dashscope_api_key_here" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠ 警告: 请先编辑 .env 文件，填入你的阿里云百炼 API Key
    echo   获取地址: https://help.aliyun.com/zh/model-studio/get-api-key
    echo.
)

echo.
echo [2/2] 正在启动服务器...
echo.
D:\Anaconda3\python.exe -u main.py

pause
