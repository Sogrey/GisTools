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
  {
    id: 'geojson-convert',
    name: 'GeoJSON 转换',
    description: '支持多种GIS格式的双向转换',
    icon: '🗺️',
    category: '格式转换',
    available: false
  },
  {
    id: 'kml-convert',
    name: 'KML/KMZ 转换',
    description: 'Google Earth 格式转换工具',
    icon: '📍',
    category: '格式转换',
    available: false
  },
  {
    id: 'shp-convert',
    name: 'Shapefile 转换',
    description: 'ESRI Shapefile 格式处理',
    icon: '📊',
    category: '格式转换',
    route: '/tools/shp-convert',
    available: true
  },
  {
    id: 'geojson-validate',
    name: 'GeoJSON 验证',
    description: '验证和修复 GeoJSON 文件',
    icon: '✅',
    category: '数据处理',
    available: false
  },
  {
    id: 'coordinate-convert',
    name: '坐标转换',
    description: '多种坐标系统转换',
    icon: '🎯',
    category: '坐标系统',
    available: false
  },
  {
    id: 'geojson-viewer',
    name: 'GeoJSON 查看器',
    description: '在线预览 GeoJSON 数据',
    icon: '👁️',
    category: '数据查看',
    available: false
  },
  {
    id: 'geojson-editor',
    name: 'GeoJSON 编辑器',
    description: '在线编辑 GeoJSON 文件',
    icon: '✏️',
    category: '数据编辑',
    available: false
  },
  {
    id: 'geojson-minify',
    name: 'GeoJSON 压缩',
    description: '压缩和优化 GeoJSON 文件',
    icon: '📦',
    category: '数据处理',
    available: false
  }
]

const categories = ['全部', '格式转换', '数据处理', '坐标系统', '数据查看', '数据编辑']
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
            <div class="stat-number">8+</div>
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
