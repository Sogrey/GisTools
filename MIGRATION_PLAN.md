
# GIS 工具合并迁移计划

> doSometing（64 个单文件 HTML 工具）→ GisTools（Vue 3 + TypeScript 项目）

> **✅ 迁移已完成（2026-09-19）**：64/64 工具全部迁移，合并为 59 个组件 + 60 个 TS 模块。
> 完成状态与后续规划见 [STATUS.md](STATUS.md)。

## 执行结果对照

| 计划项         | 计划              | 实际完成                                         |
| ----------- | --------------- | -------------------------------------------- |
| 迁移组件数       | 55（预估）          | 59（部分工具独立保留）                                 |
| 公共样式        | tool-common.css | ✅ 已创建，59/59 组件引入                             |
| 双向合并        | 9 组             | ✅ SHP/表格/GeoJSON/KML/WKT-WKB/DXF/GPX/坐标清洗/瓦片 |
| 路由注册        | 全部              | ✅ 60 条，一一对应                                  |
| HomeView 更新 | 9 分类            | ✅ 8 分类 + 其他，59 卡片                            |
| 类型检查        | 0 错误            | ✅ 1424 历史错误清零                                |
| 构建验证        | 通过              | ✅ vite build 通过                              |

## 一、项目对比

| 维度   | doSometing（源）            | GisTools（目标）                                    |
| ---- | ------------------------ | ----------------------------------------------- |
| 技术栈  | 纯 HTML + JS，单文件零依赖       | Vue 3 + TS + Vite + Vue Router + Pinia          |
| 主题   | 白底淡蓝 `--primary:#2f7beb` | 深色科技风 `#0a0a0f` + 渐变 `#667eea→#764ba2`          |
| 图标   | 内联 SVG path              | emoji 字符                                        |
| 组件   | 无（每工具一个 index.html）      | `.vue` SFC（`<script setup lang="ts">`）          |
| 路由   | 导航页 TOOLS 数组跳转           | Vue Router `/tools/xxx`                         |
| 后端   | 无                        | FastAPI + GDAL（localhost:8001）                  |
| 已有工具 | 64 个                     | 4 个（SHP→GeoJSON、GeoJSON→SHP、CSV→SHP、GeoJSON 验证） |

## 二、迁移策略

### 2.1 核心原则

1. **纯前端优先**：doSometing 工具全部是纯前端 JS，迁移到 Vue 后保持纯前端，不依赖后端 API（已有 4 个工具保留后端调用）
2. **逻辑复用**：提取 `<script id="core">` 中的纯函数逻辑到 `src/utils/` 下的 TS 模块，Vue 组件调用
3. **样式适配**：从白底淡蓝改为深色科技风，参考 ShpConvertView/GeoJsonValidateView 的 CSS 变量和类名
4. **合并双向**：功能重叠的工具合并为单组件多标签页
5. **渐进迁移**：分 6 批按优先级推进，每批完成后验证

### 2.2 样式映射表

| doSometing 样式        | GisTools 对应                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `--bg:#f4f7fb`       | `background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)`                  |
| `--card:#fff`        | `rgba(255, 255, 255, 0.03)`                                                                   |
| `--line:#e3eaf3`     | `rgba(255, 255, 255, 0.1)`                                                                    |
| `--primary:#2f7beb`  | `#667eea`（渐变到 `#764ba2`）                                                                      |
| `--text:#1f2d3d`     | `#ffffff`                                                                                     |
| `--text-2:#5b6b80`   | `#a0a0a0`                                                                                     |
| `--text-3:#8fa0b5`   | `#606060`                                                                                     |
| `.panel` 白底圆角        | `rgba(255,255,255,0.03)` + `border:1px solid rgba(255,255,255,0.1)` + `border-radius:16px`    |
| `.btn` 蓝底白字          | `background:linear-gradient(135deg,#667eea,#764ba2)`                                          |
| `.btn.ghost`         | `background:rgba(255,255,255,0.05)` + `border:1px solid rgba(255,255,255,0.1)`                |
| textarea 白底          | `background:rgba(255,255,255,0.05)` + `color:#fff` + `border:1px solid rgba(255,255,255,0.1)` |
| 返回链接 `../index.html` | `<button class="back-btn" @click="goBack">返回首页</button>`                                      |
| header logo          | 已有全局 header（HomeView 有，工具页用 back-btn + page-title）                                            |

### 2.3 组件模板规范

每个工具 Vue 组件统一结构：

```
src/views/XxxView.vue       — Vue SFC 组件
src/utils/xxx.ts            — 核心逻辑（从 core 提取的纯函数）
```

组件内部结构：

```vue
<template>
  <div class="container">
    <header class="header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">工具名称</h1>
    </header>
    <main class="main-content">
      <!-- 工具内容 -->
    </main>
  </div>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { coreFunction } from '@/utils/xxx'
// ...
</script>
<style scoped>
/* 深色科技风，复用 GisTools 已有类名 */
</style>
```

### 2.4 共享样式提取

从 ShpConvertView 等已有组件提取公共样式到 `src/assets/tool-common.css`，供所有工具页复用：

* `.container` / `.header` / `.back-btn` / `.page-title`
* `.main-content` / `.panel` / `.card`
* `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-ghost`
* `textarea` / `input` / `select` 深色表单样式
* `.result-card` / `.msg` / `.msg.ok` / `.msg.err`
* `.tabs` / `.tab` / `.tab.active`（标签页）
* `@media` 响应式

## 三、工具合并映射（64 → 55 组件）

### 合并规则

* 功能完全重叠的多个工具 → 单组件多标签页
* 已有 GisTools 工具与 doSometing 工具重叠 → 合并增强
* 单向转换已有双向版的 → 删除单向

### 合并明细

| # | 合并后组件名           | 合并来源                                                                     | 合并方式                                              |
| - | ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| 1 | ShpToolView      | ShpConvertView + GeoJsonConvertView + shp-toolbox                        | 3 合 1，双标签页：SHP→GeoJSON / GeoJSON→SHP，元信息作为转换副产品展示 |
| 2 | TableConvertView | CsvConvertView + table-to-geojson + geojson-to-csv + excel-to-json       | 4 合 1，三标签页：表→GeoJSON / GeoJSON→CSV / Excel→JSON   |
| 3 | GeoJsonToolView  | GeoJsonValidateView + geojson-toolbox + geojson-validator + geojson-meta | 4 合 1，四标签页：校验 / 美化压缩 / 纠偏 / 元数据                   |
| 4 | KmlConvertView   | kml-converter                                                            | 已是双向，直接迁移                                         |
| 5 | WktWkbView       | wkt-wkb-toolbox                                                          | 已合并，直接迁移                                          |
| 6 | DxfToolView      | dxf-toolbox                                                              | 已合并，直接迁移                                          |
| 7 | GpxToolView      | gpx-toolbox                                                              | 已合并，直接迁移                                          |
| 8 | CoordCleanView   | coord-precision + coord-cleaner                                          | 2 合 1，双标签页：精度控制 / 去重清洗                            |
| 9 | TileToolView     | tile-calculator + tile-estimate                                          | 2 合 1，双标签页：瓦片计算 / 需求估算                            |

### 不合并的工具（保持独立）

* tile-downloader（下载脚本生成，功能独立）
* 其他 46 个工具各有独立功能，保持独立组件

## 四、分批迁移计划

### 第 1 批：格式转换类（9 个组件，优先级最高）

| 序号 | 组件文件                  | 工具名称        | 分类   | 来源              |
| -- | --------------------- | ----------- | ---- | --------------- |
| 1  | ShpToolView\.vue      | SHP 工具箱     | 格式转换 | 合并 3 个          |
| 2  | TableConvertView\.vue | 表格转换工具      | 格式转换 | 合并 4 个          |
| 3  | GeoJsonToolView\.vue  | GeoJSON 工具箱 | 格式转换 | 合并 4 个          |
| 4  | KmlConvertView\.vue   | KML 转换器     | 格式转换 | kml-converter   |
| 5  | WktWkbView\.vue       | WKT/WKB 工具箱 | 格式转换 | wkt-wkb-toolbox |
| 6  | DxfToolView\.vue      | DXF 工具箱     | 格式转换 | dxf-toolbox     |
| 7  | GpxToolView\.vue      | GPX 工具箱     | 格式转换 | gpx-toolbox     |
| 8  | TopoJsonView\.vue     | TopoJSON 转换 | 格式转换 | topojson-tool   |
| 9  | OsmView\.vue          | OSM 解析器     | 格式转换 | osm-pbf-parser  |

附带工具模块（不归入格式转换分类但与转换相关）：
\| 10 | PolylineView\.vue | Polyline 编解码 | 格式转换 | encoded-polyline |
\| 11 | GeobufView\.vue | GeoBuf 编解码 | 格式转换 | geobuf-tool |

### 第 2 批：坐标系统类（7 个组件）

| 序号 | 组件文件                    | 工具名称    | 来源                                 |
| -- | ----------------------- | ------- | ---------------------------------- |
| 1  | CoordWorkbenchView\.vue | 坐标转换工作台 | gis-coordinate-workbench           |
| 2  | BandLookupView\.vue     | 投影带速查   | band-lookup                        |
| 3  | EpsgLookupView\.vue     | EPSG 速查 | epsg-lookup                        |
| 4  | SevenParamView\.vue     | 七参数/四参数 | seven-param                        |
| 5  | CoordCleanView\.vue     | 坐标清洗    | 合并 coord-precision + coord-cleaner |
| 6  | ReprojectView\.vue      | 批量投影变换  | geojson-reproject                  |
| 7  | ScaleCalcView\.vue      | 比例尺计算   | scale-calc                         |

### 第 3 批：空间分析类（10 个组件）

| 序号 | 组件文件                     | 工具名称             | 来源                    |
| -- | ------------------------ | ---------------- | --------------------- |
| 1  | SpatialAnalysisView\.vue | 空间分析工具箱          | spatial-analysis      |
| 2  | OverlayView\.vue         | 叠加分析             | overlay-analysis      |
| 3  | VoronoiView\.vue         | Voronoi/Delaunay | voronoi-triangulation |
| 4  | ConvexHullView\.vue      | 凸包计算             | convex-hull           |
| 5  | NearestNeighborView\.vue | 最近邻搜索            | nearest-neighbor      |
| 6  | DistanceMatrixView\.vue  | 距离矩阵             | distance-matrix       |
| 7  | H3S2GridView\.vue        | H3/S2 网格编码       | h3-s2-grid            |
| 8  | BufferView\.vue          | 缓冲区生成            | buffer-gen            |
| 9  | GeohashView\.vue         | GeoHash 编解码      | geohash-tool          |
| 10 | LineResampleView\.vue    | 线等距重采样           | line-resample         |

### 第 4 批：数据处理类（8 个组件）

| 序号 | 组件文件                     | 工具名称       | 来源                   |
| -- | ------------------------ | ---------- | -------------------- |
| 1  | FeatureMergeView\.vue    | 要素合并/拆分    | feature-merge        |
| 2  | GeoJsonSplitterView\.vue | GeoJSON 分片 | geojson-splitter     |
| 3  | VwsView\.vue             | VWS 简化     | visvalingam-simplify |
| 4  | FieldCalcView\.vue       | 属性字段计算     | field-calculator     |
| 5  | DissolveView\.vue        | 按属性溶解      | dissolve-tool        |
| 6  | GeometryFlattenView\.vue | 几何展平       | geometry-flatten     |
| 7  | TopologyCheckView\.vue   | 拓扑检查       | topology-check       |
| 8  | MapSheetView\.vue        | 图幅编号       | map-sheet            |

### 第 5 批：制图可视化 + 瓦片（8 个组件）

| 序号 | 组件文件                    | 工具名称        | 来源                                 |
| -- | ----------------------- | ----------- | ---------------------------------- |
| 1  | GeoJsonToSvgView\.vue   | GeoJSON→SVG | geojson-to-svg                     |
| 2  | ColormapView\.vue       | 色带生成器       | colormap-gen                       |
| 3  | ChoroplethView\.vue     | 专题图着色       | choropleth-map                     |
| 4  | HeatmapView\.vue        | 点密度热力图      | heatmap-density                    |
| 5  | ContourView\.vue        | 等值线生成       | contour-generator                  |
| 6  | MapLayoutView\.vue      | 地图排版        | map-layout                         |
| 7  | TileToolView\.vue       | 瓦片工具箱       | 合并 tile-calculator + tile-estimate |
| 8  | TileDownloaderView\.vue | 瓦片下载脚本      | tile-downloader                    |

### 第 6 批：三维/服务/其他（13 个组件）

| 序号 | 组件文件                    | 工具名称             | 来源                   |
| -- | ----------------------- | ---------------- | -------------------- |
| 1  | CesiumCameraView\.vue   | Cesium 相机参数      | cesium-camera        |
| 2  | ThreeDTilesView\.vue    | 3D Tiles 检查      | 3d-tiles-inspector   |
| 3  | CzmlView\.vue           | CZML 生成器         | czml-generator       |
| 4  | GltfView\.vue           | glTF 元信息         | gltf-info            |
| 5  | DemView\.vue            | DEM 高程工具         | dem-tools            |
| 6  | IfcView\.vue            | IFC 解析           | ifc-info             |
| 7  | CityGmlView\.vue        | CityGML 解析       | citygml-parser       |
| 8  | PointCloudView\.vue     | 点云元信息            | pointcloud-info      |
| 9  | BuildingVolumeView\.vue | 建筑体积估算           | building-volume      |
| 10 | WmsCapView\.vue         | WMS Capabilities | wms-capabilities     |
| 11 | ArcGisView\.vue         | ArcGIS REST 探测   | arcgis-rest-explorer |
| 12 | TileJsonView\.vue       | TileJSON 查看      | tilejson-viewer      |
| 13 | WmsUrlView\.vue         | WMS/WMTS URL 构建  | wms-url-builder      |
| 14 | MapPickerView\.vue      | 地图坐标拾取           | map-picker（唯一需联网）    |
| 15 | Base64View\.vue         | Base64 工具        | base64-tool          |

## 五、执行步骤

### Step 1：基础设施（先行）

1. 创建 `src/assets/tool-common.css` — 提取公共样式
2. 创建 `src/utils/` 目录 — 放置核心逻辑 TS 模块
3. 更新 `src/router/index.ts` — 注册所有新路由
4. 更新 `HomeView.vue` — 扩展 tools 数组和分类

### Step 2：按 6 批顺序迁移

每批执行流程：

1. 从 doSometing HTML 提取 `<script id="core">` 纯函数 → `src/utils/xxx.ts`
2. 创建 Vue 组件 `src/views/XxxView.vue`
3. 适配深色科技风样式
4. 合并工具的标签页逻辑
5. 运行 `pnpm run type-check` 验证 TypeScript
6. 运行 `pnpm run build` 验证构建

### Step 3：收尾验证

1. 全量 `pnpm run type-check` + `pnpm run build`
2. 更新 README.md 开发计划清单
3. 导航页工具数量与磁盘组件数量一致

## 六、分类体系（GisTools HomeView）

```
全部 / 格式转换 / 坐标系统 / 空间分析 / 数据处理 / 制图可视化 / 三维/CIM / 地图服务 / 其他工具
```

## 七、注意事项

1. **后端依赖**：已有 4 个工具（SHP/CSV/GeoJSON 验证）依赖 FastAPI 后端，合并后保留后端调用能力，同时补充纯前端模式
2. **联网工具**：map-picker 依赖 Leaflet + OSM 在线地图，迁移时保留 `<link>` CDN 引用或 npm 安装 leaflet
3. **文件上传**：SHP/DXF/IFC/LAS 等需要文件上传的工具，保留 FileReader/ArrayBuffer 纯前端解析
4. **Canvas/SVG**：热力图、专题图、等值线等用 Canvas 2D / SVG，Vue 组件中用 ref 获取 DOM
5. **标签页**：合并工具用 Vue 的 `v-if`/`v-show` 或 `shallowRef` 切换标签页状态
6. **TypeScript**：core 逻辑从 JS 迁移到 TS 时添加类型声明，但不过度重构

## 八、迁移后追加执行的去重（超出原计划）

原计划完成后，审查发现并追加了以下去重（详见 STATUS.md 第三阶段）：

| 项                    | 处理                                        |
| -------------------- | ----------------------------------------- |
| 4 个旧版视图（约 3700 行）    | 删除，路由与 HomeView 卡片同步清理                    |
| Haversine ×9、球面面积 ×5 | 新建 `geo-math.ts` 收敛                       |
| GCJ02 纠偏公式 ×3        | 新建 `coord-transform.ts` 收敛                |
| DP 抽稀 ×2（容差语义不一致）    | 统一为 line-resample 米制版                     |
| 色带/瓦片坐标/点集解析重复       | choropleth/tile-downloader/tilejson 改共享引用 |
| 1424 个严格模式类型错误       | 全部清零（含 4 个真实运行时缺陷修复）                      |
| base.css 脚手架残留       | 删除，修复 main.css 悬空引用                       |
