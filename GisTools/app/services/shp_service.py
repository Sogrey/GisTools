"""
Shapefile转换服务
使用GDAL将SHP转换为GeoJSON
"""
import os
import json
from typing import Dict, Any, Optional
from osgeo import ogr


class ShpConverter:
    """SHP文件转换器"""

    @staticmethod
    def shp_to_geojson(shp_path: str, output_path: str, encoding: str = "UTF-8") -> Dict[str, Any]:
        """
        将SHP文件转换为GeoJSON格式

        Args:
            shp_path: SHP文件路径
            output_path: 输出GeoJSON文件路径
            encoding: 输出文件编码

        Returns:
            转换结果字典
        """
        try:
            print("[服务] ========== 开始转换 =========")
            print(f"[服务] 输入路径: {shp_path}")
            print(f"[服务] 输出路径: {output_path}")
            print(f"[服务] 编码: {encoding}")

            # 检查文件是否存在
            if not os.path.exists(shp_path):
                print("[服务] 错误: 文件不存在")
                return {
                    "success": False,
                    "error": f"SHP文件不存在: {shp_path}"
                }

            # 打开SHP数据源
            print("[服务] 打开SHP文件...")
            shp_data_source = ogr.Open(shp_path)
            if shp_data_source is None:
                print("[服务] 错误: 无法打开文件")
                return {
                    "success": False,
                    "error": f"无法打开SHP文件: {shp_path}"
                }

            # 获取图层
            shp_layer = shp_data_source.GetLayer()
            layer_name = shp_layer.GetName()
            feature_count = shp_layer.GetFeatureCount()
            geometry_type = ogr.GeometryTypeToName(shp_layer.GetGeomType())
            print(f"[服务] 图层名: {layer_name}")
            print(f"[服务] 几何类型: {geometry_type}")
            print(f"[服务] 要素数量: {feature_count}")

            # 构建GeoJSON结构
            geojson_data = {
                "type": "FeatureCollection",
                "features": []
            }

            # 遍历所有要素
            feature_count = 0
            for feature in shp_layer:
                # 获取几何对象
                geom = feature.GetGeometryRef()
                if geom is None:
                    continue

                # 将几何对象转换为GeoJSON
                feature_json = {
                    "type": "Feature",
                    "geometry": json.loads(geom.ExportToJson()),
                    "properties": {}
                }

                # 提取属性字段
                field_count = feature.GetFieldCount()
                for i in range(field_count):
                    field_defn = feature.GetFieldDefnRef(i)
                    field_name = field_defn.GetName()
                    field_value = feature.GetField(i)

                    # 处理空值
                    if field_value is not None:
                        feature_json["properties"][field_name] = field_value

                geojson_data["features"].append(feature_json)
                feature_count += 1

            # 添加坐标系信息（如果存在）
            spatial_ref = shp_layer.GetSpatialRef()
            if spatial_ref is not None:
                geojson_data["crs"] = {
                    "type": "name",
                    "properties": {
                        "name": spatial_ref.ExportToProj4()
                    }
                }

            # 写入输出文件
            print("[服务] 写入输出文件...")
            output_dir = os.path.dirname(output_path)
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)

            with open(output_path, "w", encoding=encoding) as f:
                json.dump(geojson_data, f, ensure_ascii=False, indent=2)

            # 关闭数据源
            shp_data_source = None

            file_size = os.path.getsize(output_path)
            print("[服务] 转换完成!")
            print(f"[服务] 要素总数: {feature_count}")
            print(f"[服务] 输出文件大小: {file_size} bytes")
            print("[服务] ========== 转换结束 =========")

            return {
                "success": True,
                "message": "转换成功",
                "feature_count": feature_count,
                "output_path": output_path,
                "file_size": file_size
            }

        except Exception as e:
            print(f"[服务] 异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": f"转换失败: {str(e)}"
            }

    @staticmethod
    def get_shp_info(shp_path: str) -> Optional[Dict[str, Any]]:
        """
        获取SHP文件基本信息

        Args:
            shp_path: SHP文件路径

        Returns:
            文件信息字典
        """
        try:
            if not os.path.exists(shp_path):
                return None

            shp_data_source = ogr.Open(shp_path)
            if shp_data_source is None:
                return None

            layer = shp_data_source.GetLayer()

            info = {
                "file_path": shp_path,
                "file_size": os.path.getsize(shp_path),
                "layer_name": layer.GetName(),
                "feature_count": layer.GetFeatureCount(),
                "geometry_type": ogr.GeometryTypeToName(layer.GetGeomType()),
                "fields": [],
                "srs": None
            }

            # 获取字段信息
            layer_defn = layer.GetLayerDefn()
            for i in range(layer_defn.GetFieldCount()):
                field_defn = layer_defn.GetFieldDefnRef(i)
                info["fields"].append({
                    "name": field_defn.GetName(),
                    "type": ogr.GetFieldTypeName(field_defn.GetType()),
                    "width": field_defn.GetWidth()
                })

            # 获取坐标系信息
            spatial_ref = layer.GetSpatialRef()
            if spatial_ref is not None:
                info["srs"] = {
                    "name": spatial_ref.GetName(),
                    "auth_name": spatial_ref.GetAuthorityName(None),
                    "auth_code": spatial_ref.GetAuthorityCode(None)
                }

            # 关闭数据源
            shp_data_source = None

            return info

        except Exception as e:
            print(f"获取SHP信息失败: {str(e)}")
            return None
