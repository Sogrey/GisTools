<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface Tool {
  id: string
  name: string
  description: string
  icon: string
  category: string
  route?: string
  available?: boolean
}

const tools: Tool[] = [
  // === 格式转换 ===
  { id: 'shp-toolbox', name: 'SHP 工具箱', description: 'SHP ↔ GeoJSON 双向转换，含元信息提取，支持纯前端解析与后端转换', icon: '📊', category: '格式转换', route: '/tools/shp-toolbox', available: true },
  { id: 'table-convert', name: '表格转换工具', description: 'CSV/Excel ↔ GeoJSON 双向，自动识别经纬度列，支持度分秒与 BOM', icon: '📋', category: '格式转换', route: '/tools/table-convert', available: true },
  { id: 'geojson-toolbox', name: 'GeoJSON 工具箱', description: '校验 / 美化压缩 / 坐标纠偏 / 元数据四合一', icon: '✅', category: '格式转换', route: '/tools/geojson-toolbox', available: true },
  { id: 'kml-convert', name: 'KML 转换器', description: 'KML ↔ GeoJSON 双向转换，Placemark/几何/属性', icon: '🗺️', category: '格式转换', route: '/tools/kml-convert', available: true },
  { id: 'wkt-wkb', name: 'WKT/WKB 工具箱', description: 'WKT ↔ GeoJSON 与 WKB/EWKB ↔ GeoJSON 双向，全几何类型+SRID', icon: '🔤', category: '格式转换', route: '/tools/wkt-wkb', available: true },
  { id: 'dxf-tool', name: 'DXF 工具箱', description: 'DXF ↔ GeoJSON 双向转换，Point/Line/Polyline/Circle', icon: '📐', category: '格式转换', route: '/tools/dxf-tool', available: true },
  { id: 'gpx-tool', name: 'GPX 工具箱', description: 'GPX ↔ GeoJSON 互转 + 轨迹统计（距离/爬升/速度）', icon: '🚴', category: '格式转换', route: '/tools/gpx-tool', available: true },
  { id: 'topojson-convert', name: 'TopoJSON 转换', description: 'TopoJSON ↔ GeoJSON 互转，共享弧段去重，量化精度可调', icon: '🔗', category: '格式转换', route: '/tools/topojson-convert', available: true },
  { id: 'polyline-codec', name: 'Polyline 编解码', description: 'Google Encoded Polyline 双向编解码，精度 5/6 位', icon: '〰️', category: '格式转换', route: '/tools/polyline-codec', available: true },
  { id: 'geobuf-codec', name: 'GeoBuf 编解码', description: 'GeoJSON ↔ 压缩格式双向编解码，压缩率统计', icon: '📦', category: '格式转换', route: '/tools/geobuf-codec', available: true },
  { id: 'osm-parser', name: 'OSM 解析器', description: 'OpenStreetMap .osm XML → GeoJSON，node/way/relation', icon: '🌍', category: '格式转换', route: '/tools/osm-parser', available: true },

  // === 坐标系统 ===
  { id: 'coord-workbench', name: '坐标转换工作台', description: 'WGS84/GCJ02/BD09/墨卡托/高斯/UTM/ECEF 七系互通，4 椭球', icon: '🧭', category: '坐标系统', route: '/tools/coord-workbench', available: true },
  { id: 'band-lookup', name: '投影带速查', description: '经纬度 → 高斯 3°/6° 带号 + 中央经线 + UTM 带号', icon: '📐', category: '坐标系统', route: '/tools/band-lookup', available: true },
  { id: 'epsg-lookup', name: 'EPSG 速查', description: '56 条常用 EPSG 坐标系对照表，WKT 定义复制', icon: '📚', category: '坐标系统', route: '/tools/epsg-lookup', available: true },
  { id: 'seven-param', name: '七参数/四参数', description: 'Bursa-Wolf 七参数与四参数转换，公共点最小二乘反算', icon: '🔀', category: '坐标系统', route: '/tools/seven-param', available: true },
  { id: 'coord-clean', name: '坐标清洗', description: '精度控制（截断/四舍五入）+ 去重清洗（去重/越界/离群）', icon: '🧹', category: '坐标系统', route: '/tools/coord-clean', available: true },
  { id: 'reproject', name: '批量投影变换', description: 'GeoJSON 批量坐标投影变换 WGS84↔墨卡托↔GCJ02↔BD09', icon: '🔄', category: '坐标系统', route: '/tools/reproject', available: true },
  { id: 'scale-calc', name: '比例尺计算', description: '比例尺 ↔ 地面分辨率互算，DPI，瓦片地面米数', icon: '📏', category: '坐标系统', route: '/tools/scale-calc', available: true },

  // === 空间分析 ===
  { id: 'spatial-analysis', name: '空间分析工具箱', description: '点在多边形/球面面积/几何中心/矩形边界/DP 抽稀', icon: '🔬', category: '空间分析', route: '/tools/spatial-analysis', available: true },
  { id: 'overlay-analysis', name: '多边形叠加分析', description: '相交/并集/差集/对称差（Sutherland-Hodgman 裁剪）', icon: '⊕', category: '空间分析', route: '/tools/overlay-analysis', available: true },
  { id: 'voronoi-triangulation', name: 'Voronoi/Delaunay 三角网', description: 'Bowyer-Watson 三角剖分 + Voronoi 对偶图', icon: '🔺', category: '空间分析', route: '/tools/voronoi-triangulation', available: true },
  { id: 'convex-hull', name: '凸包计算', description: 'Andrew Monotone Chain O(n log n)，面积/周长统计', icon: '⬡', category: '空间分析', route: '/tools/convex-hull', available: true },
  { id: 'nearest-neighbor', name: '最近邻搜索', description: 'KNN + 方位角 + Mutual NN，Haversine 距离', icon: '🎯', category: '空间分析', route: '/tools/nearest-neighbor', available: true },
  { id: 'distance-matrix', name: '距离矩阵', description: 'N×N Haversine 距离矩阵 → CSV，最大/最小/平均统计', icon: '📊', category: '空间分析', route: '/tools/distance-matrix', available: true },
  { id: 'h3-s2-grid', name: 'H3/S2 网格编码', description: 'Plus Codes + S2 Cell ID + H3 索引三合一', icon: '🌐', category: '空间分析', route: '/tools/h3-s2-grid', available: true },
  { id: 'buffer-gen', name: '缓冲区生成', description: '点/线/多边形缓冲区（平面米制近似）', icon: '⭕', category: '空间分析', route: '/tools/buffer-gen', available: true },
  { id: 'geohash', name: 'GeoHash 编解码', description: '经纬度 ↔ GeoHash 双向，精度 1-12，bbox+邻居', icon: '#️⃣', category: '空间分析', route: '/tools/geohash', available: true },
  { id: 'line-resample', name: '线等距重采样', description: '等距加密/抽稀/按数量重采样 + Douglas-Peucker', icon: '📈', category: '空间分析', route: '/tools/line-resample', available: true },

  // === 数据处理 ===
  { id: 'feature-merge', name: '要素合并/拆分', description: 'FeatureCollection 合并/过滤/按属性分组拆分', icon: '🔀', category: '数据处理', route: '/tools/feature-merge', available: true },
  { id: 'geojson-splitter', name: 'GeoJSON 分片', description: '按要素数/体积/属性值分片拆分大 GeoJSON', icon: '✂️', category: '数据处理', route: '/tools/geojson-splitter', available: true },
  { id: 'vws-simplify', name: 'VWS 简化', description: 'Visvalingam-Whyatt 几何简化，面积/百分比模式', icon: '📉', category: '数据处理', route: '/tools/vws-simplify', available: true },
  { id: 'field-calc', name: '属性字段计算器', description: '表达式计算新字段（Math/字符串/条件），预览+批量', icon: '🧮', category: '数据处理', route: '/tools/field-calc', available: true },
  { id: 'dissolve', name: '按属性溶解', description: '按属性分组，同组相邻多边形合并', icon: '♒', category: '数据处理', route: '/tools/dissolve', available: true },
  { id: 'geometry-flatten', name: '几何展平/合并', description: 'Multi* 展平为单要素，或反向合并', icon: '📚', category: '数据处理', route: '/tools/geometry-flatten', available: true },
  { id: 'topology-check', name: '拓扑检查', description: '自相交/缝隙/重叠/环方向检查', icon: '🔍', category: '数据处理', route: '/tools/topology-check', available: true },
  { id: 'map-sheet', name: '图幅编号计算', description: '经纬度↔图幅号互查，新旧标准对照', icon: '🗺️', category: '数据处理', route: '/tools/map-sheet', available: true },

  // === 制图可视化 ===
  { id: 'geojson-to-svg', name: 'GeoJSON → SVG', description: 'GeoJSON 渲染为 SVG 矢量图，可调投影/线宽/填充', icon: '🎨', category: '制图可视化', route: '/tools/geojson-to-svg', available: true },
  { id: 'colormap', name: '色带生成器', description: '13 种预设色带，锚点插值 2-256 级，Cesium 代码片段', icon: '🌈', category: '制图可视化', route: '/tools/colormap', available: true },
  { id: 'choropleth', name: '专题图着色', description: 'GeoJSON 按属性分色渲染，等间隔/分位数，SVG 预览', icon: '📊', category: '制图可视化', route: '/tools/choropleth', available: true },
  { id: 'heatmap', name: '点密度热力图', description: 'Canvas 高斯核叠加渲染，半径/权重/色带可调', icon: '🔥', category: '制图可视化', route: '/tools/heatmap', available: true },
  { id: 'contour', name: '等值线生成', description: 'Marching Squares 网格等值线追踪，SVG 预览', icon: '🏔️', category: '制图可视化', route: '/tools/contour', available: true },
  { id: 'map-layout', name: '地图排版', description: '经纬网/比例尺/指北针/图例框 SVG 生成', icon: '📐', category: '制图可视化', route: '/tools/map-layout', available: true },
  { id: 'tile-tools', name: '瓦片工具箱', description: '瓦片计算（XYZ/TMS 行列号）+ 需求估算（存储/耗时）', icon: '🔲', category: '制图可视化', route: '/tools/tile-tools', available: true },
  { id: 'tile-downloader', name: '瓦片下载脚本', description: '按范围生成 wget 批量下载脚本，5 种底图源', icon: '⬇️', category: '制图可视化', route: '/tools/tile-downloader', available: true },

  // === 三维/CIM ===
  { id: 'cesium-camera', name: 'Cesium 相机参数', description: 'Cartesian3/heading/pitch/roll/setView 代码生成', icon: '📷', category: '三维/CIM', route: '/tools/cesium-camera', available: true },
  { id: '3d-tiles-inspector', name: '3D Tiles 检查器', description: 'tileset.json 解析：层级/geometricError/boundingVolume', icon: '🏗️', category: '三维/CIM', route: '/tools/3d-tiles-inspector', available: true },
  { id: 'czml-generator', name: 'CZML 生成器', description: 'CZML 文档生成：点/线/多边形/动态属性', icon: '📡', category: '三维/CIM', route: '/tools/czml-generator', available: true },
  { id: 'gltf-info', name: 'glTF 元信息', description: 'glTF 2.0/glb 解析：网格/材质/纹理/节点/扩展', icon: '📦', category: '三维/CIM', route: '/tools/gltf-info', available: true },
  { id: 'dem-tools', name: 'DEM 高程工具', description: '坡度坡向/高程统计/剖面插值/晕渲着色', icon: '⛰️', category: '三维/CIM', route: '/tools/dem-tools', available: true },
  { id: 'ifc-parser', name: 'IFC 解析', description: 'IFC STEP 格式解析：版本/实体统计/属性集', icon: '🏢', category: '三维/CIM', route: '/tools/ifc-parser', available: true },
  { id: 'citygml-parser', name: 'CityGML 解析', description: 'CityGML XML 解析：版本/building/LOD 分布', icon: '🏙️', category: '三维/CIM', route: '/tools/citygml-parser', available: true },
  { id: 'pointcloud-info', name: '点云元信息', description: 'LAS/LAZ 二进制头解析：版本/点数/bbox/缩放', icon: '☁️', category: '三维/CIM', route: '/tools/pointcloud-info', available: true },
  { id: 'building-volume', name: '建筑体积估算', description: '底面+层数层高 → 体积/表面积估算', icon: '🧱', category: '三维/CIM', route: '/tools/building-volume', available: true },

  // === 地图服务 ===
  { id: 'wms-capabilities', name: 'WMS Capabilities 解析', description: 'WMS GetCapabilities XML 解析：图层树/CRS/格式', icon: '🌐', category: '地图服务', route: '/tools/wms-capabilities', available: true },
  { id: 'arcgis-rest', name: 'ArcGIS REST 探测', description: 'ArcGIS REST 端点 URL 构建：query/export/legend', icon: '🗺️', category: '地图服务', route: '/tools/arcgis-rest', available: true },
  { id: 'tilejson', name: 'TileJSON 查看', description: 'TileJSON 解析与预览：tiles URL/bounds/zoom', icon: '📋', category: '地图服务', route: '/tools/tilejson', available: true },
  { id: 'wms-url-builder', name: 'WMS/WMTS URL 构建', description: 'WMS GetMap + WMTS GetTile URL 构建器', icon: '🔗', category: '地图服务', route: '/tools/wms-url-builder', available: true },
  { id: 'map-picker', name: '地图坐标拾取', description: 'Leaflet 地图点击拾取坐标（需联网）', icon: '📍', category: '地图服务', route: '/tools/map-picker', available: true },

  // === 其他工具 ===
  { id: 'base64', name: 'Base64 工具', description: 'Base64 ↔ 文本/文件双向编解码，Data URL 识别', icon: '🔐', category: '其他工具', route: '/tools/base64', available: true },
]

const categories = ['全部', '格式转换', '坐标系统', '空间分析', '数据处理', '制图可视化', '三维/CIM', '地图服务', '其他工具']
const activeCategory = ref('全部')

const filteredTools = computed(() => {
  if (activeCategory.value === '全部') {
    return tools
  }
  return tools.filter(tool => tool.category === activeCategory.value)
})

const handleToolClick = (tool: Tool) => {
  if (tool.available && tool.route) {
    router.push(tool.route)
  } else {
    alert('该功能正在开发中，敬请期待！')
  }
}
</script>

<template>
  <div class="container">
    <!-- 头部区域 -->
    <header class="header">
      <div class="header-content">
        <div class="logo">
          <div class="logo-icon">GIS</div>
          <div class="logo-text">Tools</div>
        </div>
        <nav class="nav">
          <a href="#" class="nav-link">首页</a>
          <a href="#" class="nav-link">工具</a>
          <a href="#" class="nav-link">文档</a>
          <a href="#" class="nav-link">关于</a>
        </nav>
      </div>
      <!-- 动态背景效果 -->
      <div class="header-bg">
        <div class="grid-line"></div>
        <div class="grid-line"></div>
        <div class="grid-line"></div>
      </div>
    </header>

    <!-- 主标题区域 -->
    <section class="hero">
      <div class="hero-bg">
        <div class="gradient-orb orb-1"></div>
        <div class="gradient-orb orb-2"></div>
        <div class="gradient-orb orb-3"></div>
      </div>
      <div class="hero-content">
        <h1 class="hero-title">
          <span class="gradient-text">GIS 工具箱</span>
        </h1>
        <p class="hero-subtitle">
          专业、高效的在线 GIS 数据处理工具平台<br>
          支持多种格式转换、数据验证、坐标转换等功能
        </p>
        <div class="hero-stats">
          <div class="stat-item">
            <div class="stat-number">60+</div>
            <div class="stat-label">在线工具</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">100%</div>
            <div class="stat-label">免费使用</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">∞</div>
            <div class="stat-label">无需注册</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 工具分类 -->
    <section class="category-section">
      <div class="category-scroll">
        <button
          v-for="cat in categories"
          :key="cat"
          :class="['category-btn', { active: activeCategory === cat }]"
          @click="activeCategory = cat"
        >
          {{ cat }}
        </button>
      </div>
    </section>

    <!-- 工具卡片网格 -->
    <section class="tools-section">
      <div class="tools-grid">
        <div
          v-for="tool in filteredTools"
          :key="tool.id"
          class="tool-card"
          :class="{ 'available': tool.available, 'unavailable': !tool.available }"
          @click="handleToolClick(tool)"
        >
          <div class="tool-icon">{{ tool.icon }}</div>
          <div class="tool-content">
            <div class="tool-category">{{ tool.category }}</div>
            <h3 class="tool-name">{{ tool.name }}</h3>
            <p class="tool-description">{{ tool.description }}</p>
          </div>
          <button class="tool-btn">
            <span>{{ tool.available ? '立即使用' : '敬请期待' }}</span>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4.16699 10H15.8337M15.8337 10L9.16699 3.33333M15.8337 10L9.16699 16.6667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </section>

    <!-- 功能特点 -->
    <section class="features-section">
      <h2 class="section-title">为什么选择我们</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3 class="feature-title">极速处理</h3>
          <p class="feature-desc">基于 WebAssembly 技术，本地处理，无需上传服务器，保护数据隐私</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3 class="feature-title">安全可靠</h3>
          <p class="feature-desc">所有数据处理均在浏览器本地完成，数据不会离开您的设备</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎨</div>
          <h3 class="feature-title">简洁易用</h3>
          <p class="feature-desc">直观的界面设计，无需学习即可快速上手，提高工作效率</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📱</div>
          <h3 class="feature-title">跨平台</h3>
          <p class="feature-desc">支持桌面端和移动端浏览器，随时随地处理您的 GIS 数据</p>
        </div>
      </div>
    </section>

    <!-- 页脚 -->
    <footer class="footer">
      <div class="footer-content">
        <div class="footer-section">
          <div class="footer-logo">
            <div class="logo-icon">GIS</div>
            <div class="logo-text">Tools</div>
          </div>
          <p class="footer-desc">专业的在线 GIS 数据处理工具平台</p>
        </div>
        <div class="footer-section">
          <h4 class="footer-title">快速链接</h4>
          <ul class="footer-links">
            <li><a href="#">首页</a></li>
            <li><a href="#">工具</a></li>
            <li><a href="#">文档</a></li>
            <li><a href="#">关于我们</a></li>
          </ul>
        </div>
        <div class="footer-section">
          <h4 class="footer-title">联系方式</h4>
          <ul class="footer-links">
            <li><a href="#">GitHub</a></li>
            <li><a href="#">Email</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; 2025 GIS Tools. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* 基础样式 */
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%);
  color: #ffffff;
  overflow-x: hidden;
}

/* 头部 */
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: rgba(10, 10, 15, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.5rem;
  font-weight: 700;
  cursor: pointer;
}

.logo-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  color: white;
  box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
}

.logo-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.nav {
  display: flex;
  gap: 2rem;
}

.nav-link {
  color: #a0a0a0;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s ease;
  position: relative;
}

.nav-link:hover {
  color: #ffffff;
}

.nav-link::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 0;
  height: 2px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.nav-link:hover::after {
  width: 100%;
}

/* 头部背景装饰 */
.header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.grid-line {
  position: absolute;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(102, 126, 234, 0.1) 50%,
    transparent 100%
  );
  animation: gridMove 3s ease-in-out infinite;
}

.grid-line:nth-child(2) {
  top: 50%;
  animation-delay: 1s;
}

.grid-line:nth-child(3) {
  bottom: 0;
  animation-delay: 2s;
}

@keyframes gridMove {
  0%, 100% {
    opacity: 0.3;
  }
  50% {
    opacity: 0.8;
  }
}

/* Hero 区域 */
.hero {
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8rem 2rem 4rem;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: orbFloat 8s ease-in-out infinite;
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  top: -100px;
  left: -100px;
}

.orb-2 {
  width: 300px;
  height: 300px;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  bottom: -50px;
  right: -50px;
  animation-delay: 2s;
}

.orb-3 {
  width: 250px;
  height: 250px;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation-delay: 4s;
}

@keyframes orbFloat {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(20px, -20px) scale(1.1);
  }
}

.hero-content {
  position: relative;
  text-align: center;
  max-width: 900px;
}

.hero-title {
  font-size: 4rem;
  font-weight: 800;
  margin-bottom: 1.5rem;
  line-height: 1.1;
}

.gradient-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 5s ease-in-out infinite;
  background-size: 200% 200%;
}

@keyframes gradientShift {
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
}

.hero-subtitle {
  font-size: 1.25rem;
  color: #a0a0a0;
  margin-bottom: 3rem;
  line-height: 1.8;
}

.hero-stats {
  display: flex;
  justify-content: center;
  gap: 4rem;
  flex-wrap: wrap;
}

.stat-item {
  text-align: center;
}

.stat-number {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 0.875rem;
  color: #a0a0a0;
  margin-top: 0.5rem;
}

/* 分类区域 */
.category-section {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.category-scroll {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding: 1rem 0;
  scrollbar-width: none;
}

.category-scroll::-webkit-scrollbar {
  display: none;
}

.category-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #a0a0a0;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.category-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(102, 126, 234, 0.5);
}

.category-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-color: transparent;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
}

/* 工具区域 */
.tools-section {
  padding: 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.tool-card {
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
  transition: all 0.3s ease;
  overflow: hidden;
  cursor: pointer;
}

.tool-card.available:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(102, 126, 234, 0.3);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.1);
}

.tool-card.unavailable {
  opacity: 0.5;
  cursor: not-allowed;
}

.tool-card.unavailable:hover {
  transform: none;
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: none;
}

.tool-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    rgba(102, 126, 234, 0.5) 50%,
    transparent 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.tool-card.available:hover::before {
  opacity: 1;
}

.tool-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(102, 126, 234, 0.3);
  box-shadow: 0 8px 32px rgba(102, 126, 234, 0.1);
}

.tool-card:hover::before {
  opacity: 1;
}

.tool-icon {
  font-size: 2.5rem;
  margin-bottom: 1rem;
  filter: drop-shadow(0 0 20px rgba(102, 126, 234, 0.3));
}

.tool-category {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 20px;
  font-size: 0.75rem;
  color: #667eea;
  margin-bottom: 0.75rem;
}

.tool-name {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: #ffffff;
}

.tool-description {
  color: #a0a0a0;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

.tool-btn {
  width: 100%;
  padding: 0.875rem 1.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.tool-btn:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
}

.tool-btn svg {
  transition: transform 0.3s ease;
}

.tool-btn:hover svg {
  transform: translateX(4px);
}

/* 功能特点区域 */
.features-section {
  padding: 6rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
}

.section-title {
  text-align: center;
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 4rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
}

.feature-card {
  text-align: center;
  padding: 2rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  transition: all 0.3s ease;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(102, 126, 234, 0.2);
  transform: translateY(-4px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1.5rem;
  filter: drop-shadow(0 0 20px rgba(102, 126, 234, 0.3));
}

.feature-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #ffffff;
}

.feature-desc {
  color: #a0a0a0;
  font-size: 0.875rem;
  line-height: 1.6;
}

/* 页脚 */
.footer {
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 4rem 2rem 2rem;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 3rem;
  margin-bottom: 3rem;
}

.footer-section .footer-logo {
  margin-bottom: 1rem;
}

.footer-desc {
  color: #a0a0a0;
  font-size: 0.875rem;
  line-height: 1.6;
}

.footer-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: #ffffff;
}

.footer-links {
  list-style: none;
}

.footer-links li {
  margin-bottom: 0.75rem;
}

.footer-links a {
  color: #a0a0a0;
  text-decoration: none;
  font-size: 0.875rem;
  transition: color 0.3s ease;
}

.footer-links a:hover {
  color: #667eea;
}

.footer-bottom {
  max-width: 1400px;
  margin: 0 auto;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.footer-bottom p {
  color: #606060;
  font-size: 0.875rem;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1rem;
  }

  .hero-stats {
    gap: 2rem;
  }

  .stat-number {
    font-size: 2rem;
  }

  .nav {
    gap: 1rem;
  }

  .tools-grid {
    grid-template-columns: 1fr;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
