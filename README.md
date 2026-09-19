# GisTools - GIS 工具箱

基于 Vue 3 + TypeScript + FastAPI 的在线 GIS 数据处理工具平台，**59 个工具组件**，覆盖格式转换、坐标系统、空间分析、数据处理、制图可视化、三维/CIM、地图服务七大领域。绝大部分工具**纯前端本地运行**，数据不出浏览器。

## 工具总览（59 个）

### 格式转换（11 个）

| 工具           | 路由                        | 说明                                                       |
| ------------ | ------------------------- | -------------------------------------------------------- |
| SHP 工具箱      | `/tools/shp-toolbox`      | SHP ↔ GeoJSON 双向，元信息提取，纯前端解析 + 后端转换双模式                   |
| 表格转换工具       | `/tools/table-convert`    | 表→GeoJSON / GeoJSON→CSV / Excel→JSON 三标签页，自动识别经纬度列，支持度分秒 |
| GeoJSON 工具箱  | `/tools/geojson-toolbox`  | 校验（RFC 7946，行号定位）/ 美化压缩 / 元数据                            |
| KML 转换器      | `/tools/kml-convert`      | KML ↔ GeoJSON 双向                                         |
| WKT/WKB 工具箱  | `/tools/wkt-wkb`          | WKT ↔ GeoJSON、WKB/EWKB ↔ GeoJSON，全几何类型 + SRID            |
| DXF 工具箱      | `/tools/dxf-tool`         | DXF ↔ GeoJSON 双向，Point/Line/Polyline/Circle              |
| GPX 工具箱      | `/tools/gpx-tool`         | GPX ↔ GeoJSON 互转 + 轨迹统计（距离/爬升/速度）                        |
| TopoJSON 转换  | `/tools/topojson-convert` | TopoJSON ↔ GeoJSON，共享弧段去重                                |
| Polyline 编解码 | `/tools/polyline-codec`   | Google Encoded Polyline 双向，精度 5/6 位                      |
| GeoBuf 编解码   | `/tools/geobuf-codec`     | GeoJSON ↔ 压缩格式，压缩率统计                                     |
| OSM 解析器      | `/tools/osm-parser`       | OpenStreetMap XML → GeoJSON                              |

### 坐标系统（7 个）

| 工具      | 路由                       | 说明                                                        |
| ------- | ------------------------ | --------------------------------------------------------- |
| 坐标转换工作台 | `/tools/coord-workbench` | WGS84/GCJ02/BD09/Web墨卡托/高斯/UTM/ECEF 七系互通，4 椭球，Vincenty 距离 |
| 投影带速查   | `/tools/band-lookup`     | 高斯 3°/6° 带号 + 中央经线 + UTM 带号 + 省市对照                        |
| EPSG 速查 | `/tools/epsg-lookup`     | 56 条常用坐标系对照表，WKT 定义复制                                     |
| 七参数/四参数 | `/tools/seven-param`     | Bursa-Wolf 七参数转换 + 公共点最小二乘反算                              |
| 坐标清洗    | `/tools/coord-clean`     | 精度控制 + 去重清洗双标签页                                           |
| 批量投影变换  | `/tools/reproject`       | GeoJSON 整体投影变换，坐标纠偏唯一入口                                   |
| 比例尺计算   | `/tools/scale-calc`      | 比例尺 ↔ 分辨率互算，DPI，瓦片地面米数                                    |

### 空间分析（10 个）

| 工具               | 路由                             | 说明                               |
| ---------------- | ------------------------------ | -------------------------------- |
| 空间分析工具箱          | `/tools/spatial-analysis`      | 点在多边形/球面面积/几何中心/边界/DP 抽稀         |
| 多边形叠加分析          | `/tools/overlay-analysis`      | 相交/并集/差集/对称差（Sutherland-Hodgman） |
| Voronoi/Delaunay | `/tools/voronoi-triangulation` | Bowyer-Watson 三角剖分 + Voronoi 对偶图 |
| 凸包计算             | `/tools/convex-hull`           | Monotone Chain O(n log n)        |
| 最近邻搜索            | `/tools/nearest-neighbor`      | KNN + 方位角 + Mutual NN            |
| 距离矩阵             | `/tools/distance-matrix`       | N×N Haversine 矩阵 → CSV           |
| H3/S2 网格编码       | `/tools/h3-s2-grid`            | Plus Codes + S2 Cell ID + H3 索引  |
| 缓冲区生成            | `/tools/buffer-gen`            | 点/线/面缓冲区（米制近似）                   |
| GeoHash 编解码      | `/tools/geohash`               | 经纬度 ↔ GeoHash，bbox + 8 邻域        |
| 线等距重采样           | `/tools/line-resample`         | 等距加密/抽稀/按数量重采样                   |

### 数据处理（8 个）

| 工具         | 路由                        | 说明                    |
| ---------- | ------------------------- | --------------------- |
| 要素合并/拆分    | `/tools/feature-merge`    | 合并/属性过滤/几何过滤/分组拆分     |
| GeoJSON 分片 | `/tools/geojson-splitter` | 按要素数/体积/属性值拆分大文件      |
| VWS 简化     | `/tools/vws-simplify`     | Visvalingam-Whyatt 简化 |
| 属性字段计算器    | `/tools/field-calc`       | 表达式计算新字段              |
| 按属性溶解      | `/tools/dissolve`         | 同属性相邻多边形合并            |
| 几何展平/合并    | `/tools/geometry-flatten` | Multi\* ↔ 单要素互转       |
| 拓扑检查       | `/tools/topology-check`   | 自相交/缝隙/重叠/环方向         |
| 图幅编号计算     | `/tools/map-sheet`        | 经纬度 ↔ 图幅号，新旧标准        |

### 制图可视化（8 个）

| 工具            | 路由                       | 说明                    |
| ------------- | ------------------------ | --------------------- |
| GeoJSON → SVG | `/tools/geojson-to-svg`  | 矢量图渲染，可调投影/线宽/填充      |
| 色带生成器         | `/tools/colormap`        | 13 种预设色带，Cesium 代码片段  |
| 专题图着色         | `/tools/choropleth`      | 按属性分色，等间隔/分位数，SVG 预览  |
| 点密度热力图        | `/tools/heatmap`         | Canvas 高斯核叠加，PNG 下载   |
| 等值线生成         | `/tools/contour`         | Marching Squares 追踪   |
| 地图排版          | `/tools/map-layout`      | 经纬网/比例尺/指北针/图例框 SVG   |
| 瓦片工具箱         | `/tools/tile-tools`      | 瓦片行列号计算 + 需求量估算（投标报价） |
| 瓦片下载脚本        | `/tools/tile-downloader` | wget 批量下载脚本生成         |

### 三维/CIM（9 个）

| 工具           | 路由                          | 说明                                |
| ------------ | --------------------------- | --------------------------------- |
| Cesium 相机参数  | `/tools/cesium-camera`      | setView 代码生成                      |
| 3D Tiles 检查器 | `/tools/3d-tiles-inspector` | tileset.json 层级/geometricError 解析 |
| CZML 生成器     | `/tools/czml-generator`     | 动态属性 CZML 文档                      |
| glTF 元信息     | `/tools/gltf-info`          | glTF 2.0/glb 解析                   |
| DEM 高程工具     | `/tools/dem-tools`          | 坡度坡向/高程统计/剖面                      |
| IFC 解析       | `/tools/ifc-parser`         | STEP 格式实体统计                       |
| CityGML 解析   | `/tools/citygml-parser`     | LOD 分布/building 统计                |
| 点云元信息        | `/tools/pointcloud-info`    | LAS 二进制头解析                        |
| 建筑体积估算       | `/tools/building-volume`    | 底面+层数 → 体积/表面积                    |

### 地图服务（5 个）

| 工具               | 路由                        | 说明                         |
| ---------------- | ------------------------- | -------------------------- |
| WMS Capabilities | `/tools/wms-capabilities` | 图层树/CRS/格式解析               |
| ArcGIS REST 探测   | `/tools/arcgis-rest`      | query/export/legend URL 构建 |
| TileJSON 查看      | `/tools/tilejson`         | 瓦片服务元数据解析                  |
| WMS/WMTS URL 构建  | `/tools/wms-url-builder`  | GetMap/GetTile URL 生成      |
| 地图坐标拾取           | `/tools/map-picker`       | Leaflet 在线拾取（需联网）          |

### 其他（1 个）

| 工具        | 路由              | 说明         |
| --------- | --------------- | ---------- |
| Base64 工具 | `/tools/base64` | 文本/文件双向编解码 |

## 项目结构

```
GisTools/
├── src/                       # Vue 3 前端
│   ├── views/                # 60 个组件（HomeView + 59 个工具页）
│   ├── utils/                # 60 个 TS 工具模块（纯函数算法库）
│   │   ├── geo-math.ts      # 共享数学底座（haversine/球面面积）
│   │   ├── coord-transform.ts # 共享纠偏公式（GCJ02/BD09）
│   │   └── ...               # 各工具核心算法
│   ├── router/               # 60 条路由
│   └── assets/
│       ├── main.css
│       └── tool-common.css   # 工具页公共深色科技风样式
├── GisTools/                  # Python 后端（FastAPI + GDAL，可选）
│   ├── app/
│   │   ├── core/            # 核心配置
│   │   ├── services/        # 业务逻辑
│   │   └── routers/         # API 路由
│   └── main.py              # 后端入口
├── MIGRATION_PLAN.md          # doSometing → GisTools 迁移记录
├── STATUS.md                  # 开发状态文档
└── package.json
```

## 快速开始

### 仅前端（绝大多数工具可用）

```bash
pnpm install
pnpm run dev
# 打开 http://localhost:5173
```

> 59 个工具中仅 SHP 工具箱的"后端转换"模式需要 FastAPI；纯前端解析模式无需后端。

### 前端 + 后端（SHP 后端转换、GeoJSON→SHP 需要）

```bash
# 后端依赖 Python 3.11+ 与 GDAL
cd GisTools && pip install -r requirements.txt

# 同时启动（推荐）
pnpm run dev:all
# 前端: http://localhost:5173
# 后端: http://localhost:8001，API 文档: http://localhost:8001/docs
```

### 验证与构建

```bash
pnpm run type-check   # vue-tsc 类型检查（当前 0 错误）
pnpm run build        # 生产构建
pnpm run lint         # ESLint
```

## 架构说明

### 前后端职责划分

* **纯前端**（59 个工具默认模式）：所有算法在浏览器本地执行，零上传、零依赖，数据不出设备
* **后端增强**（可选）：SHP/GeoJSON 转换的 GDAL 精确实现，仅 SHP 工具箱提供切换入口
* **共享底座**：`geo-math.ts`（9 处 Haversine 收敛为 1）、`coord-transform.ts`（3 处纠偏公式收敛为 1）、`tile-tools.ts`（瓦片坐标唯一实现）

### 代码规范

* 组件统一 `<script setup lang="ts">`，引入 `tool-common.css` 公共样式
* 深色科技风：背景 `#0a0a0f→#1a1a2e→#0f0f1a` 渐变，主色 `#667eea→#764ba2`
* `noUncheckedIndexedAccess` 严格模式全量通过（1424 个历史错误已清零）

## 开发状态

详见 [STATUS.md](STATUS.md)。当前进度：**59/59 工具完成**，类型检查零错误，构建通过。

## 相关文档

* [STATUS.md](STATUS.md) — 开发状态与进度
* [MIGRATION\_PLAN.md](MIGRATION_PLAN.md) — doSometing 64 工具迁移记录
* [DEVELOPMENT\_NOTES.md](DEVELOPMENT_NOTES.md) — 开发经验
* [DEPLOYMENT.md](DEPLOYMENT.md) — 部署指南
* [GisTools/](GisTools/) — 后端文档（README/架构/安装/排障）

## 许可证

MIT License


