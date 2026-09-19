<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">DXF 工具箱</h1>
      <span class="page-subtitle">DXF ↔ GeoJSON 双向转换 · 纯本地</span>
    </div>

    <!-- 标签页 -->
    <div class="tool-main">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'd2g' }" @click="activeTab = 'd2g'">DXF → GeoJSON</button>
        <button class="tab" :class="{ active: activeTab === 'g2d' }" @click="activeTab = 'g2d'">GeoJSON → DXF</button>
      </div>

      <!-- ==================== DXF → GeoJSON ==================== -->
      <div v-show="activeTab === 'd2g'">
        <div class="action-row" style="margin-bottom: 1rem">
          <button class="btn btn-primary btn-small" @click="loadDxfSample">载入示例</button>
          <button class="btn btn-primary" @click="runDxfConvert">转换 →</button>
          <button class="btn btn-secondary btn-small" @click="copyDxfOutput">复制 JSON</button>
          <button class="btn btn-secondary btn-small" @click="downloadDxfOutput">下载 .geojson</button>
          <button class="btn btn-secondary btn-small" @click="clearDxf">清空</button>
          <span style="flex:1"></span>
          <span class="dxf-stat">Feature <b>{{ d2gFeat }}</b></span>
          <span class="dxf-stat">Layer <b>{{ d2gLayer }}</b></span>
        </div>

        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head">
              <span class="t">DXF 输入</span>
              <div class="spacer"></div>
              <span class="dxf-stat"><b>{{ dxfInput.length }}</b> bytes</span>
            </div>
            <div class="panel-body">
              <textarea
                v-model="dxfInput"
                class="form-textarea"
                placeholder="粘贴 DXF 文本内容（ASCII 格式）...&#10;&#10;支持实体: POINT / LINE / LWPOLYLINE / POLYLINE(VERTEX) / CIRCLE"
              ></textarea>
              <div class="dxf-status">
                <span class="dxf-dot" :class="d2gStatus"></span>
                <span>{{ d2gInfo }}</span>
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <span class="t">GeoJSON 输出</span>
              <div class="spacer"></div>
              <span class="dxf-stat"><b>{{ dxfOutput.length }}</b> bytes</span>
            </div>
            <div class="panel-body">
              <textarea v-model="dxfOutput" class="form-textarea" readonly placeholder="转换结果将显示于此..."></textarea>
              <div class="dxf-status">
                <span class="dxf-dot" :class="d2gOutStatus"></span>
                <span>{{ d2gOutInfo }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ==================== GeoJSON → DXF ==================== -->
      <div v-show="activeTab === 'g2d'">
        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head">
              <span class="t">输入 GeoJSON</span>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="loadG2dSample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearG2d">清空</button>
            </div>
            <div class="panel-body">
              <textarea
                v-model="g2dInput"
                class="form-textarea"
                placeholder="粘贴 GeoJSON FeatureCollection...  (Ctrl+Enter 转换)"
                @keydown.ctrl.enter.prevent="runG2dConvert"
                @keydown.meta.enter.prevent="runG2dConvert"
              ></textarea>
              <div class="action-row">
                <button class="btn btn-primary" @click="runG2dConvert">转换为 DXF →</button>
              </div>
              <span class="msg" :class="g2dMsgClass">{{ g2dMsgIn }}</span>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <span class="t">DXF 输出</span>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="copyG2dOutput">复制</button>
              <button class="btn btn-secondary btn-small" @click="downloadG2dOutput">下载 .dxf</button>
            </div>
            <div class="panel-body">
              <textarea v-model="g2dOutput" class="form-textarea" readonly placeholder="AutoCAD DXF 文本将在此显示..."></textarea>
              <div v-if="g2dStats" class="g2d-stats">{{ g2dStats }}</div>
              <span class="msg" :class="{ ok: g2dMsgOutType === 'ok' }">{{ g2dMsgOut }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseDXF, geojsonToDxf } from '../utils/dxf-convert'

const router = useRouter()
const goBack = () => router.push('/')

const activeTab = ref<'d2g' | 'g2d'>('d2g')

/* ---- DXF → GeoJSON 状态 ---- */
const dxfInput = ref('')
const dxfOutput = ref('')
const d2gFeat = ref(0)
const d2gLayer = ref(0)
const d2gStatus = ref('')
const d2gInfo = ref('等待输入')
const d2gOutStatus = ref('')
const d2gOutInfo = ref('未转换')

const SAMPLE_DXF = [
  '0', 'SECTION', '2', 'ENTITIES',
  '0', 'POINT', '8', 'SURVEY_PTS', '10', '120.500', '20', '45.300',
  '0', 'POINT', '8', 'SURVEY_PTS', '10', '200.000', '20', '80.000',
  '0', 'LINE', '8', 'ROAD_CENTER', '10', '100.000', '20', '50.000', '11', '300.000', '21', '150.000',
  '0', 'LINE', '8', 'ROAD_CENTER', '10', '300.000', '20', '150.000', '11', '500.000', '21', '100.000',
  '0', 'LWPOLYLINE', '8', 'BUILDING', '90', '4', '70', '1',
  '10', '150.000', '20', '200.000', '10', '350.000', '20', '200.000',
  '10', '350.000', '20', '350.000', '10', '150.000', '20', '350.000',
  '0', 'CIRCLE', '8', 'TREE_AREA', '10', '400.000', '20', '250.000', '40', '60.000',
  '0', 'ENDSEC', '0', 'EOF',
].join('\r\n')

function runDxfConvert() {
  const text = dxfInput.value.trim()
  if (!text) {
    d2gStatus.value = 'err'
    d2gInfo.value = '请先粘贴 DXF 文本'
    return
  }

  d2gStatus.value = ''
  d2gInfo.value = '解析中...'

  try {
    const result = parseDXF(text)
    const fc = { type: 'FeatureCollection', features: result.features }
    const json = JSON.stringify(fc, null, 2)

    dxfOutput.value = json
    d2gFeat.value = result.features.length
    d2gLayer.value = result.layers.size

    if (result.features.length > 0) {
      d2gStatus.value = 'ok'
      d2gOutStatus.value = 'ok'
      d2gInfo.value = '解析成功 · ' + result.features.length + ' 个实体'
      d2gOutInfo.value = 'GeoJSON 已生成 · ' + result.layers.size + ' 个图层'
    } else {
      d2gStatus.value = 'err'
      d2gOutStatus.value = 'err'
      d2gInfo.value = '未提取到实体'
      d2gOutInfo.value = '无输出'
    }

    if (result.errors.length > 0) {
      d2gOutInfo.value += ' (' + result.errors.length + ' 个警告)'
    }
  } catch (e) {
    d2gStatus.value = 'err'
    d2gOutStatus.value = 'err'
    d2gInfo.value = '解析失败'
    d2gOutInfo.value = '错误'
    console.error(e)
  }
}

function loadDxfSample() {
  dxfInput.value = SAMPLE_DXF
  runDxfConvert()
}

function clearDxf() {
  dxfInput.value = ''
  dxfOutput.value = ''
  d2gFeat.value = 0
  d2gLayer.value = 0
  d2gStatus.value = ''
  d2gOutStatus.value = ''
  d2gInfo.value = '等待输入'
  d2gOutInfo.value = '未转换'
}

function copyDxfOutput() {
  if (!dxfOutput.value) return
  navigator.clipboard.writeText(dxfOutput.value).then(() => {
    d2gOutInfo.value = '已复制到剪贴板'
  })
}

function downloadDxfOutput() {
  if (!dxfOutput.value) return
  const blob = new Blob([dxfOutput.value], { type: 'application/geo+json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dxf-output.geojson'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
}

/* ---- GeoJSON → DXF 状态 ---- */
const g2dInput = ref('')
const g2dOutput = ref('')
const g2dMsgIn = ref('')
const g2dMsgOut = ref('')
const g2dMsgClass = ref('')
const g2dMsgOutType = ref('')
const g2dStats = ref('')

const G2D_SAMPLE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '控制点A', layer: 'SURVEY' }, geometry: { type: 'Point', coordinates: [116.397, 39.909] } },
    { type: 'Feature', properties: { name: '道路1', layer: 'ROAD' }, geometry: { type: 'LineString', coordinates: [[116.38, 39.91], [116.40, 39.91], [116.42, 39.92]] } },
    { type: 'Feature', properties: { name: '地块B', layer: 'PARCEL' }, geometry: { type: 'Polygon', coordinates: [[[116.39, 39.92], [116.40, 39.92], [116.40, 39.91], [116.39, 39.91], [116.39, 39.92]]] } },
  ],
}, null, 2)

function runG2dConvert() {
  const text = g2dInput.value.trim()
  g2dMsgIn.value = ''
  g2dMsgOut.value = ''
  g2dMsgClass.value = ''
  g2dMsgOutType.value = ''

  if (!text) {
    g2dMsgIn.value = '请粘贴 GeoJSON'
    g2dMsgClass.value = 'err'
    return
  }

  let geojson: any
  try {
    geojson = JSON.parse(text)
  } catch (e) {
    g2dMsgIn.value = 'JSON 解析失败: ' + (e as Error).message
    g2dMsgClass.value = 'err'
    return
  }

  try {
    const result = geojsonToDxf(geojson)
    g2dOutput.value = result.dxf
    g2dStats.value = `实体数: ${result.entityCount} · 图层数: ${result.layerCount} · DXF 大小: ${(result.dxf.length / 1024).toFixed(1)} KB`
    g2dMsgIn.value = '转换成功 ✓'
    g2dMsgClass.value = 'ok'
  } catch (e) {
    g2dMsgIn.value = '转换失败: ' + (e as Error).message
    g2dMsgClass.value = 'err'
  }
}

function loadG2dSample() {
  g2dInput.value = G2D_SAMPLE
  g2dMsgIn.value = '已载入示例 GeoJSON'
  g2dMsgClass.value = 'ok'
}

function clearG2d() {
  g2dInput.value = ''
  g2dOutput.value = ''
  g2dStats.value = ''
  g2dMsgIn.value = ''
  g2dMsgOut.value = ''
}

function copyG2dOutput() {
  if (!g2dOutput.value) return
  navigator.clipboard.writeText(g2dOutput.value).then(() => {
    g2dMsgOut.value = '已复制到剪贴板'
    g2dMsgOutType.value = 'ok'
    setTimeout(() => { g2dMsgOut.value = '' }, 900)
  })
}

function downloadG2dOutput() {
  if (!g2dOutput.value) return
  const blob = new Blob([g2dOutput.value], { type: 'application/dxf' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'export.dxf'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
  g2dMsgOut.value = '已下载 export.dxf'
  g2dMsgOutType.value = 'ok'
}
</script>

<style scoped>
.dxf-stat {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: #a0a0a0;
  font-size: 0.8125rem;
}

.dxf-stat b {
  color: #667eea;
  font-family: Consolas, monospace;
  font-size: 0.875rem;
}

.dxf-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-top: 0.25rem;
  font-size: 0.8125rem;
  color: #a0a0a0;
}

.dxf-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #606060;
}

.dxf-dot.ok {
  background: #10b981;
}

.dxf-dot.err {
  background: #ef4444;
}

.g2d-stats {
  background: rgba(102, 126, 234, 0.08);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: #a0a0a0;
}
</style>
