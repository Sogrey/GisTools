# GisTools Python Backend

GIS工具箱后端服务，基于 Python 和 GDAL 实现多种GIS数据处理功能。

## 📚 文档导航

- **[GDAL 安装指南](GDAL_INSTALL_GUIDE.md)** - 详细安装 GDAL 的教程
- **[架构说明](ARCHITECTURE.md)** - 系统架构和模块设计
- **[问题排查](TROUBLESHOOTING.md)** - 常见问题和解决方案

## 🚀 快速开始

### 1. 检查依赖

```bash
python check_deps.py
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

**注意**：如果未安装 GDAL，系统会自动使用 Mock 模式（仅用于测试）。
要使用真实的地理数据处理功能，请参考 [GDAL 安装指南](GDAL_INSTALL_GUIDE.md)。

### 3. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

## 📖 功能模块

- **格式转换**：SHP ↔ GeoJSON, GeoJSON ↔ SHP 等
- **数据验证**：GeoJSON 格式和几何验证
- **数据压缩**：GeoJSON 数据优化和压缩

## 🔧 技术栈

- Python 3.11+
- FastAPI - Web框架
- GDAL - 地理数据处理库
- uvicorn - ASGI服务器

## 📖 API 文档

启动服务后访问：http://localhost:8000/docs

## 🚀 生产部署

详细部署指南请参考：

- **[部署指南](../DEPLOYMENT.md)** - 完整的部署教程（GitHub Pages + Docker + VPS）
- **Docker 支持** - 提供了 Dockerfile 和 docker-compose.yml
- **GitHub Actions** - 自动化 CI/CD 流程

### 快速部署（Docker）

```bash
# 构建镜像
cd GisTools
docker build -t gistools-backend:latest .

# 运行容器
docker run -d \
  --name gistools-backend \
  -p 8001:8001 \
  -e ALLOWED_ORIGINS=https://yourdomain.com \
  gistools-backend:latest
```

## ⚠️ 关于 Mock 模式

如果未安装 GDAL，系统会自动使用 Mock 模式：
- ✅ 生成示例数据用于测试
- ✅ 可以正常启动服务
- ❌ 无法处理真实的地理数据文件
- ⚠️ 启动时会显示警告信息

建议安装完整的 GDAL 以使用全部功能。
