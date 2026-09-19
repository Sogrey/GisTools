<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">空间分析工具箱</h1>
      <span class="page-subtitle">点在多边形 · 面积周长 · 几何中心 · 抽稀 · 矩形边界</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head">
            <span class="t">分析对象</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin: 0;">输入格式</label>
              <select class="form-select" v-model="fmt" style="width: auto;">
                <option value="geojson">GeoJSON</option>
                <option value="wkt">WKT</option>
                <option value="xy">XY 坐标行</option>
              </select>
              <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                <input type="checkbox" v-model="isLatLng" style="accent-color: #667eea;" />XY 按 纬度,经度
              </label>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder='粘贴 GeoJSON / WKT / 坐标行'></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">分析</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">分析结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok', err: outMsgType === 'err' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="result">
              <div class="result-card"><span class="label">面积</span><span class="value">{{ result.area.toFixed(3) }} km²</span><span class="sub">{{ (result.area * 100).toFixed(2) }} 万亩</span></div>
              <div class="result-card"><span class="label">周长</span><span class="value">{{ result.perim.toFixed(3) }} km</span></div>
              <div class="result-card"><span class="label">几何中心</span><span class="value">{{ result.centroid[0].toFixed(6) }}, {{ result.centroid[1].toFixed(6) }}</span></div>
              <div class="result-card"><span class="label">边界范围</span><span class="value">{{ result.bbox.west.toFixed(4) }}, {{ result.bbox.south.toFixed(4) }}</span><span class="sub">→ {{ result.bbox.east.toFixed(4) }}, {{ result.bbox.north.toFixed(4) }}</span></div>
              <div class="result-card"><span class="label">抽稀(0.001°)</span><span class="value">{{ result.vertexCount }} → {{ result.simpCount }} 点</span></div>
            </div>
            <div class="action-row" style="margin-top: 4px;">
              <label class="form-label" style="margin: 0;">点在多边形测试（经度,纬度）</label>
              <input class="form-input" v-model="ptX" style="width: 100px;" />
              <input class="form-input" v-model="ptY" style="width: 100px;" />
              <button class="btn btn-secondary btn-small" @click="ptCheck">判定</button>
              <span class="msg" :class="{ ok: ptMsgType === 'ok', err: ptMsgType === 'err' }">{{ ptMsg }}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">面积/周长使用球面大圆近似（km²/km）；几何中心为平均坐标；抽稀用 Douglas-Peucker</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseCoords, firstRing, polygonAreaKm2, polygonPerimeter, centroid, bbox, dpSimplify, pointInPolygon, type Pt, type AnalysisResult, type BBox } from '../utils/spatial-analysis'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const fmt = ref('geojson')
const isLatLng = ref(true)
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const result = ref<(AnalysisResult & { centroid: Pt; bbox: BBox }) | null>(null)
const ptX = ref('116.4')
const ptY = ref('39.9')
const ptMsg = ref('')
const ptMsgType = ref('')

function run() {
  const text = input.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  result.value = null
  if (!text) {
    inMsg.value = '请输入坐标数据'
    inMsgType.value = 'err'
    return
  }
  try {
    const pts = parseCoords(text, fmt.value, isLatLng.value)
    if (pts.length < 3) {
      inMsg.value = '解析到 ' + pts.length + ' 个点，至少需要 3 个'
      inMsgType.value = 'err'
      return
    }
    let ring = pts
    try {
      const gj = JSON.parse(text)
      if (gj && gj.coordinates) ring = firstRing(gj.coordinates)
    } catch {}
    const area = polygonAreaKm2(ring)
    const perim = polygonPerimeter(ring)
    const c = centroid(ring)
    const b = bbox(ring)
    const simp = dpSimplify(ring, 0.001)
    const n = ring.length
    inMsg.value = '解析到 ' + n + ' 个顶点'
    inMsgType.value = 'ok'
    result.value = { area, perim, centroid: c, bbox: b, simpCount: simp.length, vertexCount: n }
  } catch (e) {
    inMsg.value = '解析失败: ' + (e as Error).message
    inMsgType.value = 'err'
  }
}

function ptCheck() {
  const lng = parseFloat(ptX.value)
  const lat = parseFloat(ptY.value)
  if (isNaN(lng) || isNaN(lat)) {
    ptMsg.value = '格式: 经度,纬度'
    ptMsgType.value = ''
    return
  }
  try {
    const pts = parseCoords(input.value, fmt.value, isLatLng.value)
    let ring = pts
    try {
      const gj = JSON.parse(input.value)
      if (gj && gj.coordinates) ring = firstRing(gj.coordinates)
    } catch {}
    const inside = pointInPolygon(lng, lat, ring)
    ptMsg.value = inside ? '● 在多边形内部' : '○ 在多边形外部'
    ptMsgType.value = inside ? 'ok' : ''
  } catch (e) {
    ptMsg.value = '解析失败: ' + (e as Error).message
    ptMsgType.value = 'err'
  }
}

function loadSample() {
  input.value = JSON.stringify({
    type: 'Polygon',
    coordinates: [[[116.30, 39.80], [116.50, 39.80], [116.50, 40.00], [116.30, 40.00], [116.30, 39.80]]],
  }, null, 1)
  fmt.value = 'geojson'
  run()
}

function clearAll() {
  input.value = ''
  result.value = null
  inMsg.value = ''
  outMsg.value = ''
  ptMsg.value = ''
  inMsgType.value = ''
  outMsgType.value = ''
  ptMsgType.value = ''
}
</script>
