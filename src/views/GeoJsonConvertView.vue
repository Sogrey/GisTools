<template>
  <div class="container">
    <!-- 头部 -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.16699 10H15.8337M15.8337 10L9.16699 3.33333M15.8337 10L9.16699 16.6667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(180 10 10)"/>
        </svg>
        返回首页
      </button>
      <h1 class="page-title">GeoJSON 转换为 SHP</h1>
    </header>

    <!-- 主内容 -->
    <main class="main-content">
      <!-- 上传区域 -->
      <div class="upload-section">
        <!-- 样例文件下载提示 -->
        <div class="sample-download">
          <span class="sample-text">没有 GeoJSON 文件？</span>
          <button class="sample-link" @click="downloadSample">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 13.3333V3.33333M10 13.3333L6.66667 10M10 13.3333L13.3333 10M3.33333 16.6667H16.6667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            下载样例文件
          </button>
        </div>

        <div
          class="upload-zone"
          :class="{ 'dragging': isDragging, 'has-file': selectedFile }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop="handleDrop"
          @click="$refs.fileInput?.click()"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".geojson,.json"
            @change="handleFileSelect"
            style="display: none"
          />

          <div v-if="!selectedFile" class="upload-prompt">
            <div class="upload-icon">📁</div>
            <div class="upload-text">
              <p>拖拽文件到此处或点击上传</p>
              <p class="upload-hint">仅支持 .geojson 或 .json 格式文件</p>
            </div>
          </div>

          <div v-else class="file-info">
            <div class="file-icon">📄</div>
            <div class="file-details">
              <div class="file-name">{{ fileInfo.name }}</div>
              <div class="file-meta">{{ formattedFileSize }}</div>
            </div>
            <button class="remove-btn" @click.stop="removeFile">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.16699 4.16699L15.8337 15.8333M15.8337 4.16699L4.16699 15.8333" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 配置区域 -->
      <div class="config-section" v-if="selectedFile">
        <h2 class="section-title">转换配置</h2>

        <div class="form-group">
          <label class="form-label">文件编码</label>
          <select v-model="encoding" class="form-select">
            <option v-for="enc in encodingOptions" :key="enc.value" :value="enc.value">
              {{ enc.label }}
            </option>
          </select>
          <p class="form-hint">选择正确的编码以确保中文字符正确显示</p>
        </div>

        <!-- 提示信息 -->
        <div class="info-box">
          <div class="info-icon">ℹ️</div>
          <div class="info-content">
            <p><strong>说明：</strong>GeoJSON 可以包含点、线、面等几何类型。转换时会自动检测几何类型并创建对应的 Shapefile。</p>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions" v-if="selectedFile">
        <button
          class="btn btn-primary"
          :disabled="uploading"
          @click="uploadFile"
        >
          <span v-if="!uploading">开始转换</span>
          <span v-else>转换中... {{ progress }}%</span>
        </button>
        <button
          class="btn btn-secondary"
          @click="resetForm"
        >
          重置
        </button>
      </div>

      <!-- 进度条 -->
      <div class="progress-section" v-if="uploading">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <!-- 结果区域 -->
      <div class="result-section" v-if="result.success || result.error">
        <div v-if="result.success" class="result-success">
          <div class="result-icon">✅</div>
          <div class="result-content">
            <h3 class="result-title">转换成功！</h3>
            <p class="result-message">{{ result.message }}</p>
            <div class="result-stats">
              <div class="stat-item">
                <div class="stat-label">几何类型</div>
                <div class="stat-value">{{ result.geometryType }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">要素数量</div>
                <div class="stat-value">{{ result.featureCount }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">文件大小</div>
                <div class="stat-value">{{ formatFileSize(result.fileSize) }}</div>
              </div>
            </div>
            <button v-if="result.downloadUrl" class="btn btn-download" @click="downloadFile">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 13.3333V3.33333M10 13.3333L6.66667 10M10 13.3333L13.3333 10M3.33333 16.6667H16.6667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              下载 SHP 文件
            </button>
            <div v-else-if="result.useMock" class="mock-notice">
              <span class="mock-icon">⚠️</span>
              <span>Mock 模式：请安装 GDAL 以生成真正的 Shapefile</span>
            </div>
          </div>
        </div>

        <div v-if="result.error" class="result-error">
          <div class="result-icon">❌</div>
          <div class="result-content">
            <h3 class="result-title">转换失败</h3>
            <p class="result-message">{{ result.error }}</p>
            <button class="btn btn-secondary" @click="resetForm">
              重试
            </button>
          </div>
        </div>
      </div>

    <!-- 使用说明 -->
    <section class="info-section" v-if="!result.success">
      <h2 class="section-title">使用说明</h2>
      <div class="info-content">
        <h3 class="info-heading">什么是 GeoJSON?</h3>
        <p class="info-text">
          GeoJSON 是一种基于 JSON 的地理数据格式，用于编码各种地理数据结构。
          它是 Web 地图应用中最常用的地理数据格式之一。
        </p>

        <h3 class="info-heading">为什么要转换为 SHP?</h3>
        <ul class="info-list">
          <li><strong>桌面 GIS 软件：</strong>Shapefile 是 ArcGIS、QGIS 等软件的原生格式，兼容性最好。</li>
          <li><strong>数据共享：</strong>许多政府机构和传统 GIS 系统使用 Shapefile 格式交换数据。</li>
          <li><strong>离线编辑：</strong>Shapefile 可以在离线状态下进行编辑和分析。</li>
          <li><strong>文件大小：</strong>对于大量数据，Shapefile 可以比 GeoJSON 更紧凑。</li>
        </ul>
      </div>
    </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 状态管理
const uploading = ref(false)
const selectedFile = ref<File | null>(null)
const fileInfo = reactive({
  name: '',
  size: 0,
  type: ''
})

// 编码选项
const encoding = ref('UTF-8')
const encodingOptions = [
  { value: 'UTF-8', label: 'UTF-8 (通用)' },
  { value: 'GBK', label: 'GBK (简体中文)' },
  { value: 'GB2312', label: 'GB2312 (国标)' },
  { value: 'BIG5', label: 'BIG5 (繁体中文)' }
]

// 拖拽上传
const isDragging = ref(false)

// 进度
const progress = ref(0)

// 结果
const result = reactive({
  success: false,
  message: '',
  featureCount: 0,
  fileSize: 0,
  geometryType: '',
  downloadUrl: '',
  error: '',
  useMock: false
})

const formattedFileSize = computed(() => {
  if (!fileInfo.size) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = fileInfo.size
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
})

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    selectFile(file)
  }
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragging.value = false

  const file = event.dataTransfer?.files[0]
  if (file) {
    selectFile(file)
  }
}

const selectFile = (file: File) => {
  if (!file.name.toLowerCase().endsWith('.geojson') && !file.name.toLowerCase().endsWith('.json')) {
    alert('请上传 .geojson 或 .json 格式的文件')
    return
  }

  selectedFile.value = file
  fileInfo.name = file.name
  fileInfo.size = file.size
  fileInfo.type = file.type || 'application/json'

  // 重置结果
  result.success = false
  result.message = ''
  result.error = ''
}

const removeFile = () => {
  selectedFile.value = null
  fileInfo.name = ''
  fileInfo.size = 0
  fileInfo.type = ''

  result.success = false
  result.message = ''
  result.error = ''
}

const uploadFile = async () => {
  if (!selectedFile.value) {
    alert('请先选择文件')
    return
  }

  uploading.value = true
  progress.value = 0
  result.success = false
  result.error = ''

  try {
    console.log('[前端] 开始上传文件:', selectedFile.value.name)
    console.log('[前端] 文件大小:', selectedFile.value.size)
    console.log('[前端] 编码:', encoding.value)

    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('encoding', encoding.value)

    console.log('[前端] 准备发送请求到: http://localhost:8001/api/geojson/to-shp')

    // 使用 XMLHttpRequest 获取上传进度
    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://localhost:8001/api/geojson/to-shp', true)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded * 100) / event.total)
        progress.value = percent
        console.log('[前端] 上传进度:', percent + '%')
      }
    }

    xhr.onload = () => {
      console.log('[前端] 响应状态:', xhr.status)
      console.log('[前端] 响应内容:', xhr.responseText)

      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText)
          console.log('[前端] 解析后数据:', data)

          result.success = data.success
          result.message = data.message
          result.featureCount = data.feature_count
          result.fileSize = data.file_size
          result.geometryType = data.geometry_type || 'Unknown'
          result.downloadUrl = data.download_url ? `http://localhost:8001${data.download_url}` : ''
          result.error = data.error || ''
          result.useMock = data.message && data.message.includes('Mock')

          if (data.success) {
            progress.value = 100
            console.log('[前端] 转换成功!')
          } else {
            throw new Error(data.error || '转换失败')
          }
        } catch (parseError) {
          console.error('[前端] JSON解析失败:', parseError)
          throw new Error('服务器返回数据格式错误')
        }
      } else {
        throw new Error(`服务器错误: ${xhr.status}`)
      }
      uploading.value = false
    }

    xhr.onerror = (error) => {
      console.error('[前端] 请求错误:', error)
      result.success = false
      result.error = '网络错误，请检查后端服务是否启动'
      progress.value = 0
      uploading.value = false
    }

    console.log('[前端] 发送请求...')
    xhr.send(formData)

  } catch (error) {
    console.error('[前端] 上传失败:', error)
    result.success = false
    result.error = error instanceof Error ? error.message : '上传失败，请重试'
    progress.value = 0
    uploading.value = false
  }
}

const downloadFile = () => {
  if (result.downloadUrl) {
    window.open(result.downloadUrl, '_blank')
  }
}

const resetForm = () => {
  removeFile()
  progress.value = 0
  result.success = false
  result.message = ''
  result.error = ''
}

const goBack = () => {
  router.push('/')
}

// 下载样例文件
const downloadSample = () => {
  const link = document.createElement('a')
  link.href = '/GisTools/samples/中华人民共和国.geojson'
  link.download = '中华人民共和国.geojson'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`
}
</script>

<style scoped>
.container {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%);
  color: #ffffff;
  padding: 2rem;
}

.header {
  max-width: 1200px;
  margin: 0 auto 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #a0a0a0;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.875rem;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border-color: rgba(102, 126, 234, 0.3);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.main-content {
  max-width: 800px;
  margin: 0 auto;
}

.upload-section {
  margin-bottom: 2rem;
}

.sample-download {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.75rem 1.5rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
}

.sample-text {
  font-size: 0.875rem;
  color: #a0a0a0;
}

.sample-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.sample-link:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.sample-link svg {
  flex-shrink: 0;
}

.upload-zone {
  border: 2px dashed rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 4rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.02);
}

.upload-zone:hover,
.upload-zone.dragging {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.upload-zone.has-file {
  padding: 2rem;
  cursor: default;
}

.upload-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.upload-icon {
  font-size: 4rem;
  opacity: 0.6;
}

.upload-text p {
  margin: 0.25rem 0;
  font-size: 1rem;
  color: #ffffff;
}

.upload-hint {
  font-size: 0.875rem !important;
  color: #a0a0a0 !important;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.file-icon {
  font-size: 2.5rem;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 0.25rem;
  word-break: break-all;
}

.file-meta {
  font-size: 0.875rem;
  color: #a0a0a0;
}

.remove-btn {
  padding: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #ef4444;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

.config-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: #ffffff;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #a0a0a0;
  margin-bottom: 0.75rem;
}

.form-select {
  width: 100%;
  padding: 0.875rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.form-select:hover,
.form-select:focus {
  border-color: rgba(16, 185, 129, 0.5);
  outline: none;
}

.form-select option {
  background: #1a1a2e;
  color: #ffffff;
}

.form-hint {
  font-size: 0.75rem;
  color: #606060;
  margin-top: 0.5rem;
}

.info-box {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 8px;
}

.info-icon {
  font-size: 1.5rem;
}

.info-content p {
  margin: 0;
  font-size: 0.875rem;
  color: #a0a0a0;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

.btn {
  padding: 0.875rem 2rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn-primary {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  flex: 1;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #a0a0a0;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.btn-download {
  background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
  color: #ffffff;
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1rem;
}

.btn-download:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.4);
}

.mock-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  color: #f59e0b;
  font-size: 0.875rem;
}

.mock-icon {
  font-size: 1.25rem;
}

.progress-section {
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.result-section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
}

.result-success,
.result-error {
  display: flex;
  gap: 1.5rem;
}

.result-icon {
  font-size: 3rem;
}

.result-content {
  flex: 1;
}

.result-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  color: #ffffff;
}

.result-message {
  font-size: 0.875rem;
  color: #a0a0a0;
  margin-bottom: 1.5rem;
}

.result-stats {
  display: flex;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.stat-item {
  text-align: left;
}

.stat-label {
  font-size: 0.75rem;
  color: #606060;
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
}

/* 使用说明区域 */
.info-section {
  max-width: 800px;
  margin: 3rem auto 0;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 2rem;
}

.info-content {
  line-height: 1.8;
}

.info-heading {
  font-size: 1.125rem;
  font-weight: 600;
  color: #ffffff;
  margin: 1.5rem 0 0.75rem;
}

.info-text {
  font-size: 0.9375rem;
  color: #a0a0a0;
  margin-bottom: 1.5rem;
  line-height: 1.8;
}

.info-list {
  list-style: none;
  padding: 0;
}

.info-list li {
  font-size: 0.9375rem;
  color: #a0a0a0;
  margin-bottom: 0.75rem;
  padding-left: 1.5rem;
  position: relative;
  line-height: 1.8;
}

.info-list li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}

@media (max-width: 768px) {
  .container {
    padding: 1rem;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .page-title {
    font-size: 1.25rem;
  }

  .upload-zone {
    padding: 2rem 1rem;
  }

  .file-info {
    flex-direction: column;
    text-align: center;
  }

  .file-details {
    text-align: center;
  }

  .result-stats {
    flex-direction: column;
    gap: 1rem;
  }

  .actions {
    flex-direction: column;
  }

  .result-success,
  .result-error {
    flex-direction: column;
    text-align: center;
  }
}
</style>
