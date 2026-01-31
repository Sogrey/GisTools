"""
GeoJSON转换服务 Mock 版本
不依赖 GDAL，用于开发和测试
"""
import os
import json
from typing import Dict, Any


class GeoJsonConverter:
    """GeoJSON文件转换器 Mock 版本"""

    @staticmethod
    def geojson_to_shp(geojson_path: str, output_path: str, encoding: str = "UTF-8") -> Dict[str, Any]:
        """
        Mock: 将GeoJSON文件转换为SHP格式

        Args:
            geojson_path: GeoJSON文件路径
            output_path: 输出SHP文件路径（.shp）
            encoding: 输出文件编码

        Returns:
            转换结果字典
        """
        try:
            print(f"[服务 Mock] ========== 开始转换 =========")
            print(f"[服务 Mock] 输入路径: {geojson_path}")
            print(f"[服务 Mock] 输出路径: {output_path}")
            print(f"[服务 Mock] 编码: {encoding}")

            # 检查文件是否存在
            if not os.path.exists(geojson_path):
                print("[服务 Mock] 错误: 文件不存在")
                return {
                    "success": False,
                    "error": f"GeoJSON文件不存在: {geojson_path}"
                }

            # 读取GeoJSON文件
            print(f"[服务 Mock] 读取GeoJSON文件...")
            with open(geojson_path, 'r', encoding='utf-8') as f:
                geojson_data = json.load(f)

            # 检查GeoJSON格式
            if 'type' not in geojson_data:
                print("[服务 Mock] 错误: 无效的GeoJSON格式")
                return {
                    "success": False,
                    "error": "无效的GeoJSON格式"
                }

            # 获取GeoJSON类型
            geojson_type = geojson_data.get('type')

            # Mock: 模拟转换过程
            print(f"[服务 Mock] GeoJSON类型: {geojson_type}")

            feature_count = 0
            geometry_type = 'Unknown'

            if geojson_type == 'FeatureCollection':
                features = geojson_data.get('features', [])
                feature_count = len(features)
                print(f"[服务 Mock] 要素数量: {feature_count}")

                if features:
                    first_feature = features[0]
                    geometry = first_feature.get('geometry', {})
                    geometry_type = geometry.get('type', 'Unknown')
                    print(f"[服务 Mock] 几何类型: {geometry_type}")

                # Mock: 创建模拟的输出文件（只是空文件用于测试）
                output_dir = os.path.dirname(output_path)
                os.makedirs(output_dir, exist_ok=True)

                # 创建空文件
                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write("# Mock Shapefile - 需要 GDAL 才能真正转换\n")

                # 创建关联文件
                base_path = output_path.replace('.shp', '')
                with open(base_path + '.shx', 'wb') as f:
                    f.write(b'Mock')
                with open(base_path + '.dbf', 'wb') as f:
                    f.write(b'Mock')

            elif geojson_type == 'Feature':
                feature_count = 1
                geometry = geojson_data.get('geometry', {})
                geometry_type = geometry.get('type', 'Unknown')

                # Mock: 创建输出文件
                output_dir = os.path.dirname(output_path)
                os.makedirs(output_dir, exist_ok=True)

                with open(output_path, 'w', encoding='utf-8') as f:
                    f.write("# Mock Shapefile - 需要 GDAL 才能真正转换\n")

            else:
                print(f"[服务 Mock] 警告: 不支持的GeoJSON类型 {geojson_type}")
                return {
                    "success": False,
                    "error": f"不支持的GeoJSON类型: {geojson_type}"
                }

            print("[服务 Mock] ========== 转换完成 =========")
            print(f"[服务 Mock] 要素数量: {feature_count}")

            return {
                "success": True,
                "message": "Mock转换成功（需要安装GDAL才能生成真正的Shapefile）",
                "feature_count": feature_count,
                "output_path": output_path,
                "file_size": os.path.getsize(output_path) if os.path.exists(output_path) else 0,
                "geometry_type": geometry_type
            }

        except Exception as e:
            print(f"[服务 Mock] 异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": f"转换失败: {str(e)}"
            }

    @staticmethod
    def validate_geojson(geojson_path: str) -> Dict[str, Any]:
        """
        Mock: 验证GeoJSON文件格式和Geometry有效性

        Args:
            geojson_path: GeoJSON文件路径

        Returns:
            验证结果
        """
        try:
            print(f"[质检 Mock] ========== 开始验证 =========")
            print(f"[质检 Mock] 文件: {geojson_path}")

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
                results['crs'] = crs.get('properties', {}).get('name', 'Unknown')
                print(f"[质检 Mock] 坐标系: {results['crs']}")
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

                # 计算边界框
                if features:
                    all_coords = []
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
                        print(f"[质检 Mock] 边界框: {results['bounds']}")

            elif geojson_type == 'Feature':
                print(f"[质检 Mock] 单个Feature")
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
                print(f"[质检 Mock] 单个几何对象: {geojson_type}")
                results['geometry_count'] = 1
                results['geometry_type'] = geojson_type

            else:
                results['valid'] = False
                results['error'] = f"不支持的GeoJSON类型: {geojson_type}"

            print(f"[质检 Mock] ========== 验证完成 =========")
            print(f"[质检 Mock] 有效: {results['valid']}")
            print(f"[质检 Mock] 错误数: {len(results['errors'])}")
            print(f"[质检 Mock] 警告数: {len(results['warnings'])}")

            return results

        except json.JSONDecodeError as e:
            return {
                "valid": False,
                "error": f"JSON解析错误: {str(e)}"
            }
        except Exception as e:
            print(f"[质检 Mock] 异常: {str(e)}")
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
