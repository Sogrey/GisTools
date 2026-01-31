"""
Shapefile转换路由
提供SHP到GeoJSON的转换API接口
"""
import os
import shutil
import uuid
from typing import Dict, Any
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel

from app.core.config import settings

# 尝试导入真实服务，如果失败则使用Mock版本
try:
    from app.services.shp_service import ShpConverter
    print("[INFO] Using GDAL service")
except ImportError:
    from app.services.shp_service_mock import ShpConverter
    print("[WARNING] GDAL not installed, using Mock service (for testing only)")
    print("[INFO] Install GDAL: run 'pip install gdal' or see INSTALL_WINDOWS.md")

router = APIRouter()


class ConversionResponse(BaseModel):
    """转换响应模型"""
    success: bool
    message: str
    feature_count: int = 0
    file_size: int = 0
    download_url: str = None
    error: str = None


@router.post("/info", response_model=Dict[str, Any])
async def get_shp_info(file: UploadFile = File(...)):
    """
    获取SHP文件信息

    - **file**: SHP文件
    """
    try:
        # 检查文件扩展名
        if not file.filename.lower().endswith('.shp'):
            raise HTTPException(status_code=400, detail="只支持.shp文件")

        # 保存上传的文件
        file_id = str(uuid.uuid4())
        temp_dir = os.path.join(settings.TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)

        shp_path = os.path.join(temp_dir, file.filename)

        with open(shp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 获取文件信息
        info = ShpConverter.get_shp_info(shp_path)

        if info is None:
            raise HTTPException(status_code=400, detail="无法读取SHP文件")

        # 清理临时文件
        shutil.rmtree(temp_dir)

        return {
            "success": True,
            "data": info
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/to-geojson", response_model=ConversionResponse)
async def shp_to_geojson(
    request: Request,
    file: UploadFile = File(...),
    encoding: str = "UTF-8",
    background_tasks: BackgroundTasks = None
):
    """
    将SHP文件转换为GeoJSON格式

    - **file**: SHP文件
    - **encoding**: 输出编码，默认UTF-8

    上传SHP文件后，系统会自动查找同目录下的.shx、.dbf、.prj等关联文件
    如果需要完整转换，请确保这些文件都在同一目录
    """
    try:
        print("[后端] ========== 收到请求 =========")
        print(f"[后端] 请求来源: {request.client.host}")
        print(f"[后端] 文件名: {file.filename}")
        print(f"[后端] 文件大小: {file.size} bytes")
        print(f"[后端] 编码: {encoding}")
        print(f"[后端] Content-Type: {file.content_type}")

        # 检查文件扩展名
        if not file.filename.lower().endswith('.shp'):
            print("[后端] 错误: 文件扩展名不正确")
            raise HTTPException(status_code=400, detail="只支持.shp文件")

        # 创建临时目录
        file_id = str(uuid.uuid4())
        temp_dir = os.path.join(settings.TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)
        print(f"[后端] 临时目录: {temp_dir}")

        # 保存主文件
        shp_path = os.path.join(temp_dir, file.filename)
        with open(shp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"[后端] 文件已保存: {shp_path}")

        # 输出路径
        output_filename = file.filename.replace('.shp', '.geojson')
        output_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{output_filename}")
        print(f"[后端] 输出路径: {output_path}")
        print(f"[后端] UPLOAD_DIR: {settings.UPLOAD_DIR}")
        print(f"[后端] UPLOAD_DIR 绝对路径: {os.path.abspath(settings.UPLOAD_DIR)}")

        # 执行转换
        print("[后端] 开始转换...")
        result = ShpConverter.shp_to_geojson(shp_path, output_path, encoding)

        if not result["success"]:
            print(f"[后端] 转换失败: {result['error']}")
            # 清理临时文件
            shutil.rmtree(temp_dir)
            raise HTTPException(status_code=400, detail=result["error"])

        print("[后端] 转换成功!")
        print(f"[后端] 要素数量: {result['feature_count']}")
        print(f"[后端] 文件大小: {result['file_size']} bytes")

        # 添加清理任务
        if background_tasks:
            background_tasks.add_task(lambda: shutil.rmtree(temp_dir, ignore_errors=True))
            print(f"[后端] 添加清理任务: {temp_dir}")

        # 构造下载URL
        download_url = f"/api/download/{os.path.basename(output_path)}"
        print(f"[后端] 下载URL: {download_url}")
        print("[后端] ========== 处理完成 =========")

        return ConversionResponse(
            success=True,
            message=result["message"],
            feature_count=result["feature_count"],
            file_size=result["file_size"],
            download_url=download_url
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[后端] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")

