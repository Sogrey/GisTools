"""
GeoJSON处理路由
提供GeoJSON验证、压缩等功能
"""
import os
import json
import uuid
import shutil
from pathlib import Path
from typing import Dict, Any, List
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class GeoJSONResponse(BaseModel):
    """GeoJSON响应模型"""
    success: bool
    message: str
    error: str = None
    data: Dict[str, Any] = None


class ValidationResult(BaseModel):
    """验证结果模型"""
    valid: bool
    error: str = None
    feature_count: int = 0
    geometry_types: List[str] = []


@router.post("/validate", response_model=ValidationResult)
async def validate_geojson(file: UploadFile = File(...)):
    """
    验证GeoJSON文件格式

    - **file**: GeoJSON文件
    """
    try:
        # 检查文件扩展名
        if not file.filename.lower().endswith(('.geojson', '.json')):
            raise HTTPException(status_code=400, detail="只支持.geojson或.json文件")

        # 读取文件内容
        content = await file.read()
        try:
            geojson_data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError as e:
            return ValidationResult(
                valid=False,
                error=f"JSON格式错误: {str(e)}"
            )

        # 验证GeoJSON结构
        if not isinstance(geojson_data, dict):
            return ValidationResult(valid=False, error="GeoJSON必须是一个对象")

        if "type" not in geojson_data:
            return ValidationResult(valid=False, error="缺少type字段")

        if geojson_data["type"] != "FeatureCollection":
            return ValidationResult(valid=False, error="type必须为FeatureCollection")

        if "features" not in geojson_data:
            return ValidationResult(valid=False, error="缺少features字段")

        if not isinstance(geojson_data["features"], list):
            return ValidationResult(valid=False, error="features必须是一个数组")

        # 统计要素和几何类型
        feature_count = len(geojson_data["features"])
        geometry_types = set()

        for feature in geojson_data["features"]:
            if not isinstance(feature, dict):
                return ValidationResult(valid=False, error="feature必须是一个对象")

            if "geometry" in feature and feature["geometry"]:
                if "type" in feature["geometry"]:
                    geometry_types.add(feature["geometry"]["type"])

        return ValidationResult(
            valid=True,
            feature_count=feature_count,
            geometry_types=list(geometry_types)
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"验证失败: {str(e)}")


@router.post("/minify")
async def minify_geojson(file: UploadFile = File(...)):
    """
    压缩和优化GeoJSON文件

    - **file**: GeoJSON文件
    """
    try:
        # 检查文件扩展名
        if not file.filename.lower().endswith(('.geojson', '.json')):
            raise HTTPException(status_code=400, detail="只支持.geojson或.json文件")

        # 读取并解析文件
        content = await file.read()
        geojson_data = json.loads(content.decode('utf-8'))

        # 压缩：移除空格和缩进
        minified_content = json.dumps(geojson_data, ensure_ascii=False, separators=(',', ':'))

        # 计算压缩率
        original_size = len(content)
        minified_size = len(minified_content.encode('utf-8'))
        compression_ratio = round((1 - minified_size / original_size) * 100, 2) if original_size > 0 else 0

        # 保存压缩后的文件
        file_id = str(uuid.uuid4())
        output_filename = file.filename.replace('.geojson', '.minified.geojson').replace('.json', '.minified.json')
        output_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{output_filename}")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(minified_content)

        download_url = f"/api/download/{os.path.basename(output_path)}"

        return {
            "success": True,
            "message": "压缩成功",
            "original_size": original_size,
            "minified_size": minified_size,
            "compression_ratio": f"{compression_ratio}%",
            "download_url": download_url
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"压缩失败: {str(e)}")


@router.post("/pretty")
async def pretty_geojson(file: UploadFile = File(...), indent: int = 2):
    """
    格式化GeoJSON文件（美化输出）

    - **file**: GeoJSON文件
    - **indent**: 缩进空格数，默认2
    """
    try:
        # 检查文件扩展名
        if not file.filename.lower().endswith(('.geojson', '.json')):
            raise HTTPException(status_code=400, detail="只支持.geojson或.json文件")

        # 读取并解析文件
        content = await file.read()
        geojson_data = json.loads(content.decode('utf-8'))

        # 格式化输出
        pretty_content = json.dumps(geojson_data, ensure_ascii=False, indent=indent)

        # 保存格式化后的文件
        file_id = str(uuid.uuid4())
        output_filename = file.filename.replace('.geojson', '.pretty.geojson').replace('.json', '.pretty.json')
        output_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}_{output_filename}")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(pretty_content)

        download_url = f"/api/download/{os.path.basename(output_path)}"

        return {
            "success": True,
            "message": "格式化成功",
            "download_url": download_url
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"格式化失败: {str(e)}")
