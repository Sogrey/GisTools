# GisTools Python 后端架构设计

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                        前端层 (Vue 3)                     │
│                    http://localhost:5173                 │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP/REST API
                       ↓
┌─────────────────────────────────────────────────────────┐
│                   API 网关层 (FastAPI)                     │
│              http://localhost:8000                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │          CORS Middleware                         │   │
│  │          Request Validation                      │   │
│  │          Error Handling                         │   │
│  └─────────────────────────────────────────────────┘   │
└──────────┬──────────────────────────────────┬──────────┘
           │                                  │
           ↓                                  ↓
┌──────────────────┐              ┌──────────────────┐
│   Router Layer   │              │   Router Layer   │
│                  │              │                  │
│ /api/shp/*       │              │ /api/geojson/*   │
│                  │              │                  │
│ - /info          │              │ - /validate      │
│ - /to-geojson    │              │ - /minify        │
│ - /download      │              │ - /pretty        │
└────────┬─────────┘              └────────┬─────────┘
         │                                  │
         ↓                                  ↓
┌─────────────────────────────────────────────────────────┐
│                   Service Layer                           │
│  ┌────────────────┐  ┌────────────────────────────────┐ │
│  │ ShpConverter   │  │  GeoJSONProcessor            │ │
│  │                │  │                              │ │
│  │ - shp_to_...   │  │  - validate()               │ │
│  │ - get_info()   │  │  - minify()                 │ │
│  └────────────────┘  │  - pretty()                 │ │
│                      └────────────────────────────────┘ │
└──────────────────────┬─────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  Data Processing Layer                    │
│  ┌────────────────────────────────────────────────────┐ │
│  │              GDAL Library                          │ │
│  │  - ogr (矢量数据处理)                              │ │
│  │  - osr (坐标系统定义)                              │ │
│  │  - osgeo (地理空间抽象)                            │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────────┐
│                  Storage Layer                            │
│  ┌──────────────────┐  ┌──────────────────┐            │
│  │   uploads/       │  │      temp/       │            │
│  │   转换结果文件     │  │   临时上传文件     │            │
│  └──────────────────┘  └──────────────────┘            │
└─────────────────────────────────────────────────────────┘
```

## 目录结构详解

```
GisTools/
│
├── app/                          # 应用主目录
│   ├── __init__.py
│   │
│   ├── core/                     # 核心配置层
│   │   ├── __init__.py
│   │   └── config.py             # 配置管理（环境变量、常量等）
│   │
│   ├── routers/                  # 路由层（API端点）
│   │   ├── __init__.py
│   │   ├── shp_convert.py        # Shapefile 转换路由
│   │   │   ├── POST /api/shp/info
│   │   │   ├── POST /api/shp/to-geojson
│   │   │   └── GET  /api/shp/download/{filename}
│   │   │
│   │   └── geojson_convert.py    # GeoJSON 处理路由
│   │       ├── POST /api/geojson/validate
│   │       ├── POST /api/geojson/minify
│   │       └── POST /api/geojson/pretty
│   │
│   ├── services/                 # 业务逻辑层
│   │   ├── __init__.py
│   │   └── shp_service.py        # Shapefile 转换服务
│   │       ├── ShpConverter class
│   │       ├── shp_to_geojson()
│   │       └── get_shp_info()
│   │
│   └── main.py                   # FastAPI 应用入口
│       - 应用初始化
│       - 中间件配置
│       - 路由注册
│       - 生命周期管理
│
├── uploads/                      # 转换结果存储目录
│   └── {uuid}_filename.geojson
│
├── temp/                         # 临时文件目录
│   └── {uuid}/
│       └── uploaded_file.shp
│
├── requirements.txt              # Python 依赖
├── .env                          # 环境配置
├── .gitignore                    # Git 忽略规则
├── main.py                       # 项目启动脚本
├── README.md                     # 项目说明
├── DEPLOYMENT.md                 # 部署指南
└── ARCHITECTURE.md               # 架构文档（本文件）
```

## 核心模块说明

### 1. 配置层 (app/core/config.py)

**职责**：
- 管理应用配置
- 从环境变量读取配置
- 提供配置访问接口

**关键配置**：
```python
class Settings:
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ALLOWED_ORIGINS: List[str]
    MAX_UPLOAD_SIZE: int = 104857600  # 100MB
    UPLOAD_DIR: str = "./uploads"
    TEMP_DIR: str = "./temp"
```

### 2. 路由层 (app/routers/)

**职责**：
- 定义 API 端点
- 处理 HTTP 请求
- 参数验证
- 调用服务层
- 返回响应

**示例流程**：
```
POST /api/shp/to-geojson
  1. 接收文件上传
  2. 验证文件类型
  3. 创建临时目录
  4. 保存文件
  5. 调用 ShpConverter.shp_to_geojson()
  6. 返回转换结果和下载链接
  7. 后台清理临时文件
```

### 3. 服务层 (app/services/)

**职责**：
- 实现核心业务逻辑
- 封装 GDAL 操作
- 数据处理和转换
- 错误处理

**设计模式**：
- 静态方法类
- 无状态设计
- 输入输出清晰

### 4. 数据层 (GDAL)

**使用的 GDAL 模块**：
- `ogr`: 矢量数据操作
- `osr`: 坐标系统转换
- `osgeo`: 地理空间抽象

## 请求处理流程

### SHP 转 GeoJSON 流程

```
1. 前端上传文件
   ↓
2. FastAPI 接收请求
   ↓
3. 验证文件类型 (.shp)
   ↓
4. 生成唯一 ID
   ↓
5. 保存到 temp/{uuid}/
   ↓
6. 调用 ShpConverter.shp_to_geojson()
   ├─ 使用 GDAL 打开 SHP
   ├─ 读取图层和要素
   ├─ 转换为 GeoJSON 结构
   └─ 写入 uploads/{uuid}_output.geojson
   ↓
7. 返回转换结果
   ├─ success: true/false
   ├─ feature_count: 数字
   ├─ file_size: 数字
   └─ download_url: 路径
   ↓
8. 前端下载结果文件
   ↓
9. 后台清理临时文件
```

## 错误处理策略

### 1. 文件验证
- 文件类型检查
- 文件大小限制
- 文件完整性验证

### 2. GDAL 错误
- 文件不存在
- 格式不支持
- 数据损坏
- 内存不足

### 3. HTTP 响应
- 400: 请求参数错误
- 404: 文件不存在
- 500: 服务器内部错误

## 安全考虑

### 1. 文件上传安全
- 限制文件大小
- 验证文件类型
- 使用 UUID 重命名
- 临时文件隔离

### 2. CORS 配置
- 限制允许的来源
- 配置允许的方法
- 配置允许的头

### 3. 资源管理
- 及时关闭文件句柄
- 清理临时文件
- 限制并发处理数

## 扩展性设计

### 添加新工具的步骤

1. **创建服务类** (`app/services/new_service.py`)
```python
class NewToolProcessor:
    @staticmethod
    def process(input_path: str, output_path: str):
        # 实现处理逻辑
        pass
```

2. **创建路由** (`app/routers/new_tool.py`)
```python
from fastapi import APIRouter, UploadFile, File

router = APIRouter()

@router.post("/process")
async def process_file(file: UploadFile = File(...)):
    # 调用服务层
    pass
```

3. **注册路由** (`app/main.py`)
```python
from app.routers import new_tool

app.include_router(new_tool.router, prefix="/api/new-tool", tags=["新工具"])
```

## 性能优化

### 1. 异步处理
- 使用 BackgroundTasks 处理清理
- 异步文件读写
- 异步 HTTP 请求

### 2. 缓存策略
- 转换结果缓存
- 文件信息缓存
- GDAL 数据源缓存

### 3. 资源限制
- 最大文件大小
- 最大并发数
- 超时设置

## 监控和日志

### 建议添加
- 请求日志
- 错误日志
- 性能指标
- 资源使用情况

## 未来扩展

### 计划中的功能
- [ ] 批量转换
- [ ] 坐标转换服务
- [ ] KML/KMZ 支持
- [ ] GeoTIFF 支持
- [ ] 数据可视化
- [ ] 用户认证
- [ ] 任务队列（Celery）
- [ ] 分布式存储
