<template>
  <div class="container">
    <!-- 头部 -->
    <header class="header">
      <button class="back-btn" @click="goBack">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.16699 10H15.8337M15.8337 10L9.16699 3.33333M15.8337 10L9.16699 16.6667"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            transform="rotate(180 10 10)"
          />
        </svg>
        返回首页
      </button>
      <h1 class="page-title">GeoJSON 格式验证</h1>
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
          :class="{ dragging: isDragging, 'has-file': selectedFile }"
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
              <p class="upload-hint">仅支持 .geojson,.json 格式文件</p>
            </div>
          </div>

          <div v-else class="file-info">
            <div class="file-icon">📄</div>
            <div class="file-details">
              <div class="file-name">{{ fileInfo.name }}</div>
              <div class="file-meta">{{ formattedFileSize }}</div>
            </div>
            <button class="remove-btn" @click.stop="removeFile">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4.16699 4.16699L15.8337 15.8333M15.8337 4.16699L4.16699 15.8333"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions" v-if="selectedFile">
        <button class="btn btn-primary" :disabled="validating" @click="validateFile">
          <span v-if="!validating">开始验证</span>
          <span v-else>验证中...</span>
        </button>
        <button class="btn btn-secondary" @click="resetForm">重置</button>
      </div>

      <!-- 结果区域 -->
      <div class="result-section" v-if="validationResult">
        <div v-if="validationResult.valid" class="result-success">
          <div class="result-icon">✅</div>
          <div class="result-content">
            <h3 class="result-title">验证通过！</h3>
            <div class="result-details">
              <div class="detail-item">
                <div class="detail-label">GeoJSON 类型</div>
                <div class="detail-value">{{ validationResult.type }}</div>
              </div>
              <div v-if="validationResult.crs" class="detail-item">
                <div class="detail-label">坐标系统</div>
                <div class="detail-value">{{ validationResult.crs }}</div>
              </div>
              <div v-if="validationResult.feature_count !== undefined" class="detail-item">
                <div class="detail-label">要素数量</div>
                <div class="detail-value">{{ validationResult.feature_count }}</div>
              </div>
              <div v-if="validationResult.geometry_count !== undefined" class="detail-item">
                <div class="detail-label">几何对象</div>
                <div class="detail-value">{{ validationResult.geometry_count }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="result-error">
          <div class="result-icon">❌</div>
          <div class="result-content">
            <h3 class="result-title">验证失败</h3>
            <p class="result-message">{{ validationResult.error }}</p>
            <button class="btn btn-secondary" @click="resetForm">重试</button>
          </div>
        </div>
      </div>

      <!-- 警告和错误区域 -->
      <div
        v-if="
          validationResult &&
          validationResult.valid &&
          (validationResult.errors.length > 0 || validationResult.warnings.length > 0)
        "
        class="validation-section"
      >
        <div v-if="validationResult.errors.length > 0" class="error-list">
          <h4 class="list-title">
            <span class="error-icon">⚠️</span> 错误 ({{ validationResult.errors.length }})
          </h4>
          <ul class="list-content">
            <li v-for="(error, idx) in validationResult.errors" :key="idx">
              {{ error }}
            </li>
          </ul>
        </div>

        <div v-if="validationResult.warnings.length > 0" class="warning-list">
          <h4 class="list-title">
            <span class="warning-icon">ℹ️</span> 警告 ({{ validationResult.warnings.length }})
          </h4>
          <ul class="list-content">
            <li v-for="(warning, idx) in validationResult.warnings" :key="idx">
              {{ warning }}
            </li>
          </ul>
        </div>
      </div>

      <!-- 边界框信息 -->
      <div
        v-if="validationResult && validationResult.valid && validationResult.bounds"
        class="bounds-section"
      >
        <h4 class="section-subtitle">数据边界框</h4>
        <div class="bounds-grid">
          <div class="bound-item">
            <div class="bound-label">最小 X (经度)</div>
            <div class="bound-value">{{ validationResult.bounds.min_x.toFixed(6) }}</div>
          </div>
          <div class="bound-item">
            <div class="bound-label">最大 X (经度)</div>
            <div class="bound-value">{{ validationResult.bounds.max_x.toFixed(6) }}</div>
          </div>
          <div class="bound-item">
            <div class="bound-label">最小 Y (纬度)</div>
            <div class="bound-value">{{ validationResult.bounds.min_y.toFixed(6) }}</div>
          </div>
          <div class="bound-item">
            <div class="bound-label">最大 Y (纬度)</div>
            <div class="bound-value">{{ validationResult.bounds.max_y.toFixed(6) }}</div>
          </div>
        </div>
      </div>

      <!-- 有效性统计 -->
      <div
        v-if="
          validationResult &&
          validationResult.valid &&
          validationResult.invalid_geometry_count !== undefined
        "
        class="stats-section"
      >
        <h4 class="section-subtitle">有效性统计</h4>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-label">有效几何</div>
            <div class="stat-value success-value">{{ validationResult.valid_geometry_count }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-label">无效几何</div>
            <div class="stat-value error-value">{{ validationResult.invalid_geometry_count }}</div>
          </div>
        </div>
      </div>

      <!-- 使用说明 -->
      <section class="info-section" v-if="!selectedFile && !validationResult">
        <h2 class="section-title">使用说明</h2>
        <div class="info-content">
          <h3 class="info-heading">GeoJSON 格式验证</h3>
          <p class="info-text">
            GeoJSON 验证工具可以检查文件的格式正确性、几何对象有效性、坐标范围等。
            这有助于在使用前发现潜在的问题，避免数据处理过程中的错误。
          </p>

          <h3 class="info-heading">验证内容</h3>
          <ul class="info-list">
            <li><strong>基本结构：</strong>验证 JSON 格式是否正确，是否包含必需的 type 字段。</li>
            <li>
              <strong>几何对象：</strong>检查每个要素的 geometry 字段是否有效，坐标格式是否正确。
            </li>
            <li><strong>坐标系统：</strong>检测文件中是否包含坐标系统信息。</li>
            <li><strong>边界框：</strong>计算数据的地理范围（最小/最大经纬度）。</li>
            <li><strong>空值检查：</strong>识别空的 FeatureCollection 或缺失的 geometry。</li>
          </ul>

          <h3 class="info-heading">支持的格式</h3>
          <p class="info-text">
            支持 FeatureCollection、Feature、GeometryCollection 等常见格式，以及单个
            Point、LineString、Polygon 等几何类型。
          </p>
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
const validating = ref(false)
const selectedFile = ref<File | null>(null)
const fileInfo = reactive({
  name: '',
  size: 0,
  type: '',
})

// 验证结果
const validationResult = ref<ValidationResult | null>(null)

// 拖拽上传
const isDragging = ref(false)

// 文件输入框引用
const fileInput = ref<HTMLInputElement | null>(null)

// 暴露给模板
defineExpose({
  fileInput
})

interface ValidationResult {
  valid: boolean
  type?: string
  crs?: string
  feature_count?: number
  geometry_count?: number
  valid_geometry_count?: number
  invalid_geometry_count?: number
  errors: string[]
  warnings: string[]
  bounds?: {
    min_x: number
    max_x: number
    min_y: number
    max_y: number
  }
  error?: string
}

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
    alert('请上传 .geojson 格式的文件')
    return
  }

  selectedFile.value = file
  fileInfo.name = file.name
  fileInfo.size = file.size
  fileInfo.type = file.type || 'application/json'

  // 重置结果
  validationResult.value = null
}

const removeFile = () => {
  selectedFile.value = null
  fileInfo.name = ''
  fileInfo.size = 0
  fileInfo.type = ''

  validationResult.value = null
}

const validateFile = async () => {
  if (!selectedFile.value) {
    alert('请先选择文件')
    return
  }

  validating.value = true
  validationResult.value = null

  try {
    console.log('[前端] 开始验证文件:', selectedFile.value.name)
    console.log('[前端] 文件大小:', selectedFile.value.size)

    const formData = new FormData()
    formData.append('file', selectedFile.value)

    console.log('[前端] 准备发送请求到: http://localhost:8001/api/geojson/validate')

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://localhost:8001/api/geojson/validate', true)

    xhr.onload = () => {
      console.log('[前端] 响应状态:', xhr.status)
      console.log('[前端] 响应内容:', xhr.responseText)

      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText)
          console.log('[前端] 解析后数据:', data)

          validationResult.value = data

          if (data.valid) {
            console.log('[前端] 验证成功!')
          } else {
            console.error('[前端] 验证失败:', data.error)
          }
        } catch (parseError) {
          console.error('[前端] JSON解析失败:', parseError)
        }
      } else {
        validationResult.value = {
          valid: false,
          error: `服务器错误: ${xhr.status}`,
          errors: [],
          warnings: [],
        }
      }

      validating.value = false
    }

    xhr.onerror = (error) => {
      console.error('[前端] 请求错误:', error)
      validationResult.value = {
        valid: false,
        error: '网络错误，请检查后端服务是否启动',
        errors: [],
        warnings: [],
      }
      validating.value = false
    }

    xhr.send(formData)
  } catch (error) {
    console.error('[前端] 验证失败:', error)
    validationResult.value = {
      valid: false,
      error: error instanceof Error ? error.message : '验证失败，请重试',
      errors: [],
      warnings: [],
    }
    validating.value = false
  }
}

const resetForm = () => {
  removeFile()
  validationResult.value = null
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
  border-color: rgba(16, 185, 129, 0.3);
}

.page-title {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
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
  background: rgba(5, 150, 105, 0.1);
  border: 1px solid rgba(5, 150, 105, 0.3);
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
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
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
  box-shadow: 0 4px 12px rgba(5, 150, 105, 0.4);
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
  border-color: #059669;
  background: rgba(5, 150, 105, 0.05);
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
  background: linear-gradient(135deg, #059669 0%, #10b981 100%);
  color: #ffffff;
  flex: 1;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(5, 150, 105, 0.4);
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

.validation-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.error-list {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
}

.warning-list {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

.list-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #ffffff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.error-icon {
  color: #ef4444;
  font-size: 1.25rem;
}

.warning-icon {
  color: #f59e0b;
  font-size: 1.25rem;
}

.list-content {
  list-style: none;
  padding: 0;
}

.list-content li {
  font-size: 0.9375rem;
  color: #a0a0a0;
  margin-bottom: 0.5rem;
  padding-left: 1.5rem;
  position: relative;
  line-height: 1.6;
}

.list-content li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: #ef4444;
  font-weight: bold;
}

.result-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.detail-label {
  font-size: 0.875rem;
  color: #a0a0a0;
}

.detail-value {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
}

.bounds-section {
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
  padding: 1.5rem;
}

.section-subtitle {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #ffffff;
}

.bounds-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.bound-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.bound-label {
  font-size: 0.875rem;
  color: #a0a0a0;
}

.bound-value {
  font-size: 1rem;
  font-weight: 600;
  color: #ffffff;
}

.stats-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.stat-label {
  font-size: 0.875rem;
  color: #a0a0a0;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #ffffff;
}

.success-value {
  color: #10b981 !important;
}

.error-value {
  color: #ef4444 !important;
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

  .result-details {
    grid-template-columns: 1fr;
  }

  .bounds-grid,
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .list-content {
    padding-left: 1rem;
  }
}
</style>
