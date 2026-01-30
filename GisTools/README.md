# GisTools Python Backend

GIS工具箱后端服务，基于 Python 和 GDAL 实现多种GIS数据处理功能。

## 技术栈

- Python 3.11+
- FastAPI - Web框架
- GDAL - 地理数据处理库
- uvicorn - ASGI服务器
- CORS - 跨域支持

## 功能模块

- 格式转换：SHP → GeoJSON, KML → GeoJSON 等
- 数据验证：GeoJSON 格式验证
- 坐标转换：多种坐标系统转换
- 数据压缩：GeoJSON 数据优化和压缩

## 安装依赖

```bash
pip install -r requirements.txt
```

## 运行服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

## API文档

启动服务后访问：http://localhost:8000/docs
