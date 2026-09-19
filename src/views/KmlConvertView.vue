<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">KML ↔ GeoJSON 转换器</h1>
      <span class="page-subtitle">自动识别方向 · 纯本地运行</span>
    </div>

    <!-- 主内容 -->
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSampleKml">KML 示例</button>
            <button class="btn btn-secondary btn-small" @click="loadSampleJson">GeoJSON 示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="inputText"
              class="form-textarea"
              placeholder="粘贴 KML 或 GeoJSON，自动识别方向：&#10;&#10;KML 以 < 开头&#10;GeoJSON 以 { 开头"
              @input="updateDirection"
            ></textarea>
            <div class="dir-box">
              <span>识别方向：</span>
              <span class="dir-tag" :class="{ unknown: direction === 'unknown' }">{{ dirLabel }}</span>
            </div>
            <div class="action-row">
              <button class="btn btn-primary" @click="runConvert">转换 →</button>
              <span class="msg" :class="msgClass">{{ inMsg }}</span>
            </div>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输出</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyOutput">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadOutput">下载</button>
          </div>
          <div class="panel-body">
            <div class="stat-bar">
              <span>要素 <b>{{ statFeat }}</b></span>
              <span>顶点 <b>{{ statPts }}</b></span>
              <span style="flex:1"></span>
              <span>体积 <b>{{ statSize }}</b></span>
            </div>
            <textarea v-model="outputText" class="form-textarea" readonly placeholder="转换结果将显示在这里"></textarea>
            <span class="msg" :class="{ ok: outMsgType === 'ok', err: outMsgType === 'err' }">{{ outMsg }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { kmlToGeoJson, geoJsonToKml, normalizeGeoJson, detectDirection, countVertices } from '../utils/kml-convert'
import type { FeatureCollection } from '../utils/kml-convert'

const router = useRouter()
const goBack = () => router.push('/')

const inputText = ref('')
const outputText = ref('')
const direction = ref<'kml2geojson' | 'geojson2kml' | 'unknown'>('unknown')
const inMsg = ref('')
const outMsg = ref('')
const msgClass = ref('')
const outMsgType = ref('')
const statFeat = ref(0)
const statPts = ref(0)
const statSize = ref('0B')

const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Placemark>
      <name>天安门</name>
      <description>北京地标</description>
      <Point><coordinates>116.391428,39.907547,0</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>长城路线</name>
      <LineString><coordinates>116.10,40.40,0 116.20,40.50,0 116.30,40.60,0</coordinates></LineString>
    </Placemark>
    <Placemark>
      <name>故宫区域</name>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>116.390,39.916,0 116.399,39.916,0 116.399,39.923,0 116.390,39.923,0 116.390,39.916,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
    </Placemark>
  </Document>
</kml>`

const SAMPLE_GEOJSON = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '天安门', description: '北京地标' }, geometry: { type: 'Point', coordinates: [116.391428, 39.907547, 0] } },
    { type: 'Feature', properties: { name: '长城路线' }, geometry: { type: 'LineString', coordinates: [[116.1, 40.4, 0], [116.2, 40.5, 0], [116.3, 40.6, 0]] } },
    { type: 'Feature', properties: { name: '故宫区域' }, geometry: { type: 'Polygon', coordinates: [[[116.39, 39.916, 0], [116.399, 39.916, 0], [116.399, 39.923, 0], [116.39, 39.923, 0], [116.39, 39.916, 0]]] } },
  ],
}, null, 2)

const dirLabel = computed(() => {
  if (direction.value === 'kml2geojson') return 'KML → GeoJSON'
  if (direction.value === 'geojson2kml') return 'GeoJSON → KML'
  return inputText.value.trim() ? '未识别' : '待输入'
})

function updateDirection() {
  direction.value = detectDirection(inputText.value)
}

function fmtSize(n: number): string {
  if (n < 1024) return n + 'B'
  return (n / 1024).toFixed(1) + 'KB'
}

function runConvert() {
  const text = inputText.value.trim()
  inMsg.value = ''
  outMsg.value = ''
  msgClass.value = ''
  outMsgType.value = ''

  if (!text) {
    inMsg.value = '请粘贴 KML 或 GeoJSON'
    msgClass.value = 'err'
    return
  }

  const dir = detectDirection(text)
  if (dir === 'unknown') {
    inMsg.value = '无法识别方向（需以 < 或 { 开头）'
    msgClass.value = 'err'
    return
  }

  try {
    let output = ''
    let fc: FeatureCollection
    let dlName: string, dlType: string

    if (dir === 'kml2geojson') {
      fc = kmlToGeoJson(text)
      output = JSON.stringify(fc, null, 2)
      dlName = 'converted.geojson'
      dlType = 'application/geo+json;charset=utf-8'
    } else {
      const obj = JSON.parse(text)
      fc = normalizeGeoJson(obj)
      output = geoJsonToKml(obj)
      dlName = 'converted.kml'
      dlType = 'application/vnd.google-earth.kml+xml;charset=utf-8'
    }

    outputText.value = output
    statFeat.value = fc.features.length
    statPts.value = countVertices(fc)
    statSize.value = fmtSize(output.length)
    downloadName.value = dlName
    downloadType.value = dlType

    const dirLabelStr = dir === 'kml2geojson' ? 'KML → GeoJSON' : 'GeoJSON → KML'
    inMsg.value = dirLabelStr + ' 完成，' + fc.features.length + ' 个要素'
    msgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '转换失败: ' + (e as Error).message
    msgClass.value = 'err'
  }
}

const downloadName = ref('converted.txt')
const downloadType = ref('text/plain;charset=utf-8')

function copyOutput() {
  if (!outputText.value) return
  navigator.clipboard.writeText(outputText.value).then(() => {
    outMsg.value = '已复制'
    outMsgType.value = 'ok'
    setTimeout(() => { outMsg.value = '' }, 900)
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = outputText.value
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); outMsg.value = '已复制'; outMsgType.value = 'ok' } catch { outMsg.value = '复制失败'; outMsgType.value = 'err' }
    document.body.removeChild(ta)
  })
}

function downloadOutput() {
  if (!outputText.value) return
  const blob = new Blob([outputText.value], { type: downloadType.value })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = downloadName.value
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
}

function loadSampleKml() {
  inputText.value = SAMPLE_KML
  updateDirection()
  runConvert()
}

function loadSampleJson() {
  inputText.value = SAMPLE_GEOJSON
  updateDirection()
  runConvert()
}

function clearAll() {
  inputText.value = ''
  outputText.value = ''
  inMsg.value = ''
  outMsg.value = ''
  statFeat.value = 0
  statPts.value = 0
  statSize.value = '0B'
  updateDirection()
}
</script>

<style scoped>
.dir-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(102, 126, 234, 0.08);
  border: 1px solid rgba(102, 126, 234, 0.15);
  border-radius: 8px;
  font-size: 0.8125rem;
  color: #a0a0a0;
}

.dir-tag {
  font-weight: 700;
  color: #667eea;
  font-size: 0.8125rem;
}

.dir-tag.unknown {
  color: #606060;
  font-weight: 400;
}

.stat-bar {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #a0a0a0;
  font-size: 0.8125rem;
  flex-wrap: wrap;
}

.stat-bar b {
  color: #ffffff;
}
</style>
