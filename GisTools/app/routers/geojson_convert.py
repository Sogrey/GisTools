"""
GeoJSON转换路由
提供GeoJSON到SHP的转换API接口
"""
import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

from app.core.config import settings

# 尝试导入真实服务，如果失败则使用Mock版本
try:
    from app.services.geojson_service import GeoJsonConverter
    print("[INFO] Using GDAL service for GeoJSON")
    USE_GDAL = True
except ImportError as e:
    print(f"[WARNING] GDAL not available, using Mock service for GeoJSON")
    from app.services.geojson_service_mock import GeoJsonConverter
    USE_GDAL = False

router = APIRouter()


class ConversionResponse(BaseModel):
    """转换响应模型"""
    success: bool
    message: str
    feature_count: int = 0
    geometry_count: int = 0
    file_size: int = 0
    download_url: str | None = None
    geometry_type: str | None = None
    error: str | None = None


class ValidateResponse(BaseModel):
    """验证响应模型"""
    valid: bool
    type: str | None = None
    errors: list = []
    warnings: list = []
    feature_count: int = 0
    geometry_count: int = 0
    invalid_geometry_count: int = 0
    valid_geometry_count: int = 0
    bounds: dict | None = None
    error: str | None = None


@router.post("/to-shp", response_model=ConversionResponse)
async def geojson_to_shp(
    request: Request,
    file: UploadFile = File(...),
    encoding: str = "UTF-8",
    background_tasks: BackgroundTasks = None
):
    """
    将GeoJSON文件转换为SHP格式

    - **file**: GeoJSON文件
    - **encoding**: 输出编码
    """
    try:
        print(f"[后端] ========== 收到请求 =========")
        print(f"[后端] 请求来源: {request.client.host}")
        print(f"[后端] 文件名: {file.filename}")
        print(f"[后端] 文件大小: {file.size}")
        print(f"[后端] 编码: {encoding}")

        # 检查文件扩展名
        if not (file.filename.lower().endswith('.geojson') or file.filename.lower().endswith('.json')):
            print(f"[后端] 错误: 文件扩展名不正确")
            raise HTTPException(status_code=400, detail="只支持.geojson或.json文件")

        # 创建临时目录
        file_id = str(uuid.uuid4())
        temp_dir = os.path.join(settings.TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)
        print(f"[后端] 临时目录: {temp_dir}")

        # 保存主文件
        geojson_path = os.path.join(temp_dir, file.filename)
        with open(geojson_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"[后端] 文件已保存: {geojson_path}")

        # 输出路径
        output_filename = file.filename.replace('.geojson', '.shp')
        output_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{output_filename}")
        print(f"[后端] 输出路径: {output_path}")

        # 执行转换
        print(f"[后端] 开始转换...")
        if not USE_GDAL:
            print(f"[后端] 注意：使用Mock模式，无法生成真正的Shapefile")
        result = GeoJsonConverter.geojson_to_shp(geojson_path, output_path, encoding)

        if not result["success"]:
            print(f"[后端] 转换失败: {result['error']}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail=result["error"])

        print(f"[后端] 转换成功!")
        print(f"[后端] 要素数量: {result['feature_count']}")
        print(f"[后端] 文件大小: {result['file_size']} bytes")

        # 添加清理任务
        if background_tasks:
            background_tasks.add_task(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
            print(f"[后端] 添加清理任务: {temp_dir}")

        # Mock 模式下不提供下载链接
        if not USE_GDAL:
            print(f"[后端] Mock模式：不提供下载链接")
            return ConversionResponse(
                success=True,
                message="Mock转换成功（需要安装GDAL才能生成真正的Shapefile）",
                feature_count=result["feature_count"],
                geometry_count=result.get("geometry_count", result["feature_count"]),
                file_size=result["file_size"],
                download_url=None,
                geometry_type=result.get("geometry_type")
            )

        # 构造下载URL
        download_url = f"/api/download/{os.path.basename(output_path)}"
        print(f"[后端] 下载URL: {download_url}")
        print(f"[后端] ========== 处理完成 =========")

        return ConversionResponse(
            success=True,
            message=result["message"],
            feature_count=result["feature_count"],
            geometry_count=result.get("geometry_count", result["feature_count"]),
            file_size=result["file_size"],
            download_url=download_url,
            geometry_type=result.get("geometry_type")
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[后端] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")


@router.post("/validate", response_model=ValidateResponse)
async def validate_geojson(
    request: Request,
    file: UploadFile = File(...),
):
    """
    验证GeoJSON文件格式和Geometry有效性

    - **file**: GeoJSON文件
    """
    try:
        print(f"[后端] ========== 验证请求 =========")
        print(f"[后端] 文件名: {file.filename}")

        # 检查文件扩展名
        if not (file.filename.lower().endswith('.geojson') or file.filename.lower().endswith('.json')):
            raise HTTPException(status_code=400, detail="只支持.geojson或.json文件")

        # 保存临时文件
        file_id = str(uuid.uuid4())
        temp_dir = os.path.join(settings.TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)

        geojson_path = os.path.join(temp_dir, file.filename)
        with open(geojson_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 执行验证
        print(f"[后端] 开始验证...")
        if not USE_GDAL:
            print(f"[后端] 注意：使用Mock模式")
        result = GeoJsonConverter.validate_geojson(geojson_path)

        # 清理临时文件
        shutil.rmtree(temp_dir, ignore_errors=True)

        print(f"[后端] 验证完成: {result['valid']}")

        return ValidateResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        print(f"[后端] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"验证失败: {str(e)}")
