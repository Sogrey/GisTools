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

### Windows 用户（推荐）

如果安装GDAL遇到问题，请参考 [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md) 获取详细指南。

#### 方式一：使用 Conda（最简单）

```bash
conda create -name gistools python=3.11
conda activate gistools
conda install -c conda-forge gdal
pip install -r requirements.txt
```

#### 方式二：直接安装（可能失败）

```bash
pip install gdal
pip install -r requirements.txt
```

**注意**：如果 `pip install gdal` 失败，系统会自动使用 Mock 模式（仅用于测试）。

### Linux/Mac 用户

```bash
# Ubuntu/Debian
sudo apt-get install gdal-bin libgdal-dev
pip install gdal
pip install -r requirements.txt

# macOS
brew install gdal
pip install gdal
pip install -r requirements.txt
```

## 运行服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 关于 GDAL Mock 模式

如果未安装 GDAL，系统会自动使用 Mock 模式：
- 生成示例数据用于测试
- 可以正常启动服务
- 无法处理真实的 SHP 文件
- 启动时会显示警告信息

建议安装完整的 GDAL 以使用全部功能。

## API文档

启动服务后访问：http://localhost:8000/docs
