<template>
  <div class="tool-container">
    <header class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">SHP 工具箱</h1>
      <span class="page-subtitle">SHP ↔ GeoJSON 转换 · 元信息提取</span>
    </header>

    <main class="tool-main">
      <!-- 标签页 -->
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'shp2geojson' }" @click="activeTab = 'shp2geojson'">
          SHP → GeoJSON
        </button>
        <button class="tab" :class="{ active: activeTab === 'geojson2shp' }" @click="activeTab = 'geojson2shp'">
          GeoJSON → SHP
        </button>
      </div>

      <!-- ════════ Tab 1: SHP → GeoJSON ════════ -->
      <div v-show="activeTab === 'shp2geojson'">
        <!-- 上传面板 -->
        <div class="panel" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">文件上传</span>
            <span class="spacer"></span>
            <span v-if="shpStatus" class="msg" :class="shpStatus.type">{{ shpStatus.text }}</span>
          </div>
          <div class="panel-body">
            <div
              class="upload-zone"
              :class="{ dragging: isDraggingShp, 'has-file': shpBuffer || dbfBuffer }"
              @dragover.prevent="isDraggingShp = true"
              @dragleave.prevent="isDraggingShp = false"
              @drop.prevent="handleShpDrop"
              @click="shpFileInput?.click()"
            >
              <input ref="shpFileInput" type="file" accept=".shp,.dbf,.zip" multiple style="display:none" @change="handleShpSelect" />
              <template v-if="!shpBuffer && !dbfBuffer">
                <div class="upload-icon">📁</div>
                <p>拖放 .shp / .dbf / .zip 文件，或点击选择</p>
                <p style="font-size: 0.75rem; color: #606060">支持单独上传 .shp + .dbf，或包含两者的 .zip</p>
              </template>
              <template v-else>
                <div class="file-status">
                  <span v-if="shpBuffer" class="msg ok">✅ SHP: {{ shpDisplay.name }} ({{ formatFileSize(shpDisplay.size) }})</span>
                  <span v-if="dbfBuffer" class="msg ok">✅ DBF: {{ dbfDisplay.name }} ({{ formatFileSize(dbfDisplay.size) }})</span>
                  <span v-if="prjText" class="msg" style="font-size: 0.75rem">📋 PRJ: 已加载</span>
                </div>
              </template>
            </div>

            <!-- 转换模式 -->
            <div class="form-group" v-if="shpBuffer">
              <label class="form-label">转换模式</label>
              <select v-model="convertMode" class="form-select">
                <option value="frontend">纯前端解析（无需后端，本地解析）</option>
                <option value="backend">后端转换（FastAPI localhost:8001）</option>
              </select>
            </div>

            <!-- 编码 -->
            <div class="form-group" v-if="shpBuffer && dbfBuffer">
              <label class="form-label">DBF 编码</label>
              <select v-model="encoding" class="form-select">
                <option v-for="enc in encodingOptions" :key="enc.value" :value="enc.value">{{ enc.label }}</option>
              </select>
            </div>

            <!-- 操作按钮 -->
            <div class="action-row" v-if="shpBuffer">
              <button class="btn btn-primary" :disabled="uploading" @click="convertShp2GeoJSON">
                {{ uploading ? `转换中... ${progress}%` : (convertMode === 'frontend' ? '解析并转换' : '开始转换') }}
              </button>
              <button class="btn btn-secondary" @click="clearShpFiles">重置</button>
            </div>

            <!-- 进度条 -->
            <div v-if="uploading && convertMode === 'backend'" class="progress-bar">
              <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- 元信息面板 -->
        <div class="panel" v-if="shpMeta" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">📊 元信息</span>
          </div>
          <div class="panel-body">
            <div class="result-grid">
              <div class="result-card">
                <span class="label">几何类型</span>
                <span class="value">{{ shpMeta.shapeTypeName }}</span>
              </div>
              <div class="result-card">
                <span class="label">要素数量</span>
                <span class="value">{{ shpMeta.records.length }}</span>
              </div>
              <div class="result-card" v-if="dbfMeta">
                <span class="label">字段数</span>
                <span class="value">{{ dbfMeta.fields.length }}</span>
              </div>
              <div class="result-card" v-if="dbfMeta">
                <span class="label">DBF 记录数</span>
                <span class="value">{{ dbfMeta.records.length }}</span>
              </div>
            </div>

            <div class="result-card" style="margin-top: 0.5rem">
              <span class="label">BBox (minX, minY, maxX, maxY)</span>
              <span class="value" style="font-size: 0.75rem; font-family: 'Cascadia Code', Consolas, monospace">{{ shpMeta.bbox.map(v => v.toFixed(6)).join(', ') }}</span>
            </div>

            <!-- 字段定义 -->
            <table class="data-table" v-if="dbfMeta && dbfMeta.fields.length" style="margin-top: 0.5rem">
              <thead>
                <tr>
                  <th>字段名</th>
                  <th>类型</th>
                  <th>长度</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(field, i) in dbfMeta.fields" :key="i">
                  <td>{{ field.name }}</td>
                  <td>{{ field.type }} ({{ DBF_TYPES[field.type] || 'Unknown' }})</td>
                  <td>{{ field.length }}</td>
                </tr>
              </tbody>
            </table>

            <!-- 数据预览 -->
            <table class="data-table" v-if="dbfMeta && dbfMeta.records.length" style="margin-top: 0.5rem">
              <thead>
                <tr>
                  <th>#</th>
                  <th v-for="(field, i) in dbfMeta.fields" :key="i">{{ field.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(record, i) in dbfMeta.records.slice(0, 50)" :key="i">
                  <td>{{ i + 1 }}</td>
                  <td v-for="(field, j) in dbfMeta.fields" :key="j">{{ record[field.name] ?? '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 前端解析结果 -->
        <div class="panel" v-if="convertMode === 'frontend' && frontendGeoJSON" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">GeoJSON 输出</span>
            <span class="spacer"></span>
            <button class="btn btn-small btn-secondary" @click="copyGeoJSON">复制</button>
            <button class="btn btn-small btn-secondary" @click="downloadGeoJSON">下载 .geojson</button>
          </div>
          <div class="panel-body">
            <textarea class="form-textarea" :value="frontendGeoJSON" readonly></textarea>
          </div>
        </div>

        <!-- 后端转换结果 -->
        <div class="panel" v-if="convertMode === 'backend' && (backendResult.success || backendResult.error)" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">转换结果</span>
          </div>
          <div class="panel-body">
            <div class="msg ok" v-if="backendResult.success">
              ✅ {{ backendResult.message }}（{{ backendResult.featureCount }} 个要素，{{ formatFileSize(backendResult.fileSize) }}）
            </div>
            <div class="msg err" v-if="backendResult.error">
              ❌ {{ backendResult.error }}
            </div>
            <button class="btn btn-primary" v-if="backendResult.success && backendResult.downloadUrl" @click="downloadBackendFile">
              下载 GeoJSON 文件
            </button>
          </div>
        </div>

        <!-- 说明 -->
        <div class="info-box" v-if="!shpMeta">
          <strong>说明：</strong>纯前端模式使用内置 SHP/DBF 二进制解析器，无需后端服务，数据不离开浏览器。后端模式通过 FastAPI 转换，需启动 localhost:8001。两种模式都支持元信息提取（几何类型/bbox/字段/预览）。
        </div>
      </div>

      <!-- ════════ Tab 2: GeoJSON → SHP ════════ -->
      <div v-show="activeTab === 'geojson2shp'">
        <!-- 上传面板 -->
        <div class="panel" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">文件上传</span>
          </div>
          <div class="panel-body">
            <div
              class="upload-zone"
              :class="{ dragging: isDraggingGeojson, 'has-file': !!geojsonFile }"
              @dragover.prevent="isDraggingGeojson = true"
              @dragleave.prevent="isDraggingGeojson = false"
              @drop.prevent="handleGeojsonDrop"
              @click="geojsonFileInput?.click()"
            >
              <input ref="geojsonFileInput" type="file" accept=".geojson,.json" style="display:none" @change="handleGeojsonSelect" />
              <template v-if="!geojsonFile">
                <div class="upload-icon">📁</div>
                <p>拖放 .geojson / .json 文件，或点击选择</p>
              </template>
              <template v-else>
                <span class="msg ok">✅ {{ geojsonFile.name }} ({{ formatFileSize(geojsonFile.size) }})</span>
                <button class="btn btn-small btn-secondary" style="margin-top: 0.5rem" @click.stop="clearGeojsonFile">清除</button>
              </template>
            </div>

            <!-- 编码 -->
            <div class="form-group" v-if="geojsonFile">
              <label class="form-label">输出 SHP 编码</label>
              <select v-model="geojsonEncoding" class="form-select">
                <option v-for="enc in encodingOptions" :key="enc.value" :value="enc.value">{{ enc.label }}</option>
              </select>
            </div>

            <!-- 操作按钮 -->
            <div class="action-row" v-if="geojsonFile">
              <button class="btn btn-primary" :disabled="geojsonUploading" @click="convertGeojson2Shp">
                {{ geojsonUploading ? `转换中... ${geojsonProgress}%` : '开始转换' }}
              </button>
              <button class="btn btn-secondary" @click="clearGeojsonFile">重置</button>
            </div>

            <!-- 进度条 -->
            <div v-if="geojsonUploading" class="progress-bar">
              <div class="progress-fill" :style="{ width: geojsonProgress + '%' }"></div>
            </div>

            <div class="msg err" v-if="geojsonError">{{ geojsonError }}</div>
          </div>
        </div>

        <!-- 元信息面板 -->
        <div class="panel" v-if="geojsonMeta" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">📊 元信息</span>
          </div>
          <div class="panel-body">
            <div class="result-grid">
              <div class="result-card">
                <span class="label">类型</span>
                <span class="value">{{ geojsonMeta.type }}</span>
              </div>
              <div class="result-card">
                <span class="label">要素数量</span>
                <span class="value">{{ geojsonMeta.featureCount }}</span>
              </div>
              <div class="result-card">
                <span class="label">几何类型</span>
                <span class="value">{{ geojsonMeta.geometryTypes.join(', ') || 'N/A' }}</span>
              </div>
            </div>

            <!-- 预览 -->
            <table class="data-table" v-if="geojsonMeta.preview.length" style="margin-top: 0.5rem">
              <thead>
                <tr>
                  <th>#</th>
                  <th>geometry.type</th>
                  <th>properties</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(feature, i) in geojsonMeta.preview" :key="i">
                  <td>{{ i + 1 }}</td>
                  <td>{{ feature.geometryType }}</td>
                  <td>{{ feature.properties }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- 转换结果 -->
        <div class="panel" v-if="geojsonResult.success || geojsonResult.error" style="margin-bottom: 1rem">
          <div class="panel-head">
            <span class="t">转换结果</span>
          </div>
          <div class="panel-body">
            <div class="msg ok" v-if="geojsonResult.success">✅ {{ geojsonResult.message }}</div>
            <div class="msg err" v-if="geojsonResult.error">❌ {{ geojsonResult.error }}</div>
            <div class="result-grid" v-if="geojsonResult.success" style="margin-top: 0.5rem">
              <div class="result-card">
                <span class="label">几何类型</span>
                <span class="value">{{ geojsonResult.geometryType }}</span>
              </div>
              <div class="result-card">
                <span class="label">要素数量</span>
                <span class="value">{{ geojsonResult.featureCount }}</span>
              </div>
              <div class="result-card">
                <span class="label">文件大小</span>
                <span class="value">{{ formatFileSize(geojsonResult.fileSize) }}</span>
              </div>
            </div>
            <button class="btn btn-primary" v-if="geojsonResult.success && geojsonResult.downloadUrl" @click="downloadGeojsonResult" style="margin-top: 0.5rem">
              下载 SHP 文件
            </button>
            <div class="msg warn" v-if="geojsonResult.useMock">⚠️ Mock 模式：请安装 GDAL 以生成真正的 Shapefile</div>
          </div>
        </div>
      </div>

      <footer class="tool-footer">
        SHP 工具箱 · 纯前端解析 + 后端转换双模式 · 前端模式不上传不联网
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  parseSHP, parseDBF, buildGeoJSON, parseZip, CPG_ENC_MAP, DBF_TYPES,
  type ShpResult, type DbfResult
} from '../utils/shp-parser'

const router = useRouter()

// ── 标签页 ──────────────────────────────────────────────────
const activeTab = ref<'shp2geojson' | 'geojson2shp'>('shp2geojson')

// ── 编码选项 ────────────────────────────────────────────────
const encodingOptions = [
  { value: 'utf-8', label: 'UTF-8 (通用)' },
  { value: 'gbk', label: 'GBK (简体中文)' },
  { value: 'gb2312', label: 'GB2312 (国标)' },
  { value: 'big5', label: 'BIG5 (繁体中文)' },
  { value: 'shift_jis', label: 'Shift-JIS (日文)' },
  { value: 'euc-kr', label: 'EUC-KR (韩文)' },
  { value: 'windows-1252', label: 'Windows-1252 (西欧)' }
]

// ── Tab 1 状态：SHP → GeoJSON ────────────────────────────────
const shpFileInput = ref<HTMLInputElement | null>(null)
const shpBuffer = ref<ArrayBuffer | null>(null)
const dbfBuffer = ref<ArrayBuffer | null>(null)
const shpDisplay = reactive({ name: '', size: 0 })
const dbfDisplay = reactive({ name: '', size: 0 })
const prjText = ref<string | null>(null)
const isDraggingShp = ref(false)
const convertMode = ref<'frontend' | 'backend'>('frontend')
const encoding = ref('utf-8')
const uploading = ref(false)
const progress = ref(0)
const shpError = ref('')

const shpMeta = ref<ShpResult | null>(null)
const dbfMeta = ref<DbfResult | null>(null)
const frontendGeoJSON = ref('')

const backendResult = reactive({
  success: false,
  message: '',
  featureCount: 0,
  fileSize: 0,
  downloadUrl: '',
  error: ''
})

const shpStatus = computed(() => {
  if (shpError.value) return { type: 'err', text: shpError.value }
  if (shpBuffer.value && dbfBuffer.value) return { type: 'ok', text: 'SHP + DBF 已加载' }
  if (shpBuffer.value) return { type: 'ok', text: 'SHP 已加载' }
  return null
})

// ── Tab 2 状态：GeoJSON → SHP ────────────────────────────────
const geojsonFileInput = ref<HTMLInputElement | null>(null)
const geojsonFile = ref<File | null>(null)
const isDraggingGeojson = ref(false)
const geojsonEncoding = ref('utf-8')
const geojsonUploading = ref(false)
const geojsonProgress = ref(0)
const geojsonError = ref('')

const geojsonMeta = ref<{
  type: string
  featureCount: number
  geometryTypes: string[]
  preview: { geometryType: string; properties: string }[]
} | null>(null)

const geojsonResult = reactive({
  success: false,
  message: '',
  featureCount: 0,
  fileSize: 0,
  geometryType: '',
  downloadUrl: '',
  error: '',
  useMock: false
})

// ── 工具函数 ────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`
}

function goBack() {
  router.push('/')
}

// ── Tab 1: SHP 文件处理 ────────────────────────────────────

async function handleShpFiles(files: File[]) {
  shpError.value = ''
  for (const file of files) {
    const lowerName = file.name.toLowerCase()
    if (lowerName.endsWith('.zip')) {
      try {
        const buffer = await file.arrayBuffer()
        const zipData = new Uint8Array(buffer)
        const zipFiles = parseZip(zipData)
        let foundShp = false, foundDbf = false
        for (const [name, data] of Object.entries(zipFiles)) {
          if (name.endsWith('.shp')) {
            shpBuffer.value = data.buffer as ArrayBuffer
            shpDisplay.name = name
            shpDisplay.size = data.length
            foundShp = true
          } else if (name.endsWith('.dbf')) {
            dbfBuffer.value = data.buffer as ArrayBuffer
            dbfDisplay.name = name
            dbfDisplay.size = data.length
            foundDbf = true
          } else if (name.endsWith('.cpg')) {
            const cpg = new TextDecoder('utf-8').decode(data).trim().toLowerCase()
            if (CPG_ENC_MAP[cpg]) encoding.value = CPG_ENC_MAP[cpg]
          } else if (name.endsWith('.prj')) {
            prjText.value = new TextDecoder('utf-8').decode(data).trim()
          }
        }
        if (!foundShp && !foundDbf) {
          shpError.value = 'ZIP 中未找到 .shp 或 .dbf 文件'
        }
      } catch (err) {
        shpError.value = `ZIP 解压失败: ${err instanceof Error ? err.message : String(err)}`
      }
    } else if (lowerName.endsWith('.shp')) {
      shpBuffer.value = await file.arrayBuffer()
      shpDisplay.name = file.name
      shpDisplay.size = file.size
    } else if (lowerName.endsWith('.dbf')) {
      dbfBuffer.value = await file.arrayBuffer()
      dbfDisplay.name = file.name
      dbfDisplay.size = file.size
    } else if (lowerName.endsWith('.prj')) {
      prjText.value = await file.text()
    } else if (lowerName.endsWith('.cpg')) {
      const cpg = (await file.text()).trim().toLowerCase()
      if (CPG_ENC_MAP[cpg]) encoding.value = CPG_ENC_MAP[cpg]
    }
  }

  // 解析元信息
  if (shpBuffer.value) parseShpMetadata()
}

function parseShpMetadata() {
  if (!shpBuffer.value) return
  try {
    shpMeta.value = parseSHP(shpBuffer.value)
  } catch (err) {
    shpError.value = `SHP 解析失败: ${err instanceof Error ? err.message : String(err)}`
    return
  }
  if (dbfBuffer.value) {
    try {
      dbfMeta.value = parseDBF(dbfBuffer.value, encoding.value)
    } catch (err) {
      console.warn('DBF parsing failed:', err)
    }
  }
}

function handleShpSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) handleShpFiles(Array.from(target.files))
  target.value = ''
}

function handleShpDrop(event: DragEvent) {
  isDraggingShp.value = false
  const files = event.dataTransfer?.files
  if (files) handleShpFiles(Array.from(files))
}

function clearShpFiles() {
  shpBuffer.value = null
  dbfBuffer.value = null
  shpDisplay.name = ''
  shpDisplay.size = 0
  dbfDisplay.name = ''
  dbfDisplay.size = 0
  prjText.value = null
  shpMeta.value = null
  dbfMeta.value = null
  frontendGeoJSON.value = ''
  backendResult.success = false
  backendResult.message = ''
  backendResult.error = ''
  backendResult.downloadUrl = ''
  shpError.value = ''
  progress.value = 0
  uploading.value = false
}

async function convertShp2GeoJSON() {
  const buf = shpBuffer.value
  if (!buf) return

  if (convertMode.value === 'frontend') {
  // 纯前端解析
    try {
      const shpResult = shpMeta.value || parseSHP(buf)
      let dbfResult: DbfResult | null = null
      if (dbfBuffer.value) {
        dbfResult = parseDBF(dbfBuffer.value, encoding.value)
      }
      const geojson = buildGeoJSON(shpResult, dbfResult)
      frontendGeoJSON.value = JSON.stringify(geojson, null, 2)
    } catch (err) {
      shpError.value = `解析失败: ${err instanceof Error ? err.message : String(err)}`
    }
  } else {
    // 后端转换
    uploading.value = true
    progress.value = 0
    backendResult.success = false
    backendResult.error = ''

    const fileToSend = new File([buf], shpDisplay.name || 'upload.shp')
    const formData = new FormData()
    formData.append('file', fileToSend)
    formData.append('encoding', encoding.value)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', 'http://localhost:8001/api/shp/to-geojson', true)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        progress.value = Math.round((event.loaded * 100) / event.total)
      }
    }

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText)
          backendResult.success = data.success
          backendResult.message = data.message || ''
          backendResult.featureCount = data.feature_count || 0
          backendResult.fileSize = data.file_size || 0
          backendResult.downloadUrl = data.success ? `http://localhost:8001${data.download_url}` : ''
          backendResult.error = data.error || ''
          if (data.success) progress.value = 100
        } catch {
          backendResult.error = '服务器返回数据格式错误'
        }
      } else {
        backendResult.error = `服务器错误: ${xhr.status}`
      }
      uploading.value = false
    }

    xhr.onerror = () => {
      backendResult.error = '网络错误，请检查后端服务是否启动'
      progress.value = 0
      uploading.value = false
    }

    xhr.send(formData)
  }
}

function copyGeoJSON() {
  if (!frontendGeoJSON.value) return
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(frontendGeoJSON.value).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = frontendGeoJSON.value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
  }
}

function downloadGeoJSON() {
  if (!frontendGeoJSON.value) return
  const blob = new Blob([frontendGeoJSON.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = shpDisplay.name.replace(/\.shp$/i, '') + '.geojson' || 'output.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function downloadBackendFile() {
  if (backendResult.downloadUrl) window.open(backendResult.downloadUrl, '_blank')
}

// ── Tab 2: GeoJSON 文件处理 ────────────────────────────────

async function selectGeojsonFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.geojson') && !file.name.toLowerCase().endsWith('.json')) {
    geojsonError.value = '请上传 .geojson 或 .json 格式的文件'
    return
  }
  geojsonFile.value = file
  geojsonError.value = ''
  geojsonResult.success = false
  geojsonResult.error = ''

  try {
    const text = await file.text()
    parseGeojsonMetadata(text)
  } catch (err) {
    geojsonError.value = `文件读取失败: ${err instanceof Error ? err.message : String(err)}`
  }
}

function parseGeojsonMetadata(text: string) {
  try {
    const geojson = JSON.parse(text)
    const geometryTypes = new Set<string>()
    let features: any[] = []

    if (geojson.type === 'FeatureCollection') {
      features = geojson.features || []
    } else if (geojson.type === 'Feature') {
      features = [geojson]
    } else {
      geojsonError.value = '不支持的 GeoJSON 类型，仅支持 FeatureCollection 或 Feature'
      return
    }

    for (const f of features) {
      if (f.geometry?.type) geometryTypes.add(f.geometry.type)
    }

    geojsonMeta.value = {
      type: geojson.type || 'FeatureCollection',
      featureCount: features.length,
      geometryTypes: Array.from(geometryTypes),
      preview: features.slice(0, 5).map(f => ({
        geometryType: f.geometry?.type || 'null',
        properties: JSON.stringify(f.properties || {})
      }))
    }
  } catch (err) {
    geojsonError.value = `GeoJSON 解析失败: ${err instanceof Error ? err.message : String(err)}`
  }
}

function handleGeojsonSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) selectGeojsonFile(file)
  target.value = ''
}

function handleGeojsonDrop(event: DragEvent) {
  isDraggingGeojson.value = false
  const file = event.dataTransfer?.files[0]
  if (file) selectGeojsonFile(file)
}

function clearGeojsonFile() {
  geojsonFile.value = null
  geojsonMeta.value = null
  geojsonError.value = ''
  geojsonResult.success = false
  geojsonResult.message = ''
  geojsonResult.error = ''
  geojsonResult.downloadUrl = ''
  geojsonProgress.value = 0
  geojsonUploading.value = false
}

function convertGeojson2Shp() {
  if (!geojsonFile.value) return

  geojsonUploading.value = true
  geojsonProgress.value = 0
  geojsonResult.success = false
  geojsonResult.error = ''

  const formData = new FormData()
  formData.append('file', geojsonFile.value)
  formData.append('encoding', geojsonEncoding.value)

  const xhr = new XMLHttpRequest()
  xhr.open('POST', 'http://localhost:8001/api/geojson/to-shp', true)

  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) {
      geojsonProgress.value = Math.round((event.loaded * 100) / event.total)
    }
  }

  xhr.onload = () => {
    if (xhr.status === 200) {
      try {
        const data = JSON.parse(xhr.responseText)
        geojsonResult.success = data.success
        geojsonResult.message = data.message || ''
        geojsonResult.featureCount = data.feature_count || 0
        geojsonResult.fileSize = data.file_size || 0
        geojsonResult.geometryType = data.geometry_type || 'Unknown'
        geojsonResult.downloadUrl = data.download_url ? `http://localhost:8001${data.download_url}` : ''
        geojsonResult.error = data.error || ''
        geojsonResult.useMock = !!(data.message && data.message.includes('Mock'))
        if (data.success) geojsonProgress.value = 100
      } catch {
        geojsonResult.error = '服务器返回数据格式错误'
      }
    } else {
      geojsonResult.error = `服务器错误: ${xhr.status}`
    }
    geojsonUploading.value = false
  }

  xhr.onerror = () => {
    geojsonResult.error = '网络错误，请检查后端服务是否启动'
    geojsonProgress.value = 0
    geojsonUploading.value = false
  }

  xhr.send(formData)
}

function downloadGeojsonResult() {
  if (geojsonResult.downloadUrl) window.open(geojsonResult.downloadUrl, '_blank')
}
</script>

<style scoped>
/* 进度条（tool-common.css 未覆盖） */
.progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.5rem;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}

/* 文件状态显示 */
.file-status {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: center;
}

/* 上传区内文字 */
.upload-zone p {
  margin: 0.25rem 0;
  font-size: 0.875rem;
  color: #ffffff;
}

/* data-table 滚动容器 */
.data-table {
  display: block;
  overflow-x: auto;
  max-height: 360px;
  overflow-y: auto;
}

.data-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.data-table th,
.data-table td {
  white-space: nowrap;
}

/* panel 间距 */
.panel + .panel {
  margin-top: 0;
}

/* info-box 内联 */
.info-box strong {
  color: #667eea;
}
</style>
