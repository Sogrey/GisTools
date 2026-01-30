# GisTools Python Backend - 部署指南

## 环境准备

### 1. 安装 Python 依赖

```bash
cd GisTools

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. GDAL 安装说明

**Windows:**
```bash
pip install gdal
# 如果失败，使用预编译版本：
pip install gdal==3.11.1
```

**macOS:**
```bash
brew install gdal
pip install gdal
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install gdal-bin libgdal-dev
pip install gdal
```

## 配置说明

编辑 `.env` 文件修改配置：

```env
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## 启动服务

### 开发模式
```bash
python main.py
```

### 生产模式
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 目录结构说明

```
GisTools/
├── app/
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py       # 配置管理
│   ├── services/
│   │   ├── __init__.py
│   │   └── shp_service.py  # SHP转换服务
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── shp_convert.py     # SHP路由
│   │   └── geojson_convert.py # GeoJSON路由
│   ├── __init__.py
│   └── main.py            # 应用入口
├── uploads/               # 上传文件存储（自动创建）
├── temp/                  # 临时文件（自动创建）
├── requirements.txt       # Python依赖
├── .env                   # 环境配置
└── main.py                # 启动脚本
```

## API 使用示例

### 1. SHP 转 GeoJSON

**请求：**
```bash
curl -X POST "http://localhost:8000/api/shp/to-geojson" \
  -F "file=@path/to/file.shp" \
  -F "encoding=UTF-8"
```

**响应：**
```json
{
  "success": true,
  "message": "转换成功",
  "feature_count": 100,
  "file_size": 123456,
  "download_url": "/api/download/xxx_file.geojson"
}
```

### 2. 验证 GeoJSON

**请求：**
```bash
curl -X POST "http://localhost:8000/api/geojson/validate" \
  -F "file=@path/to/file.geojson"
```

**响应：**
```json
{
  "valid": true,
  "feature_count": 100,
  "geometry_types": ["Point", "LineString", "Polygon"]
}
```

### 3. 压缩 GeoJSON

**请求：**
```bash
curl -X POST "http://localhost:8000/api/geojson/minify" \
  -F "file=@path/to/file.geojson"
```

**响应：**
```json
{
  "success": true,
  "message": "压缩成功",
  "original_size": 500000,
  "minified_size": 300000,
  "compression_ratio": "40.0%",
  "download_url": "/api/download/xxx_file.minified.geojson"
}
```

## 故障排除

### GDAL 导入错误

如果遇到 `No module named 'osgeo'` 或 GDAL 相关错误：

1. 确认 GDAL 已正确安装
2. 检查 GDAL 版本是否匹配
3. 设置环境变量：
   ```bash
   # Windows
   set GDAL_DATA=C:\OSGeo4W\share\gdal

   # Linux/Mac
   export GDAL_DATA=/usr/share/gdal
   ```

### 文件上传失败

检查 `uploads/` 和 `temp/` 目录是否有写入权限

### CORS 错误

检查 `.env` 中的 `ALLOWED_ORIGINS` 是否包含前端地址

## 性能优化建议

1. **生产环境**：使用多个 worker 进程
2. **大文件处理**：增加 `MAX_UPLOAD_SIZE` 配置
3. **临时文件清理**：定期清理 `temp/` 目录
4. **缓存策略**：对频繁访问的文件添加缓存

## 安全建议

1. 限制上传文件大小
2. 验证文件类型
3. 使用 HTTPS
4. 添加身份验证
5. 实施速率限制
