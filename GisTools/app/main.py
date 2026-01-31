"""
GIS工具箱 - 后端服务主入口
"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.config import settings
from app.routers import shp_convert, geojson_convert, csv_convert

# 检查 GDAL 是否安装
try:
    from osgeo import ogr
    GDAL_VERSION = ogr.__version__
    print(f"[INFO] GDAL {GDAL_VERSION} is installed")
except ImportError:
    GDAL_VERSION = None
    print("[WARNING] GDAL not installed, some features will use Mock mode")
    print("[INFO] See INSTALL_WINDOWS.md to install GDAL")


# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时执行
    print("[INFO] GisTools backend service starting...")
    yield
    # 关闭时执行
    print("[INFO] GisTools backend service stopped")

# 创建FastAPI应用
app = FastAPI(
    title="GisTools API",
    description=f"GIS工具箱后端服务API {'(GDAL ' + GDAL_VERSION + ')' if GDAL_VERSION else '(GDAL Mock Mode)'}",
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

# 根路由
@app.get("/")
async def root():
    return {
        "message": "GisTools API",
        "version": "1.0.0",
        "gdal_version": GDAL_VERSION,
        "gdal_installed": GDAL_VERSION is not None,
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
    return {
        "status": "healthy",
        "gdal_installed": GDAL_VERSION is not None,
        "gdal_version": GDAL_VERSION
    }


# 下载路由（全局）
@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """下载转换后的文件"""
    import os
    from fastapi.responses import FileResponse
    from fastapi import HTTPException

    # 使用绝对路径
    upload_dir = os.path.abspath(settings.UPLOAD_DIR)
    file_path = os.path.join(upload_dir, filename)

    print(f"[下载] 请求文件: {filename}")
    print(f"[下载] 上传目录: {upload_dir}")
    print(f"[下载] 文件路径: {file_path}")
    print(f"[下载] 文件存在: {os.path.exists(file_path)}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        file_path,
        media_type="application/json",
        filename=filename
    )


# 注册路由
app.include_router(shp_convert.router, prefix="/api/shp", tags=["Shapefile转换"])
app.include_router(geojson_convert.router, prefix="/api/geojson", tags=["GeoJSON处理"])
app.include_router(csv_convert.router, prefix="/api/csv", tags=["CSV转换"])

# 打印所有路由
print("\n[INFO] 已注册的路由:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        print(f"  {route.methods} {route.path}")
print()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        log_level="info"
    )

