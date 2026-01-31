# GisTools - GIS工具箱

基于 Vue 3 + FastAPI + GDAL 的在线 GIS 数据处理工具平台

1. **新用户**：从根目录 [README.md](README.md) 开始
2. **快速开始**：阅读 [GisTools/README.md](GisTools/README.md)
3. **安装 GDAL**：参考 [GisTools/GDAL_INSTALL_GUIDE.md](GisTools/GDAL_INSTALL_GUIDE.md)
4. **遇到问题**：查看 [GisTools/TROUBLESHOOTING.md](GisTools/TROUBLESHOOTING.md)
5. **了解架构**：阅读 [GisTools/ARCHITECTURE.md](GisTools/ARCHITECTURE.md)
6. **开发经验**：参考 [DEVELOPMENT_NOTES.md](DEVELOPMENT_NOTES.md)

## 项目结构

```
gis-tools/
├── src/                      # Vue 前端
│   ├── views/               # 页面组件
│   ├── components/          # 通用组件
│   ├── router/              # 路由配置
│   └── assets/              # 静态资源
├── GisTools/                # Python 后端
│   ├── app/
│   │   ├── core/           # 核心配置
│   │   ├── services/       # 业务逻辑服务
│   │   └── routers/        # API 路由
│   ├── uploads/            # 上传文件存储
│   ├── temp/               # 临时文件
│   ├── requirements.txt    # Python 依赖
│   └── main.py            # 后端入口
└── package.json           # 前端依赖
```

## 功能模块

### 格式转换

- Shapefile → GeoJSON
- KML/KMZ → GeoJSON（计划中）
- GeoJSON → Shapefile（计划中）

### 数据处理

- GeoJSON 格式验证
- GeoJSON 压缩优化
- GeoJSON 格式美化

### 坐标系统

- 坐标系转换（计划中）

## 快速开始

### 前置要求

- Node.js 20+
- Python 3.11+
- GDAL 3.11+

### 安装依赖

#### 前端依赖

```bash
npm install
# 或
pnpm install
```

#### 后端依赖

```bash
cd GisTools
pip install -r requirements.txt
```

### 运行项目

#### 方式一：同时启动前后端（推荐）

```bash
pnpm run dev:all
```

这会同时启动：

- Vue 前端：http://localhost:5173
- FastAPI 后端：http://localhost:8001

#### 方式二：分别启动

**前端：**

```bash
pnpm run dev
```

**后端（新终端）：**

```bash
cd GisTools
python main.py
```
后端将在 http://localhost:8001 启动

### 访问 API 文档

启动后端后访问：http://localhost:8001/docs

## API 端点

### Shapefile 转换

- `POST /api/shp/info` - 获取 SHP 文件信息
- `POST /api/shp/to-geojson` - 将 SHP 转换为 GeoJSON
- `GET /api/shp/download/{filename}` - 下载转换后的文件

### GeoJSON 处理

- `POST /api/geojson/validate` - 验证 GeoJSON 格式
- `POST /api/geojson/minify` - 压缩 GeoJSON
- `POST /api/geojson/pretty` - 格式化 GeoJSON

## 技术栈

### 前端

- Vue 3
- Vite
- TypeScript
- Vue Router
- Pinia

### 后端

- FastAPI
- GDAL
- Python 3.11+
- Uvicorn

## 🚀 部署

详细部署指南请参考：[DEPLOYMENT.md](DEPLOYMENT.md)

### 快速部署

**前端（GitHub Pages）：**
- 自动部署，推送到 `main` 分支即可

**后端（Docker）：**
```bash
cd GisTools
docker build -t gistools-backend:latest .
docker run -d -p 8000:8000 gistools-backend:latest
```

**Docker Compose：**
```bash
docker-compose up -d
```

## 开发计划

- [x] 项目架构搭建
- [x] SHP 转 GeoJSON 功能
- [x] GeoJSON 验证功能
- [x] GeoJSON 压缩功能
- [ ] KML/KMZ 转换功能
- [ ] 坐标转换功能
- [ ] GeoJSON 查看器
- [ ] 批量转换功能
- [ ] 前端工具页面开发

## 许可证

MIT License
