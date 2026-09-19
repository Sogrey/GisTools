# GisTools 开发状态

> 更新日期：2026-09-19
> 当前版本：前端 0.0.0（开发期）

## 总体进度

| 里程碑                                 | 状态   | 完成时间       |
| ----------------------------------- | ---- | ---------- |
| 项目架构搭建（Vue 3 + FastAPI）             | ✅ 完成 | 早期         |
| 后端 SHP/GeoJSON/CSV 转换 API           | ✅ 完成 | 早期         |
| doSometing 64 工具迁移                  | ✅ 完成 | 2026-09-19 |
| 工具合并去重（64 → 59 组件）                  | ✅ 完成 | 2026-09-19 |
| 算法底座去重（geo-math/coord-transform）    | ✅ 完成 | 2026-09-19 |
| 类型债务清偿（1424 → 0）                    | ✅ 完成 | 2026-09-19 |
| 文档更新（README/STATUS/MIGRATION\_PLAN） | ✅ 完成 | 2026-09-19 |

## 质量指标（当前）

| 指标                | 数值               |
| ----------------- | ---------------- |
| 工具组件              | 59 个（+ HomeView） |
| TS 工具模块           | 60 个             |
| 路由                | 60 条（首页 + 59 工具） |
| TypeScript 严格模式错误 | **0**（曾 1424）    |
| vite build        | ✅ 通过（约 5s）       |
| 白底样式残留            | 0 处              |
| 孤立模块/死链路由         | 0 处              |

## 工具分类统计

| 分类     | 数量 | 说明                                                              |
| ------ | -- | --------------------------------------------------------------- |
| 格式转换   | 11 | SHP/表格/GeoJSON/KML/WKT-WKB/DXF/GPX/TopoJSON/Polyline/GeoBuf/OSM |
| 坐标系统   | 7  | 工作台/投影带/EPSG/七参数/清洗/投影变换/比例尺                                    |
| 空间分析   | 10 | 叠加/Voronoi/凸包/最近邻/距离矩阵/H3S2/缓冲区/GeoHash/重采样/综合                  |
| 数据处理   | 8  | 合并/分片/VWS/字段计算/溶解/展平/拓扑/图幅                                      |
| 制图可视化  | 8  | SVG/色带/专题图/热力图/等值线/排版/瓦片计算/瓦片下载                                 |
| 三维/CIM | 9  | Cesium相机/3DTiles/CZML/glTF/DEM/IFC/CityGML/点云/建筑体积              |
| 地图服务   | 5  | WMS Capabilities/ArcGIS/TileJSON/WMS URL/坐标拾取                   |
| 其他     | 1  | Base64                                                          |

## 迁移与合并记录

### 第一阶段：工具箱建设（doSometing）

在 `TeleAgent-Workspace/doSometing/` 以单文件 HTML 形式建成 64 个零依赖 GIS 工具，白底淡蓝主题，双击即用，含导航页。

### 第二阶段：迁移到 GisTools（2026-09-19）

按 [MIGRATION\_PLAN.md](MIGRATION_PLAN.md) 分 6 批将 64 个工具迁移为 Vue 3 + TypeScript 组件：

| 批次 | 内容         | 组件数 |
| -- | ---------- | --- |
| 1  | 格式转换类      | 11  |
| 2  | 坐标系统类      | 7   |
| 3  | 空间分析类      | 10  |
| 4  | 数据处理类      | 8   |
| 5  | 制图可视化 + 瓦片 | 8   |
| 6  | 三维/服务/其他   | 15  |

关键决策：

* 每个工具的 `<script id="core">` 纯函数提取为 `src/utils/*.ts`，UI 与算法分离
* 白底淡蓝（#2f7beb）→ 深色科技风（#667eea→#764ba2），新建 `tool-common.css` 公共样式
* 功能重叠工具合并为多标签页组件（如 SHP 工具箱双模式、表格转换三标签页）

### 第三阶段：去重合并（2026-09-19）

**删除 4 个旧版视图**（约 3700 行，被新版完全覆盖）：

* ShpConvertView / GeoJsonConvertView → ShpToolView
* CsvConvertView → TableConvertView
* GeoJsonValidateView → GeoJsonToolView

**算法去重**：

| 去重项               | 处理                                           |
| ----------------- | -------------------------------------------- |
| Haversine ×9      | 收敛到 `geo-math.ts`                            |
| 球面面积 ×5           | 收敛到 `geo-math.ts`                            |
| GCJ02 纠偏 ×3       | 收敛到 `coord-transform.ts`                     |
| DP 抽稀 ×2（容差语义不一致） | 统一为 line-resample 米制版                        |
| 色带插值 ×2           | choropleth 改 import colormap                 |
| 瓦片坐标 ×3           | tile-downloader/tilejson 改 import tile-tools |
| 纠偏双入口             | GeoJsonToolView 纠偏 Tab 跳转 ReprojectView      |

**明确不合并**（单一职责保留）：buffer/overlay、convex-hull/voronoi、coord-workbench/reproject、feature-merge/geometry-flatten/dissolve/splitter、topology-check/结构校验。

### 第四阶段：类型债务清偿（2026-09-19）

`noUncheckedIndexedAccess` 严格模式下 1424 个错误清零（62 个文件）：

* 非空断言 `!` 约 97%（索引访问逻辑保证存在的场景）
* 类型声明修正约 10 处（声明与实际数据形态不符）
* 顺带修复 4 个真实运行时缺陷：3 处 ASI 分号缺失（CityGml/Ifc/ThreeDTiles 的 `readAsText` 后被解析为调用）、H3S2GridView 4 处模板绑定笔误

### 第五阶段：清理与文档（2026-09-19）

* 删除无引用的 `src/assets/base.css`（脚手架残留）及 main.css 悬空引用
* README 重写（59 工具清单 + 架构说明 + 快速开始）
* 本文档 + MIGRATION\_PLAN 完成状态标注

## 已知限制

| 项                       | 说明                              |
| ----------------------- | ------------------------------- |
| H3 索引                   | 简化近似实现（非 Uber 官方算法），标注"简化版"     |
| S2 网格                   | 简化切面投影实现，level 0-30 可用但非官方精度    |
| GeoBuf                  | 简化压缩格式，非标准 GeoBuf（标准需 protobuf） |
| GeoJSON→SHP / CSV→SHP   | 仅后端模式（GDAL），纯前端 SHP **写出**未实现   |
| 地图坐标拾取                  | 需联网加载 Leaflet + OSM 瓦片          |
| WMS Capabilities URL 拉取 | 受浏览器 CORS 限制，以粘贴 XML 为主         |

## 后续规划（建议优先级）

### P1（实用价值高）

* [ ] **纯前端 GeoJSON → SHP 写出**：目前 SHP 写出依赖后端 GDAL；可参考 shp-parser 反向实现 DBF/SHP 二进制写出，摆脱后端依赖
* [ ] **地图预览集成**：GeoJSON 工具类（校验/元数据/分片等）加 Leaflet 预览面板，所见即所得
* [ ] **KML/KMZ 支持**：KML 转换器目前仅支持 .kml 文本，补 KMZ（zip）解压入口（复用 shp-parser 的 inflate）

### P2（体验优化）

* [ ] 大文件性能：>50MB GeoJSON 的分片/转换改用 Web Worker，避免卡 UI
* [ ] 工具页最近使用记录（localStorage），首页常用工具置顶
* [ ] 暗色/浅色主题切换

### P3（功能扩展）

* [ ] GPKG（GeoPackage）读写
* [ ] DWG 直接解析（目前仅 DXF 文本）
* [ ] 空间索引（R-tree）加速大点集最近邻
* [ ] LAS 点云在线渲染预览

## 验证命令速查

```bash
pnpm run type-check   # 期望：0 错误
pnpm run build        # 期望：exit 0
pnpm run lint         # ESLint 检查
```

> 注意：验证类型错误时若结果可疑，先删除 `node_modules/.tmp/*.tsbuildinfo` 增量缓存（已知会给出误导性的陈旧结果）。


