"""
GIS工具箱 - 后端服务主入口
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.routers import shp_convert, geojson_convert

# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行
    print("🚀 GisTools 后端服务启动中...")
    yield
    # 关闭时执行
    print("👋 GisTools 后端服务已关闭")

# 创建FastAPI应用
app = FastAPI(
    title="GisTools API",
    description="GIS工具箱后端服务API",
    version="1.0.0",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(shp_convert.router, prefix="/api/shp", tags=["Shapefile转换"])
app.include_router(geojson_convert.router, prefix="/api/geojson", tags=["GeoJSON处理"])

# 根路由
@app.get("/")
async def root():
    return {
        "message": "GisTools API",
        "version": "1.0.0",
        "docs": "/docs",
        "tools": [
            "/api/shp/to-geojson",
            "/api/geojson/validate",
            "/api/geojson/minify"
        ]
    }

# 健康检查
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        log_level="info"
    )
