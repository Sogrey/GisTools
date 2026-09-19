<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">GeoJSON → SVG</h1>
      <span class="page-subtitle">GeoJSON 渲染为 SVG · 可调画布/线宽/填充 · 下载 .svg</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 左侧：输入+控制 -->
        <div class="panel">
          <div class="panel-head"><span class="t">输入 GeoJSON</span></div>
          <div class="panel-body">
            <textarea class="form-textarea" v-model="geojsonText" spellcheck="false"
              placeholder='{"type":"FeatureCollection","features":[...]}'></textarea>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="loadExample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearInput">清空</button>
            </div>
            <div class="panel-head" style="padding-left:0;border-bottom:none;margin-top:0.5rem"><span class="t">样式控制</span></div>
            <div class="form-group">
              <label class="form-label">线颜色</label>
              <div class="action-row">
                <input type="color" v-model="lineColor" class="color-input" />
                <span class="hex-val">{{ lineColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">填充颜色</label>
              <div class="action-row">
                <input type="color" v-model="fillColor" class="color-input" />
                <span class="hex-val">{{ fillColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">点颜色</label>
              <div class="action-row">
                <input type="color" v-model="pointColor" class="color-input" />
                <span class="hex-val">{{ pointColor }}</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">线宽</label>
              <input class="form-input" type="number" v-model.number="lineWidth" min="0.5" max="8" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">点半径</label>
              <input class="form-input" type="number" v-model.number="pointR" min="1" max="20" step="0.5" />
            </div>
            <div class="form-group">
              <label class="form-label">填充不透明 {{ Math.round(fillOpacity * 100) }}%</label>
              <input type="range" v-model.number="fillOpacity" min="0" max="1" step="0.05" class="range-input" />
            </div>
            <div class="form-group">
              <label class="form-label">画布尺寸</label>
              <select class="form-select" v-model="canvasSize">
                <option value="800x600">800 × 600</option>
                <option value="1024x768">1024 × 768</option>
                <option value="960x960">960 × 960</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">背景</label>
              <div class="tabs" style="padding-bottom:0">
                <button class="tab" :class="{ active: bgMode === 'light' }" @click="bgMode = 'light'">浅色</button>
                <button class="tab" :class="{ active: bgMode === 'dark' }" @click="bgMode = 'dark'">深色</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 右侧：预览 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">SVG 实时预览</span>
            <span class="spacer"></span>
            <button class="btn btn-primary btn-small" @click="downloadSvg">下载 .svg</button>
            <button class="btn btn-secondary btn-small" @click="copySvg">复制源码</button>
          </div>
          <div class="panel-body">
            <div class="svg-stage" v-html="renderResult.svg"></div>
            <div class="msg" :class="statusClass">{{ statusText }}</div>
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
import { generateSVG, fmt } from '../utils/geojson-to-svg'
import type { SvgRenderResult } from '../utils/geojson-to-svg'

const router = useRouter()
const goBack = () => router.push('/')

const geojsonText = ref('')
const lineColor = ref('#2f7beb')
const fillColor = ref('#2f7beb')
const pointColor = ref('#ff6b35')
const lineWidth = ref(1.5)
const pointR = ref(4)
const fillOpacity = ref(0.55)
const canvasSize = ref('800x600')
const bgMode = ref<'light' | 'dark'>('light')

const statusText = ref('就绪…点击「载入示例」或直接粘贴 GeoJSON')
const statusClass = ref('')

const EXAMPLE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '湖心公园', kind: '公园' }, geometry: { type: 'Polygon', coordinates: [[[116.396, 39.902], [116.416, 39.902], [116.412, 39.916], [116.398, 39.918], [116.396, 39.902]]] } },
    { type: 'Feature', properties: { name: '环湖步道', kind: '路线' }, geometry: { type: 'LineString', coordinates: [[116.393, 39.904], [116.4, 39.908], [116.407, 39.912], [116.415, 39.914]] } },
    { type: 'Feature', properties: { name: '观光塔', kind: 'POI' }, geometry: { type: 'Point', coordinates: [116.406, 39.9105] } },
    { type: 'Feature', properties: { name: '出入口站点', kind: 'POI' }, geometry: { type: 'MultiPoint', coordinates: [[116.397, 39.899], [116.413, 39.903]] } },
    { type: 'Feature', properties: { name: '湖中小岛群', kind: '水' }, geometry: { type: 'MultiPolygon', coordinates: [[[[116.397, 39.906], [116.402, 39.906], [116.402, 39.9085], [116.3995, 39.9085], [116.3995, 39.906]]], [[[116.4045, 39.905], [116.4065, 39.905], [116.4065, 39.907], [116.4045, 39.907], [116.4045, 39.905]]]] } },
    { type: 'Feature', properties: { name: '连接线路', kind: '路线' }, geometry: { type: 'MultiLineString', coordinates: [[[116.397, 39.899], [116.4, 39.902], [116.406, 39.9105]], [[116.413, 39.903], [116.408, 39.91], [116.406, 39.9105]]] } },
  ],
}

const renderResult = computed<{ svg: string }>(() => {
  const raw = geojsonText.value.trim()
  if (!raw) {
    statusText.value = '就绪…点击「载入示例」或直接粘贴 GeoJSON'
    statusClass.value = ''
    return { svg: '' }
  }
  let geo: any
  try {
    geo = JSON.parse(raw)
  } catch (e: any) {
    statusText.value = 'JSON 解析失败: ' + e.message
    statusClass.value = 'err'
    return { svg: '' }
  }
  try {
    const [w, h] = canvasSize.value.split('x').map(Number) as [number, number]
    const out: SvgRenderResult = generateSVG(geo, {
      width: w, height: h,
      lineColor: lineColor.value,
      fillColor: fillColor.value,
      pointColor: pointColor.value,
      lineWidth: lineWidth.value,
      pointR: pointR.value,
      fillOpacity: fillOpacity.value,
      bg: bgMode.value,
    })
    const types = Object.entries(out.count).filter(([, v]) => v > 0).map(([k, v]) => k + '×' + v).join(' · ')
    statusText.value = `✓ ${types} · 共 ${out.coords} 个坐标 · BBox [${fmt(out.bbox.west)},${fmt(out.bbox.south)} → ${fmt(out.bbox.east)},${fmt(out.bbox.north)}] · 输出 ${out.W}×${out.H}`
    statusClass.value = 'ok'
    return { svg: out.svg }
  } catch (e: any) {
    statusText.value = '生成失败: ' + e.message
    statusClass.value = 'err'
    return { svg: '' }
  }
})

function loadExample() {
  geojsonText.value = JSON.stringify(EXAMPLE, null, 2)
}

function clearInput() {
  geojsonText.value = ''
}

function downloadSvg() {
  if (!renderResult.value.svg) { statusText.value = '没有可下载的 SVG，请先输入或载入数据'; statusClass.value = 'err'; return }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + renderResult.value.svg
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'map.svg'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

async function copySvg() {
  if (!renderResult.value.svg) { statusText.value = '没有可复制的 SVG，请先输入数据'; statusClass.value = 'err'; return }
  let ok = false
  try { await navigator.clipboard.writeText(renderResult.value.svg); ok = true } catch {
    const ta = document.createElement('textarea')
    ta.value = renderResult.value.svg; ta.style.position = 'fixed'; ta.style.opacity = '0'
    document.body.appendChild(ta); ta.select()
    ok = document.execCommand('copy'); ta.remove()
  }
  statusText.value = ok ? `✓ SVG 源码已复制到剪贴板（共 ${renderResult.value.svg.length} 字符）` : '复制失败，请手动选中源码复制'
  statusClass.value = ok ? 'ok' : 'err'
}

loadExample()
</script>

<style scoped>
.color-input {
  width: 36px; height: 28px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  padding: 1px; background: #1a1a2e; cursor: pointer;
}
.hex-val { font-size: 0.75rem; color: #a0a0a0; font-family: Consolas, monospace; }
.range-input { width: 100%; accent-color: #667eea; }
.svg-stage {
  flex: 1; min-height: 430px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
  padding: 14px; overflow: auto;
}
.svg-stage :deep(svg) { max-width: 100%; height: auto; display: block; }
</style>
