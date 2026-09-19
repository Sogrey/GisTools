<template>
  <div class="tool-container" style="padding:0">
    <div class="tool-header" style="padding:1rem 2rem;margin-bottom:0">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">地图坐标拾取器</h1>
      <span class="page-subtitle">在线地图 · Leaflet + OSM · WGS84/GCJ02/BD09/墨卡托</span>
    </div>
    <div style="display:flex;height:calc(100vh - 80px)">
      <div ref="mapContainer" style="width:60%;height:100%;min-height:500px"></div>
      <div style="width:40%;overflow-y:auto;padding:1rem 1.25rem">
        <div style="margin-bottom:1rem">
          <div style="font-size:0.75rem;font-weight:600;color:#a0a0a0;letter-spacing:0.5px;margin-bottom:0.5rem">搜索定位</div>
          <div class="action-row">
            <input class="form-input" v-model="searchVal" placeholder="输入地名或经纬度 如 116.39,39.9" @keydown.enter="doSearch" />
            <button class="btn btn-primary btn-small" @click="doSearch">定位</button>
          </div>
          <div class="form-hint">经纬度格式：经度,纬度</div>
        </div>
        <div style="margin-bottom:1rem">
          <div style="font-size:0.75rem;font-weight:600;color:#a0a0a0;letter-spacing:0.5px;margin-bottom:0.5rem">当前坐标</div>
          <div v-if="!currentCoord" class="form-hint" style="text-align:center;padding:1.5rem 0">点击地图拾取坐标</div>
          <div v-for="card in coordCards" :key="card.label" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:0.5rem 0.75rem;margin-bottom:0.375rem">
            <div style="font-size:0.6875rem;font-weight:700;color:#667eea;margin-bottom:0.25rem">{{ card.label }} <span style="font-weight:400;color:#606060">{{ card.tag }}</span></div>
            <div v-for="row in card.rows" :key="row.label" class="action-row" style="margin-bottom:0.125rem">
              <div style="flex:1;min-width:0">
                <div style="font-size:0.625rem;color:#606060">{{ row.label }}</div>
                <div style="font-family:Consolas,monospace;font-size:0.75rem;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ row.val }}</div>
              </div>
              <button class="btn btn-secondary btn-small" style="padding:2px 6px;font-size:0.625rem" @click="copyText(row.val)">复制</button>
            </div>
          </div>
        </div>
        <div>
          <div class="action-row" style="margin-bottom:0.5rem">
            <div style="font-size:0.75rem;font-weight:600;color:#a0a0a0;letter-spacing:0.5px">拾取历史 ({{ history.length }})</div>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" v-if="history.length" @click="clearHistory">清空</button>
          </div>
          <div v-if="!history.length" class="form-hint" style="text-align:center;padding:0.5rem 0">暂无历史记录</div>
          <div v-for="(item, i) in history" :key="i" class="action-row" style="margin-bottom:0.25rem;cursor:pointer;padding:4px 8px;border:1px solid rgba(255,255,255,0.08);border-radius:6px" @click="gotoHistory(item)">
            <span class="tag" style="min-width:22px;text-align:center">{{ i + 1 }}</span>
            <span style="flex:1;font-family:Consolas,monospace;font-size:0.75rem;color:#a0a0a0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ item.lat.toFixed(6) }}, {{ item.lng.toFixed(6) }}</span>
            <button class="btn btn-secondary btn-small" style="padding:0 4px;font-size:0.625rem" @click.stop="delHistory(i)">×</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'

const router = useRouter()
const goBack = () => router.push('/')

const mapContainer = ref<HTMLElement | null>(null)
const searchVal = ref('')
const currentCoord = ref<{ lat: number; lng: number } | null>(null)
const history = ref<{ lat: number; lng: number; time: number }[]>([])
const coordCards = ref<{ label: string; tag: string; rows: { label: string; val: string }[] }[]>([])

let map: any = null
let currentMarker: any = null
const HISTORY_KEY = 'map-picker-history'
const MAX_HISTORY = 20

// Coordinate conversion
const PI = Math.PI
const a = 6378245.0
const ee = 0.00669342162296594323

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0
  return ret
}

function transformLon(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0
  return ret
}

function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLng = transformLon(lng - 105.0, lat - 35.0)
  const radLat = lat / 180.0 * PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI)
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI)
  return [lng + dLng, lat + dLat]
}

const xPI = PI * 3000.0 / 180.0
function gcj02ToBd09(lng: number, lat: number): [number, number] {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * xPI)
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * xPI)
  return [z * Math.cos(theta) + 0.0065, z * Math.sin(theta) + 0.006]
}

function wgs84ToMercator(lng: number, lat: number): [number, number] {
  const x = lng * 20037508.34 / 180.0
  let y = Math.log(Math.tan((90 + lat) * PI / 360.0)) / (PI / 180.0)
  y = y * 20037508.34 / 180.0
  return [x, y]
}

function decimalToDMS(deg: number, isLat: boolean): string {
  const absDeg = Math.abs(deg)
  const d = Math.floor(absDeg)
  const minFloat = (absDeg - d) * 60
  const m = Math.floor(minFloat)
  const s = (minFloat - m) * 60
  const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W')
  return `${d}°${String(m).padStart(2, '0')}'${s.toFixed(3).padStart(6, '0')}"${dir}`
}

function displayCoordinates(lat: number, lng: number) {
  currentCoord.value = { lat, lng }
  const [gcjLng, gcjLat] = wgs84ToGcj02(lng, lat)
  const [bdLng, bdLat] = gcj02ToBd09(gcjLng, gcjLat)
  const [mercX, mercY] = wgs84ToMercator(lng, lat)
  const dms = `${decimalToDMS(lng, false)}, ${decimalToDMS(lat, true)}`
  coordCards.value = [
    { label: 'WGS84', tag: '原始坐标', rows: [
      { label: '小数度', val: `${lat.toFixed(6)}, ${lng.toFixed(6)}` },
      { label: '度分秒', val: dms }
    ]},
    { label: 'GCJ02', tag: '国测局', rows: [
      { label: '小数度', val: `${gcjLat.toFixed(6)}, ${gcjLng.toFixed(6)}` }
    ]},
    { label: 'BD09', tag: '百度坐标', rows: [
      { label: '小数度', val: `${bdLat.toFixed(6)}, ${bdLng.toFixed(6)}` }
    ]},
    { label: 'Web墨卡托', tag: 'EPSG:3857', rows: [
      { label: '米', val: `${mercX.toFixed(2)}, ${mercY.toFixed(2)}` }
    ]}
  ]
}

function placeMarker(lat: number, lng: number) {
  if (!map) return
  if (currentMarker) map.removeLayer(currentMarker)
  const html = `<div style="position:relative;width:30px;height:30px;">
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#667eea;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3);z-index:2;"></div>
  </div>`
  const icon = (window as any).L.divIcon({ html, className: 'click-marker-icon', iconSize: [30, 30], iconAnchor: [15, 15] })
  currentMarker = (window as any).L.marker([lat, lng], { icon }).addTo(map)
}

function pickCoordinate(lat: number, lng: number) {
  placeMarker(lat, lng)
  displayCoordinates(lat, lng)
  history.value.unshift({ lat, lng, time: Date.now() })
  if (history.value.length > MAX_HISTORY) history.value = history.value.slice(0, MAX_HISTORY)
  saveHistory()
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) history.value = JSON.parse(raw)
  } catch { history.value = [] }
}

function saveHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value)) } catch {}
}

function gotoHistory(item: { lat: number; lng: number }) {
  if (!map) return
  map.setView([item.lat, item.lng], Math.max(map.getZoom(), 15))
  placeMarker(item.lat, item.lng)
  displayCoordinates(item.lat, item.lng)
}

function delHistory(i: number) {
  history.value.splice(i, 1)
  saveHistory()
}

function clearHistory() {
  history.value = []
  saveHistory()
}

function doSearch() {
  const val = searchVal.value.trim()
  if (!val || !map) return
  const m = val.match(/^(-?\d{1,3}(\.\d+)?)\s*,\s*(-?\d{1,2}(\.\d+)?)$/)
  if (m) {
    const lng = parseFloat(m[1]!), lat = parseFloat(m[3]!)
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return
    map.setView([lat, lng], 16)
    pickCoordinate(lat, lng)
    return
  }
  const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=1`
  fetch(geocodeUrl).then(r => r.json()).then((data: any[]) => {
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon)
      map.setView([lat, lng], 14)
      pickCoordinate(lat, lng)
    }
  }).catch(() => {})
}

function copyText(t: string) { navigator.clipboard?.writeText(t) }

function loadLeafletScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) { resolve(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Leaflet CDN 加载失败'))
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  loadHistory()
  await nextTick()
  try {
    await loadLeafletScript()
    if (!mapContainer.value) return
    const L = (window as any).L
    map = L.map(mapContainer.value, { zoomControl: true, attributionControl: true }).setView([39.9087, 116.3974], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap contributors'
    }).addTo(map)
    map.on('click', (e: any) => pickCoordinate(e.latlng.lat, e.latlng.lng))
  } catch (e) {
    console.error(e)
  }
})

onUnmounted(() => {
  if (map) { map.remove(); map = null }
})
</script>

<style scoped>
.click-marker-icon { position: relative; }
</style>
