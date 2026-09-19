<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">GeoHash 编解码器</h1>
      <span class="page-subtitle">经纬度↔GeoHash 双向 · 精度 1-12 · bbox+邻居</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 编码面板 -->
        <section class="panel">
          <div class="panel-head"><span class="t">编码：经纬度 → GeoHash</span></div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin: 0;">纬度</label>
              <input class="form-input" type="number" v-model.number="lat" step="any" style="width: 100px;" />
              <label class="form-label" style="margin: 0;">经度</label>
              <input class="form-input" type="number" v-model.number="lng" step="any" style="width: 100px;" />
            </div>
            <div class="form-group">
              <label class="form-label">精度（1 ~ 12 位）: {{ precision }}</label>
              <input type="range" v-model.number="precision" min="1" max="12" style="width: 100%; accent-color: #667eea;" />
            </div>
            <div class="result-card" v-if="encHash" style="background: rgba(102,126,234,0.08); border-color: rgba(102,126,234,0.15);">
              <span class="label">GeoHash 结果</span>
              <span class="value" style="font-size: 1.5rem; letter-spacing: 3px;">{{ encHash }}</span>
              <span class="sub">{{ encSize }}</span>
            </div>
            <div class="msg" :class="{ err: encErr }">{{ encErr }}</div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="copyHash">复制结果</button>
              <button class="btn btn-secondary btn-small" @click="fillDecode">填入解码 →</button>
              <button class="btn btn-secondary btn-small" @click="loadSample">示例：北京</button>
            </div>
          </div>
        </section>
        <!-- 解码面板 -->
        <section class="panel">
          <div class="panel-head"><span class="t">解码：GeoHash → 坐标 / 邻域</span></div>
          <div class="panel-body">
            <div class="form-group">
              <label class="form-label">GeoHash 字符串</label>
              <input class="form-input" v-model="decodeInput" placeholder="如 wx4g0" style="font-family: Consolas, monospace;" @input="decodeInput = decodeInput.toLowerCase(); decodeNow()" />
            </div>
            <div class="msg err" v-if="decodeErr">{{ decodeErr }}</div>
            <template v-if="decResult">
              <div class="result-card" style="background: rgba(102,126,234,0.08); border-color: rgba(102,126,234,0.15);">
                <span class="label">中心点</span>
                <span class="value">{{ decResult.center.lat.toFixed(6) }}, {{ decResult.center.lng.toFixed(6) }}</span>
                <span class="sub">纬度范围: {{ decResult.bbox.latMin.toFixed(6) }} ~ {{ decResult.bbox.latMax.toFixed(6) }}</span>
                <span class="sub">经度范围: {{ decResult.bbox.lngMin.toFixed(6) }} ~ {{ decResult.bbox.lngMax.toFixed(6) }}</span>
              </div>
              <div class="neighbor-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 12px;">
                <div v-for="cell in neighborCells" :key="cell.key" class="result-card" :style="cell.key === '' ? 'background: linear-gradient(135deg, #667eea, #764ba2); border: none; cursor: default;' : 'cursor: pointer;'" @click="cell.key !== '' && copyNeighbor(cell.code)">
                  <span class="sub" style="display: block;">{{ cell.label }}</span>
                  <span class="value" style="font-size: 0.75rem; font-family: Consolas, monospace; word-break: break-all;" :style="cell.key === '' ? 'color: #fff;' : ''">{{ cell.code }}</span>
                </div>
              </div>
            </template>
            <div class="action-row">
              <button class="btn btn-secondary btn-small" @click="copyCenter">复制中心点</button>
              <button class="btn btn-secondary btn-small" @click="fillEncode">中心点回填编码 ←</button>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">Base32 编码：0123456789bcdefghjkmnpqrstuvwxyz · 纯本地运算</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { geohashEncode, geohashDecode, geohashNeighbors, precisionTable, type GeoHashDecode } from '../utils/geohash'

const router = useRouter()
const goBack = () => router.push('/')

const lat = ref(39.91)
const lng = ref(116.39)
const precision = ref(5)
const encErr = ref('')

const precTable = precisionTable()

const encHash = computed(() => {
  try {
    const hash = geohashEncode(lat.value, lng.value, precision.value)
    encErr.value = ''
    return hash
  } catch (e) {
    encErr.value = (e as Error).message
    return ''
  }
})

const encSize = computed(() => {
  const row = precTable[precision.value - 1]
  if (!row) return '—'
  const dLat = row.latDeg * 111.32
  const dLng = row.lngDeg * 111.32
  const fmt = (d: number) => {
    if (d >= 100) return d.toFixed(0) + ' km'
    if (d >= 1) return d.toFixed(1) + ' km'
    return (d * 1000).toFixed(0) + ' m'
  }
  return fmt(dLat) + ' × ' + fmt(dLng) + ' · ' + precision.value * 5 + ' bit'
})

const decodeInput = ref('wx4g0')
const decodeErr = ref('')
const decResult = ref<GeoHashDecode | null>(null)

const neighborCells = computed(() => {
  if (!decResult.value) return []
  const neighbors = geohashNeighbors(decodeInput.value)
  const order: [string, string][] = [
    ['NW', '北西'], ['N', '北'], ['NE', '北东'],
    ['W', '西'], ['', '当前'], ['E', '东'],
    ['SW', '南西'], ['S', '南'], ['SE', '南东'],
  ]
  return order.map(([key, label]) => ({
    key,
    label,
    code: key === '' ? decodeInput.value : (neighbors as unknown as Record<string, string>)[key]!,
  }))
})

function decodeNow() {
  const val = decodeInput.value.trim()
  if (!val) {
    decResult.value = null
    decodeErr.value = ''
    return
  }
  try {
    decResult.value = geohashDecode(val)
    decodeErr.value = ''
  } catch (e) {
    decResult.value = null
    decodeErr.value = (e as Error).message
  }
}

watch([lat, lng, precision], () => {})
decodeNow()

function copyHash() {
  if (encHash.value) navigator.clipboard?.writeText(encHash.value)
}
function fillDecode() {
  if (encHash.value) {
    decodeInput.value = encHash.value
    decodeNow()
  }
}
function loadSample() {
  lat.value = 39.91
  lng.value = 116.39
}
function copyCenter() {
  if (decResult.value) navigator.clipboard?.writeText(decResult.value.center.lat.toFixed(6) + ', ' + decResult.value.center.lng.toFixed(6))
}
function fillEncode() {
  if (!decResult.value) return
  lat.value = decResult.value.center.lat
  lng.value = decResult.value.center.lng
  precision.value = Math.max(1, Math.min(12, decodeInput.value.trim().length))
}
function copyNeighbor(code: string) {
  navigator.clipboard?.writeText(code)
}
</script>
