"""
GeoJSON转换服务
使用GDAL将GeoJSON转换为SHP
"""
import os
import json
from typing import Dict, Any
from osgeo import ogr
from osgeo import osr


class GeoJsonConverter:
    """GeoJSON文件转换器"""

    @staticmethod
    def geojson_to_shp(geojson_path: str, output_path: str, encoding: str = "UTF-8") -> Dict[str, Any]:
        """
        将GeoJSON文件转换为SHP格式

        Args:
            geojson_path: GeoJSON文件路径
            output_path: 输出SHP文件路径（.shp）
            encoding: 输出文件编码

        Returns:
            转换结果字典
        """
        try:
            print("[服务] ========== 开始转换 =========")
            print(f"[服务] 输入路径: {geojson_path}")
            print(f"[服务] 输出路径: {output_path}")
            print(f"[服务] 编码: {encoding}")

            # 检查文件是否存在
            if not os.path.exists(geojson_path):
                print("[服务] 错误: 文件不存在")
                return {
                    "success": False,
                    "error": f"GeoJSON文件不存在: {geojson_path}"
                }

            # 读取GeoJSON文件
            print("[服务] 读取GeoJSON文件...")
            with open(geojson_path, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)

            # 检查GeoJSON格式
            if 'type' not in geojson_data:
                print("[服务] 错误: 无效的GeoJSON格式")
                return {
                    "success": False,
                    "error": "无效的GeoJSON格式"
                }

            # 获取输出目录（去除.shp扩展名）
            output_dir = os.path.dirname(output_path)
            output_basename = os.path.basename(output_path)
            shp_basename = output_basename.replace('.shp', '')

            print(f"[服务] 输出目录: {output_dir}")
            print(f"[服务] 文件名: {shp_basename}")

            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)

            # 从GeoJSON创建内存中的几何对象
            print("[服务] 创建驱动...")
            driver = ogr.GetDriverByName('ESRI Shapefile')

            # 创建数据源
            data_source = driver.CreateDataSource(output_dir, shp_basename)

            # 获取GeoJSON类型
            geojson_type = geojson_data.get('type')

            if geojson_type == 'FeatureCollection':
                features = geojson_data.get('features', [])
                print(f"[服务] FeatureCollection: {len(features)} 个要素")

                if not features:
                    print("[服务] 警告: 没有要素")
                    return {
                        "success": False,
                        "error": "GeoJSON中没有要素"
                    }

                # 从第一个要素确定几何类型
                first_feature = features[0]
                geometry = first_feature.get('geometry', {})
                geometry_type = geometry.get('type')

                print(f"[服务] 几何类型: {geometry_type}")

                # 映射GeoJSON几何类型到OGR类型
                geometry_type_map = {
                    'Point': ogr.wkbPoint,
                    'MultiPoint': ogr.wkbMultiPoint,
                    'LineString': ogr.wkbLineString,
                    'MultiLineString': ogr.wkbMultiLineString,
                    'Polygon': ogr.wkbPolygon,
                    'MultiPolygon': ogr.wkbMultiPolygon,
                }

                ogr_geometry_type = geometry_type_map.get(geometry_type, ogr.wkbUnknown)

                if ogr_geometry_type == ogr.wkbUnknown:
                    print(f"[服务] 警告: 未知的几何类型 {geometry_type}")
                    # 尝试从所有要素推断
                    for feature in features:
                        geom = feature.get('geometry', {})
                        if geom.get('type') in geometry_type_map:
                            ogr_geometry_type = geometry_type_map[geom.get('type')]
                            break

                # 创建图层
                print("[服务] 创建图层...")
                spatial_ref = osr.SpatialReference()
                spatial_ref.ImportFromEPSG(4326)  # WGS 84

                layer = data_source.CreateLayer(
                    shp_basename,
                    spatial_ref,
                    ogr_geometry_type
                )

                # 定义字段
                print("[服务] 创建字段...")
                # 从第一个要素获取所有属性
                first_feature = features[0]
                properties = first_feature.get('properties', {})

                layer.CreateField(ogr.FieldDefn('id', ogr.OFTInteger))
                for key, value in properties.items():
                    if isinstance(value, str):
                        layer.CreateField(ogr.FieldDefn(key, ogr.OFTString))
                    elif isinstance(value, int):
                        layer.CreateField(ogr.FieldDefn(key, ogr.OFTInteger))
                    elif isinstance(value, float):
                        layer.CreateField(ogr.FieldDefn(key, ogr.OFTReal))
                    else:
                        layer.CreateField(ogr.FieldDefn(key, ogr.OFTString))

                # 添加要素到图层
                print("[服务] 添加要素...")
                for idx, feature in enumerate(features):
                    geometry = feature.get('geometry')
                    properties = feature.get('properties', {})

                    if geometry is None:
                        print(f"[服务] 警告: 要素 {idx} 没有几何")
                        continue

                    # 创建几何对象
                    geom = ogr.CreateGeometryFromJson(json.dumps(geometry))

                    # 创建要素
                    feat = ogr.Feature(layer.GetLayerDefn())

                    # 设置几何
                    feat.SetGeometry(geom)

                    # 设置属性
                    feat.SetField('id', idx + 1)
                    for key, value in properties.items():
                        field_index = feat.GetFieldIndex(key)
                        if field_index >= 0:
                            if isinstance(value, str):
                                feat.SetField(key, str(value))
                            elif isinstance(value, (int, float)):
                                feat.SetField(key, value)

                    # 添加到图层
                    layer.CreateFeature(feat)

                feature_count = len(features)
                print("[服务] ========== 转换完成 =========")
                print(f"[服务] 要素数量: {feature_count}")
                print(f"[服务] 输出文件: {output_path}")

                return {
                    "success": True,
                    "message": "转换成功",
                    "feature_count": feature_count,
                    "output_path": output_path,
                    "file_size": os.path.getsize(output_path) if os.path.exists(output_path) else 0,
                    "geometry_type": geometry_type
                }

            elif geojson_type == 'Feature':
                print("[服务] 单个Feature")

                # 处理单个Feature（包装为FeatureCollection）
                wrapper = {
                    "type": "FeatureCollection",
                    "features": [geojson_data]
                }

                # 递归调用
                temp_geojson = output_path.replace('.shp', '_temp.geojson')
                with open(temp_geojson, 'w', encoding='utf-8') as f:
                    json.dump(wrapper, f, ensure_ascii=False)

                return GeoJsonConverter.geojson_to_shp(temp_geojson, output_path, encoding)

            else:
                print(f"[服务] 错误: 不支持的GeoJSON类型 {geojson_type}")
                return {
                    "success": False,
                    "error": f"不支持的GeoJSON类型: {geojson_type}"
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
    def validate_geojson(geojson_path: str) -> Dict[str, Any]:
        """
        验证GeoJSON文件格式和Geometry有效性

        Args:
            geojson_path: GeoJSON文件路径

        Returns:
            验证结果
        """
        try:
            print("[质检] ========== 开始验证 =========")
            print(f"[质检] 文件: {geojson_path}")

            # 检查文件是否存在
            if not os.path.exists(geojson_path):
                return {
                    "valid": False,
                    "error": "文件不存在"
                }

            # 读取文件
            with open(geojson_path, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)

            # 验证基本结构
            if 'type' not in geojson_data:
                return {
                    "valid": False,
                    "error": "缺少 'type' 字段"
                }

            geojson_type = geojson_data['type']

            results = {
                "valid": True,
                "type": geojson_type,
                "errors": [],
                "warnings": []
            }

            # 检查坐标系统
            if 'crs' in geojson_data:
                crs = geojson_data['crs']
                results['crs'] = crs
                print(f"[质检] 坐标系: {crs.get('properties', {}).get('name', 'Unknown')}")
            else:
                results['warnings'].append("缺少坐标系信息，默认使用 WGS 84")

            # 根据类型验证
            if geojson_type == 'FeatureCollection':
                features = geojson_data.get('features', [])
                results['feature_count'] = len(features)

                if not features:
                    results['warnings'].append("空FeatureCollection（没有要素）")

                # 验证每个要素
                invalid_count = 0
                for idx, feature in enumerate(features):
                    geometry = feature.get('geometry')

                    if geometry is None:
                        results['errors'].append(f"要素 {idx}: 缺少geometry字段")
                        invalid_count += 1
                        continue

                    geom_type = geometry.get('type')

                    # 验证坐标
                    if 'coordinates' not in geometry:
                        results['errors'].append(f"要素 {idx}: 几何类型 {geom_type} 缺少coordinates")
                        invalid_count += 1
                        continue

                    coordinates = geometry['coordinates']

                    # 验证坐标值
                    def validate_coords(coords, depth=0):
                        if isinstance(coords, list):
                            for coord in coords:
                                validate_coords(coord, depth + 1)
                        elif isinstance(coords, (int, float)):
                            pass  # 坐标值
                        else:
                            return False
                        return True

                    if not validate_coords(coordinates):
                        results['errors'].append(f"要素 {idx}: 无效的坐标格式")
                        invalid_count += 1

                results['invalid_geometry_count'] = invalid_count
                results['valid_geometry_count'] = len(features) - invalid_count

            elif geojson_type == 'Feature':
                print("[质检] 单个Feature")
                results['feature_count'] = 1

                geometry = geojson_data.get('geometry')
                if geometry is None:
                    results['errors'].append("缺少geometry字段")
                else:
                    geom_type = geometry.get('type')
                    results['geometry_type'] = geom_type

            elif geojson_type == 'GeometryCollection':
                geometries = geojson_data.get('geometries', [])
                results['geometry_count'] = len(geometries)

            elif geojson_type in ['Point', 'LineString', 'Polygon', 'MultiPoint', 'MultiLineString', 'MultiPolygon']:
                print(f"[质检] 单个几何对象: {geojson_type}")
                results['geometry_count'] = 1
                results['geometry_type'] = geojson_type

            else:
                results['valid'] = False
                results['error'] = f"不支持的GeoJSON类型: {geojson_type}"

            # 计算边界框
            if results['valid'] and geojson_type in ['FeatureCollection', 'GeometryCollection']:
                all_coords = []
                if geojson_type == 'FeatureCollection':
                    features = geojson_data.get('features', [])
                    for feature in features:
                        geometry = feature.get('geometry')
                        if geometry and 'coordinates' in geometry:
                            all_coords.extend(GeoJsonConverter._flatten_coordinates(geometry['coordinates']))

                if all_coords:
                    results['bounds'] = {
                        'min_x': min(c[0] for c in all_coords),
                        'max_x': max(c[0] for c in all_coords),
                        'min_y': min(c[1] for c in all_coords),
                        'max_y': max(c[1] for c in all_coords)
                    }
                    print(f"[质检] 边界框: {results['bounds']}")

            print("[质检] ========== 验证完成 =========")
            print(f"[质检] 有效: {results['valid']}")
            print(f"[质检] 错误数: {len(results['errors'])}")
            print(f"[质检] 警告数: {len(results['warnings'])}")

            return results

        except json.JSONDecodeError as e:
            return {
                "valid": False,
                "error": f"JSON解析错误: {str(e)}"
            }
        except Exception as e:
            print(f"[质检] 异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "valid": False,
                "error": f"验证失败: {str(e)}"
            }

    @staticmethod
    def _flatten_coordinates(coords, depth=0):
        """扁平化坐标数组以计算边界"""
        if depth >= 3:
            return []

        result = []
        if isinstance(coords, list):
            for coord in coords:
                if isinstance(coord, (list, tuple)):
                    if len(coord) == 2 and isinstance(coord[0], (int, float)) and isinstance(coord[1], (int, float)):
                        # 坐标对 [x, y]
                        result.append(coord)
                    else:
                        result.extend(GeoJsonConverter._flatten_coordinates(coord, depth + 1))
        return result
