"""
CSV转换服务
使用GDAL将CSV转换为SHP
"""
import os
import csv
from typing import Dict, Any
from osgeo import ogr
from osgeo import osr


class CsvConverter:
    """CSV文件转换器"""

    @staticmethod
    def csv_to_shp(
        csv_path: str, output_path: str, encoding: str = "UTF-8",
        x_field: str = "lon", y_field: str = "lat"
    ) -> Dict[str, Any]:
        """
        将CSV文件转换为SHP格式

        Args:
            csv_path: CSV文件路径
            output_path: 输出SHP文件路径（.shp）
            encoding: 输入文件编码
            x_field: X坐标字段名（默认lon）
            y_field: Y坐标字段名（默认lat）

        Returns:
            转换结果字典
        """
        try:
            print("[服务] ========== 开始转换 =========")
            print(f"[服务] 输入路径: {csv_path}")
            print(f"[服务] 输出路径: {output_path}")
            print(f"[服务] 编码: {encoding}")
            print(f"[服务] X字段: {x_field}, Y字段: {y_field}")

            # 检查文件是否存在
            if not os.path.exists(csv_path):
                print("[服务] 错误: 文件不存在")
                return {
                    "success": False,
                    "error": f"CSV文件不存在: {csv_path}"
                }

            # 获取输出目录和文件名
            output_dir = os.path.dirname(output_path)
            output_basename = os.path.basename(output_path)
            shp_basename = output_basename.replace('.shp', '')

            print(f"[服务] 输出目录: {output_dir}")
            print(f"[服务] 文件名: {shp_basename}")

            # 创建输出目录
            os.makedirs(output_dir, exist_ok=True)

            # 读取CSV文件
            print("[服务] 读取CSV文件...")
            rows = []
            headers = []

            with open(csv_path, 'r', encoding=encoding) as f:
                csv_reader = csv.DictReader(f)
                headers = csv_reader.fieldnames
                print(f"[服务] CSV字段: {headers}")

                if x_field not in headers:
                    print(f"[服务] 警告: X坐标字段 '{x_field}' 不存在")
                    return {
                        "success": False,
                        "error": f"CSV中缺少X坐标字段: {x_field}"
                    }

                if y_field not in headers:
                    print(f"[服务] 警告: Y坐标字段 '{y_field}' 不存在")
                    return {
                        "success": False,
                        "error": f"CSV中缺少Y坐标字段: {y_field}"
                    }

                for row in csv_reader:
                    try:
                        # 验证坐标值
                        x_val = row.get(x_field)
                        y_val = row.get(y_field)

                        if x_val is None or y_val is None:
                            print(f"[服务] 警告: 行 {len(rows)} 缺少坐标")
                            continue

                        try:
                            x = float(x_val)
                            y = float(y_val)
                            rows.append(row)
                        except ValueError:
                            print(f"[服务] 警告: 行 {len(rows)} 无效坐标值")
                            continue
                    except Exception as e:
                        print(f"[服务] 警告: 行 {len(rows)} 错误: {e}")
                        continue

            if not rows:
                print("[服务] 错误: 没有有效的数据行")
                return {
                    "success": False,
                    "error": "CSV中没有有效的坐标数据"
                }

            print(f"[服务] 有效数据行数: {len(rows)}")

            # 创建Shapefile驱动
            print("[服务] 创建驱动...")
            driver = ogr.GetDriverByName('ESRI Shapefile')

            # 创建数据源
            data_source = driver.CreateDataSource(output_dir, shp_basename)

            # 创建空间参考（WGS 84）
            spatial_ref = osr.SpatialReference()
            spatial_ref.ImportFromEPSG(4326)

            # 创建图层（点几何）
            layer = data_source.CreateLayer(shp_basename, spatial_ref, ogr.wkbPoint)

            # 创建字段
            print("[服务] 创建字段...")
            layer.CreateField(ogr.FieldDefn('id', ogr.OFTInteger))

            # 添加CSV中的其他字段
            for header in headers:
                if header not in [x_field, y_field]:
                    # 猜测字段类型
                    field_type = ogr.OFTString
                    for row in rows[:10]:  # 检查前10行
                        value = row.get(header)
                        if value is not None:
                            try:
                                int(value)
                                field_type = ogr.OFTInteger
                                break
                            except (ValueError, TypeError):
                                try:
                                    float(value)
                                    field_type = ogr.OFTReal
                                    break
                                except (ValueError, TypeError):
                                    pass

                    if field_type == ogr.OFTInteger:
                        layer.CreateField(ogr.FieldDefn(header, ogr.OFTInteger))
                    elif field_type == ogr.OFTReal:
                        layer.CreateField(ogr.FieldDefn(header, ogr.OFTReal))
                    else:
                        layer.CreateField(ogr.FieldDefn(header, ogr.OFTString))

            # 添加要素到图层
            print("[服务] 添加要素...")
            valid_count = 0

            for idx, row in enumerate(rows):
                x_val = row.get(x_field)
                y_val = row.get(y_field)

                if x_val is None or y_val is None:
                    continue

                try:
                    x = float(x_val)
                    y = float(y_val)

                    # 创建点几何
                    point = ogr.CreateGeometryFromWkt(f"POINT ({x} {y})")

                    # 创建要素
                    feat = ogr.Feature(layer.GetLayerDefn())

                    # 设置ID
                    feat.SetField('id', idx + 1)

                    # 设置所有字段
                    for header in headers:
                        value = row.get(header)
                        if value is not None:
                            field_index = feat.GetFieldIndex(header)
                            if field_index >= 0:
                                feat.SetField(header, value)

                    # 设置几何
                    feat.SetGeometry(point)

                    # 添加到图层
                    layer.CreateFeature(feat)
                    valid_count += 1

                except ValueError:
                    continue

            print("[服务] ========== 转换完成 =========")
            print(f"[服务] 有效要素数量: {valid_count}")
            print(f"[服务] 输出文件: {output_path}")

            return {
                "success": True,
                "message": "转换成功",
                "feature_count": valid_count,
                "output_path": output_path,
                "file_size": os.path.getsize(output_path) if os.path.exists(output_path) else 0,
                "x_field": x_field,
                "y_field": y_field
            }

        except Exception as e:
            print(f"[服务] 异常: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": f"转换失败: {str(e)}"
            }
