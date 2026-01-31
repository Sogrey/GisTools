"""
CSV转换路由
提供CSV到SHP的转换API接口
"""
import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel

from app.core.config import settings

# 尝试导入真实服务，如果失败则使用Mock版本
try:
    from app.services.csv_service import CsvConverter
    print("[INFO] Using GDAL service for CSV")
except ImportError:
    print("[WARNING] GDAL not installed, CSV conversion not available")

router = APIRouter()


class ConversionResponse(BaseModel):
    """转换响应模型"""
    success: bool
    message: str
    feature_count: int = 0
    file_size: int = 0
    download_url: str = None
    x_field: str = None
    y_field: str = None
    error: str = None


@router.post("/to-shp", response_model=ConversionResponse)
async def csv_to_shp(
    request: Request,
    file: UploadFile = File(...),
    encoding: str = "UTF-8",
    x_field: str = "lon",
    y_field: str = "lat",
    background_tasks: BackgroundTasks = None
):
    """
    将CSV文件转换为SHP格式

    - **file**: CSV文件
    - **encoding**: 输入文件编码
    - **x_field**: X坐标字段名（默认lon）
    - **y_field**: Y坐标字段名（默认lat）
    """
    try:
        print(f"[后端] ========== 收到请求 =========")
        print(f"[后端] 请求来源: {request.client.host}")
        print(f"[后端] 文件名: {file.filename}")
        print(f"[后端] 文件大小: {file.size}")
        print(f"[后端] 编码: {encoding}")
        print(f"[后端] X字段: {x_field}, Y字段: {y_field}")

        # 检查文件扩展名
        if not file.filename.lower().endswith('.csv'):
            print("[后端] 错误: 文件扩展名不正确")
            raise HTTPException(status_code=400, detail="只支持.csv文件")

        # 创建临时目录
        file_id = str(uuid.uuid4())
        temp_dir = os.path.join(settings.TEMP_DIR, file_id)
        os.makedirs(temp_dir, exist_ok=True)
        print(f"[后端] 临时目录: {temp_dir}")

        # 保存主文件
        csv_path = os.path.join(temp_dir, file.filename)
        with open(csv_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"[后端] 文件已保存: {csv_path}")

        # 输出路径
        output_filename = file.filename.replace('.csv', '.shp')
        output_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{output_filename}")
        print(f"[后端] 输出路径: {output_path}")

        # 执行转换
        print("[后端] 开始转换...")
        result = CsvConverter.csv_to_shp(csv_path, output_path, encoding, x_field, y_field)

        if not result["success"]:
            print(f"[后端] 转换失败: {result['error']}")
            shutil.rmtree(temp_dir, ignore_errors=True)
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
            download_url=download_url,
            x_field=x_field,
            y_field=y_field
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[后端] 异常: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"转换失败: {str(e)}")
