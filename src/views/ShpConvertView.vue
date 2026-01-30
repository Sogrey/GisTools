<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 状态管理
const uploading = ref(false)
const converting = ref(false)
const result = reactive({
  success: false,
  message: '',
  featureCount: 0,
  fileSize: 0,
  downloadUrl: '',
  error: ''
})

// 文件上传
const fileInput = ref<HTMLInputElement>()
const selectedFile = ref<File | null>(null)
const fileInfo = reactive({
  name: '',
  size: 0,
  type: ''
})

// 编码选项
const encoding = ref('UTF-8')
const encodingOptions = ['UTF-8', 'GBK', 'GB2312', 'BIG5']

// 拖拽上传
const isDragging = ref(false)

// 进度
const progress = ref(0)

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
  if (!file.name.toLowerCase().endsWith('.shp')) {
    alert('请上传 .shp 格式的文件')
    return
  }

  selectedFile.value = file
  fileInfo.name = file.name
  fileInfo.size = file.size
  fileInfo.type = file.type || 'application/octet-stream'

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
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('encoding', encoding.value)

    // 上传到Python后端
    const response = await fetch('http://localhost:8000/api/shp/to-geojson', {
      method: 'POST',
      body: formData,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          progress.value = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        }
      }
    })

    if (!response.ok) {
      throw new Error('转换失败')
    }

    const data = await response.json()

    result.success = data.success
    result.message = data.message
    result.featureCount = data.feature_count || 0
    result.fileSize = data.file_size || 0
    result.downloadUrl = data.success ? `http://localhost:8000${data.download_url}` : ''
    result.error = data.error || ''

    if (data.success) {
      progress.value = 100
    } else {
      throw new Error(data.error || '转换失败')
    }

  } catch (error) {
    console.error('上传失败:', error)
    result.success = false
    result.error = error instanceof Error ? error.message : '上传失败，请重试'
    progress.value = 0
  } finally {
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
</script>

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
      <h1 class="page-title">Shapefile 转换为 GeoJSON</h1>
    </header>

    <!-- 主内容 -->
    <main class="main-content">
      <!-- 上传区域 -->
      <div class="upload-section">
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
            accept=".shp"
            @change="handleFileSelect"
            style="display: none"
          />

          <div v-if="!selectedFile" class="upload-prompt">
            <div class="upload-icon">📁</div>
            <div class="upload-text">
              <p>拖拽文件到此处或点击上传</p>
              <p class="upload-hint">仅支持 .shp 格式文件</p>
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
                <path d="M4.16699 4.16666L15.8337 15.8333M4.16699 15.8333L15.8337 4.16666" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
            <option v-for="enc in encodingOptions" :key="enc" :value="enc">
              {{ enc }}
            </option>
          </select>
          <p class="form-hint">选择正确的编码以确保中文等字符正确显示</p>
        </div>

        <!-- 提示信息 -->
        <div class="info-box">
          <div class="info-icon">ℹ️</div>
          <div class="info-content">
            <p><strong>注意：</strong>确保同目录下有 .shx、.dbf、.prj 等关联文件以获得完整转换结果。</p>
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
                <div class="stat-label">要素数量</div>
                <div class="stat-value">{{ result.featureCount }}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">文件大小</div>
                <div class="stat-value">{{ formatFileSize(result.fileSize) }}</div>
              </div>
            </div>
            <button class="btn btn-download" @click="downloadFile">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 13.3333V3.33333M10 13.3333L6.66667 10M10 13.3333L13.3333 10M3.33333 16.6667H16.6667" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              下载 GeoJSON 文件
            </button>
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
    </main>
  </div>
</template>

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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.05);
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
  border-color: rgba(102, 126, 234, 0.5);
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
  background: rgba(102, 126, 234, 0.1);
  border: 1px solid rgba(102, 126, 234, 0.2);
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  flex: 1;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
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
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1rem;
}

.btn-download:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
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
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
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
