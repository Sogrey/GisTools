<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">点密度热力图</h1>
      <span class="page-subtitle">Canvas 高斯核叠加 · 半径/权重/色带可调 · 下载 PNG</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 左侧：数据与参数 -->
        <div class="panel">
          <div class="panel-head"><span class="t">数据与参数</span></div>
          <div class="panel-body">
            <textarea class="form-textarea" v-model="inputText" spellcheck="false"
              placeholder="粘贴 GeoJSON 点集 (Point / MultiPoint)"></textarea>
            <div class="form-group" style="margin-top:0.5rem">
              <label class="form-label">权重字段</label>
              <select class="form-select" v-model="weightField">
                <option value="">无（均匀权重）</option>
                <option v-for="f in weightFields" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">半径</label>
              <div class="action-row">
                <input class="form-input" type="number" v-model.number="radius" min="1" style="width:90px" />
                <select class="form-select" v-model="radiusUnit" style="width:100px">
                  <option value="px">像素</option>
                  <option value="km">千米</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">色带</label>
              <select class="form-select" v-model="palette">
                <option value="heat">热力图（蓝→青→绿→黄→红）</option>
                <option value="viridis">viridis</option>
                <option value="inferno">inferno</option>
                <option value="gray">灰度</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">透明度 {{ alpha }}%</label>
              <input type="range" v-model.number="alpha" min="20" max="100" class="range-input" />
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="renderHeatmap">渲染热力图</button>
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            </div>
            <div class="msg" :class="msgClass" v-if="msgText">{{ msgText }}</div>
          </div>
        </div>

        <!-- 右侧：Canvas 预览 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">Canvas 预览</span>
            <span class="spacer"></span>
            <button class="btn btn-secondary btn-small" @click="downloadPng">下载 PNG</button>
          </div>
          <div class="panel-body">
            <div class="canvas-wrap" ref="canvasWrapRef">
              <span v-if="!hasRendered" class="placeholder-text">等待渲染…</span>
            </div>
            <div class="result-card" v-if="statsText" style="margin-top:0.5rem">
              <span class="label">渲染信息</span>
              <span class="value" style="white-space:pre-line;font-size:0.75rem">{{ statsText }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parsePoints, extractWeightFields, renderHeat, pointsBbox } from '../utils/heatmap'

const router = useRouter()
const goBack = () => router.push('/')

const inputText = ref('')
const weightField = ref('')
const weightFields = ref<string[]>([])
const radius = ref(30)
const radiusUnit = ref('px')
const palette = ref('heat')
const alpha = ref(80)
const msgText = ref('')
const msgClass = ref('')
const statsText = ref('')
const hasRendered = ref(false)

const canvasWrapRef = ref<HTMLElement>()
let currentCanvas: HTMLCanvasElement | null = null

watch(inputText, () => {
  try {
    const fc = JSON.parse(inputText.value)
    weightFields.value = extractWeightFields(fc)
    msgText.value = ''
  } catch { /* 静默 */ }
})

function loadSample() {
  const fs: any[] = []
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist = Math.random() * Math.random() * 0.05
    const lng = 116.40 + Math.cos(angle) * dist
    const lat = 39.90 + Math.sin(angle) * dist
    fs.push({ type: 'Feature', properties: { weight: Math.round(Math.random() * 10 + 1) }, geometry: { type: 'Point', coordinates: [lng, lat] } })
  }
  inputText.value = JSON.stringify({ type: 'FeatureCollection', features: fs }, null, 2)
  try {
    const fc = JSON.parse(inputText.value)
    weightFields.value = extractWeightFields(fc)
    weightField.value = 'weight'
    msgText.value = '已载入示例数据（60 个随机点）'
    msgClass.value = 'ok'
  } catch (e: any) {
    msgText.value = '示例错误：' + e.message; msgClass.value = 'err'
  }
}

function renderHeatmap() {
  msgText.value = ''
  let fc: any
  try { fc = JSON.parse(inputText.value) } catch (e: any) {
    msgText.value = 'JSON 解析失败：' + e.message; msgClass.value = 'err'; return
  }

  let points
  try { points = parsePoints(fc, weightField.value) } catch (e: any) {
    msgText.value = e.message; msgClass.value = 'err'; return
  }
  if (!points.length) { msgText.value = '未找到 Point 要素'; msgClass.value = 'err'; return }

  const canvas = document.createElement('canvas')
  canvas.width = 500; canvas.height = 400

  let radiusPx = radius.value
  if (radiusUnit.value === 'km') {
    const bbox = pointsBbox(points)
    if (bbox) {
      const bh = bbox[3] - bbox[1]
      const canvasH = 400 - 2 * 30
      const kmPerPixel = (bh * 111) / canvasH
      radiusPx = Math.max(1, Math.round(radius.value / kmPerPixel))
    }
  }

  renderHeat(canvas, points, { radiusPx, palette: palette.value, alpha: alpha.value / 100 })

  if (canvasWrapRef.value) {
    canvasWrapRef.value.innerHTML = ''
    canvasWrapRef.value.appendChild(canvas)
  }
  currentCanvas = canvas
  hasRendered.value = true

  const bbox = pointsBbox(points)
  if (bbox) {
    statsText.value =
      `点数：${points.length} · 权重字段：${weightField.value || '无'}\n` +
      `半径：${radius.value}${radiusUnit.value === 'km' ? ' km → ' + radiusPx + 'px' : ' px'}\n` +
      `范围：[${bbox[0].toFixed(4)}, ${bbox[1].toFixed(4)}] ~ [${bbox[2].toFixed(4)}, ${bbox[3].toFixed(4)}]\n` +
      `色带：${palette.value}`
  }

  msgText.value = '渲染完成，共 ' + points.length + ' 个点'
  msgClass.value = 'ok'
}

function downloadPng() {
  if (!currentCanvas) return
  currentCanvas.toBlob((blob) => {
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'heatmap.png'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }, 'image/png')
}
</script>

<style scoped>
.range-input { width: 100%; accent-color: #667eea; }
.canvas-wrap {
  flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center;
  background: #0b1020; border: 1px solid rgba(255,255,255,0.1); border-radius: 9px; overflow: hidden;
}
.canvas-wrap :deep(canvas) { max-width: 100%; height: auto; }
.placeholder-text { color: #8fa0b5; font-size: 0.8125rem; }
</style>
