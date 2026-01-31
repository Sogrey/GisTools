"""
Shapefile转换服务 - Mock版本（无GDAL）
用于测试和开发，实际功能需要安装GDAL
"""
import json
from typing import Dict, Any, Optional


class ShpConverter:
    """SHP文件转换器 - Mock版本"""

    @staticmethod
    def shp_to_geojson(shp_path: str, output_path: str, encoding: str = "UTF-8") -> Dict[str, Any]:
        """
        将SHP文件转换为GeoJSON格式（Mock版本）

        此版本仅用于测试，生成示例GeoJSON数据
        实际使用需要安装GDAL并使用 shp_service.py
        """
        try:
            # 生成示例GeoJSON数据
            geojson_data = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [116.397428, 39.90923]
                        },
                        "properties": {
                            "name": "示例点1",
                            "id": 1
                        }
                    },
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [116.397428, 39.90923],
                                [116.407428, 39.91923]
                            ]
                        },
                        "properties": {
                            "name": "示例线1",
                            "id": 2
                        }
                    },
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [[
                                [116.397428, 39.90923],
                                [116.407428, 39.90923],
                                [116.407428, 39.91923],
                                [116.397428, 39.91923],
                                [116.397428, 39.90923]
                            ]]
                        },
                        "properties": {
                            "name": "示例面1",
                            "id": 3
                        }
                    }
                ]
            }

            # 写入输出文件
            import os
            output_dir = os.path.dirname(output_path)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)

            print(f"[Mock服务] 保存文件到: {output_path}")
            print(f"[Mock服务] 目录存在: {os.path.exists(output_dir)}")
            print(f"[Mock服务] 目录绝对路径: {os.path.abspath(output_dir)}")

            with open(output_path, "w", encoding=encoding) as f:
                json.dump(geojson_data, f, ensure_ascii=False, indent=2)

            print(f"[Mock服务] 文件已保存，大小: {os.path.getsize(output_path)} bytes")

            return {
                "success": True,
                "message": "转换成功（Mock模式）",
                "feature_count": 3,
                "output_path": output_path,
                "file_size": os.path.getsize(output_path),
                "note": "这是示例数据，实际转换需要安装GDAL"
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"转换失败: {str(e)}"
            }

    @staticmethod
    def get_shp_info(shp_path: str) -> Optional[Dict[str, Any]]:
        """
        获取SHP文件基本信息（Mock版本）
        """
        try:
            import os
            if not os.path.exists(shp_path):
                return None

            return {
                "file_path": shp_path,
                "file_size": os.path.getsize(shp_path),
                "layer_name": "mock_layer",
                "feature_count": 3,
                "geometry_type": "Mixed",
                "fields": [
                    {"name": "id", "type": "Integer", "width": 10},
                    {"name": "name", "type": "String", "width": 50}
                ],
                "srs": {
                    "name": "WGS 84",
                    "auth_name": "EPSG",
                    "auth_code": "4326"
                },
                "note": "这是示例信息，实际信息需要安装GDAL"
            }

        except Exception as e:
            print(f"获取SHP信息失败: {str(e)}")
            return None
