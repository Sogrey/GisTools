"""
应用配置文件
"""
from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # 服务配置
    HOST: str = "0.0.0.0"
    PORT: int = 8001
    RELOAD: bool = True  # 开发时启用热重载

    # CORS配置
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    # 上传配置
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    # 后端在 GisTools 目录下运行，uploads 和 temp 就在同级目录
    # __file__ = D:\github\gis\gis-tools\GisTools\app\core\config.py
    # _BASE_DIR = D:\github\gis\gis-tools\GisTools
    _CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
    _APP_DIR = os.path.dirname(_CONFIG_DIR)
    _BASE_DIR = os.path.dirname(_APP_DIR)  # D:\github\gis\gis-tools\GisTools
    UPLOAD_DIR: str = os.path.join(_BASE_DIR, "uploads")
    TEMP_DIR: str = os.path.join(_BASE_DIR, "temp")

    # 处理配置
    MAX_FILE_COUNT: int = 10

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()

# 打印路径信息
print(f"[配置] _BASE_DIR: {settings._BASE_DIR}")
print(f"[配置] UPLOAD_DIR: {settings.UPLOAD_DIR}")
print(f"[配置] TEMP_DIR: {settings.TEMP_DIR}")
print(f"[配置] UPLOAD_DIR 绝对路径: {os.path.abspath(settings.UPLOAD_DIR)}")

# 创建必要的目录
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.TEMP_DIR, exist_ok=True)
