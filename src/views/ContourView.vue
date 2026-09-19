<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">等值线生成</h1>
      <span class="page-subtitle">Marching Squares 网格等值线追踪 · SVG 预览</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 左侧：网格数据输入 -->
        <div class="panel">
          <div class="panel-head"><span class="t">网格数据输入</span></div>
          <div class="panel-body">
            <div class="tabs" style="padding-bottom:0.5rem">
              <button class="tab" :class="{ active: inputMode === 'csv' }" @click="switchMode('csv')">CSV: x,y,value</button>
              <button class="tab" :class="{ active: inputMode === 'matrix' }" @click="switchMode('matrix')">矩阵值</button>
            </div>
            <textarea class="form-textarea" v-model="inputText" spellcheck="false" :placeholder="placeholderText"></textarea>
            <div v-if="inputMode === 'matrix'" style="margin-top:0.5rem">
              <div class="action-row" style="margin-bottom:0.375rem">
                <label class="form-label" style="margin:0;width:60px">起点 X</label>
                <input class="form-input" type="number" v-model.number="mX0" style="width:80px" />
                <label class="form-label" style="margin:0;width:60px">起点 Y</label>
                <input class="form-input" type="number" v-model.number="mY0" style="width:80px" />
              </div>
              <div class="action-row">
                <label class="form-label" style="margin:0;width:60px">格距 DX</label>
                <input class="form-input" type="number" v-model.number="mDx" step="any" style="width:80px" />
                <label class="form-label" style="margin:0;width:60px">格距 DY</label>
                <input class="form-input" type="number" v-model.number="mDy" step="any" style="width:80px" />
              </div>
            </div>
            <div class="action-row" style="margin-top:0.5rem">
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            </div>
            <div class="form-group" style="margin-top:0.5rem">
              <label class="form-label">等值线间隔</label>
              <input class="form-input" type="number" v-model.number="interval" step="any" style="width:80px" />
            </div>
            <div class="form-group">
              <label class="form-label">最小值（留空自动）</label>
              <input class="form-input" type="number" v-model.number="userMin" step="any" style="width:90px" placeholder="自动" />
            </div>
            <div class="form-group">
              <label class="form-label">最大值（留空自动）</label>
              <input class="form-input" type="number" v-model.number="userMax" step="any" style="width:90px" placeholder="自动" />
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="generate">生成等值线</button>
            </div>
            <div class="msg" :class="msgClass" v-if="msgText">{{ msgText }}</div>
          </div>
        </div>

        <!-- 右侧：SVG 预览 -->
        <div class="panel">
          <div class="panel-head"><span class="t">SVG 预览</span></div>
          <div class="panel-body">
            <div class="svg-stage" v-html="svgPreview"></div>
            <div class="result-card" v-if="statsText" style="margin-top:0.5rem">
              <span class="label">生成信息</span>
              <span class="value" style="white-space:pre-line;font-size:0.75rem">{{ statsText }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- GeoJSON 输出 -->
      <div class="panel" style="margin-top:1rem">
        <div class="panel-head">
          <span class="t">等值线 GeoJSON 输出</span>
          <span class="spacer"></span>
          <button class="btn btn-secondary btn-small" @click="copyGeoJson">{{ copyLabel }}</button>
          <button class="btn btn-primary btn-small" @click="downloadGeoJson">下载 .geojson</button>
        </div>
        <div class="panel-body">
          <textarea class="form-textarea" :value="geojsonOutput" readonly spellcheck="false"
            placeholder="点击「生成等值线」后在此显示 GeoJSON"></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseCSV, parseMatrix, buildContours, buildContourSvg } from '../utils/contour'

const router = useRouter()
const goBack = () => router.push('/')

const inputMode = ref<'csv' | 'matrix'>('csv')
const inputText = ref('')
const mX0 = ref(0), mY0 = ref(0), mDx = ref(1), mDy = ref(1)
const interval = ref(2)
const userMin = ref<number | null>(null)
const userMax = ref<number | null>(null)

const svgPreview = ref('')
const geojsonOutput = ref('')
const statsText = ref('')
const msgText = ref('')
const msgClass = ref('')
const copyLabel = ref('复制 GeoJSON')

const SAMPLE_CSV = '0,0,10\n1,0,12\n2,0,14\n0,1,8\n1,1,11\n2,1,13\n0,2,6\n1,2,9\n2,2,10'
const SAMPLE_MATRIX = '10 12 14\n8 11 13\n6 9 10'

const placeholderText = computed(() => inputMode.value === 'csv'
  ? 'CSV 格式：每行 x,y,value\n例如：\n0,0,10\n1,0,12\n2,0,14\n0,1,8\n1,1,11\n2,1,13\n0,2,6\n1,2,9\n2,2,10'
  : '矩阵格式：每行空格/Tab 分隔的数值\n例如：\n10 12 14\n8 11 13\n6 9 10')

function switchMode(mode: 'csv' | 'matrix') {
  inputMode.value = mode
}

function loadSample() {
  if (inputMode.value === 'csv') {
    inputText.value = SAMPLE_CSV
  } else {
    inputText.value = SAMPLE_MATRIX
    mX0.value = 0; mY0.value = 0; mDx.value = 1; mDy.value = 1
  }
  msgText.value = '已载入示例 3×3 网格数据'
  msgClass.value = 'ok'
}

function generate() {
  msgText.value = ''
  let parsed
  try {
    if (inputMode.value === 'csv') parsed = parseCSV(inputText.value)
    else parsed = parseMatrix(inputText.value, mX0.value, mY0.value, mDx.value, mDy.value)
  } catch (e: any) {
    msgText.value = '解析失败：' + e.message; msgClass.value = 'err'; return
  }

  const grid = parsed.grid, xCoords = parsed.xCoords, yCoords = parsed.yCoords
  let vmin = Infinity, vmax = -Infinity
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0]!.length; c++) {
      if (grid[r]![c]! < vmin) vmin = grid[r]![c]!
      if (grid[r]![c]! > vmax) vmax = grid[r]![c]!
    }
  }
  if (userMin.value != null && isFinite(userMin.value)) vmin = userMin.value
  if (userMax.value != null && isFinite(userMax.value)) vmax = userMax.value

  if (!isFinite(interval.value) || interval.value <= 0) {
    msgText.value = '等值线间隔必须为正数'; msgClass.value = 'err'; return
  }
  const levels: number[] = []
  const start = Math.ceil(vmin / interval.value) * interval.value
  for (let v = start; v <= vmax + 1e-9; v += interval.value) {
    levels.push(Math.round(v * 1e6) / 1e6)
  }
  if (!levels.length) {
    msgText.value = `在 [${vmin}, ${vmax}] 范围内无等值线（间隔 ${interval.value}）`; msgClass.value = 'err'; return
  }

  const fc = buildContours(grid, xCoords, yCoords, levels)
  svgPreview.value = buildContourSvg(fc, levels)
  geojsonOutput.value = JSON.stringify(fc, null, 2)

  statsText.value =
    `网格：${grid[0]!.length}×${grid.length}（${xCoords.length}列 × ${yCoords.length}行）\n` +
    `值域：${vmin.toFixed(2)} ~ ${vmax.toFixed(2)}\n` +
    `等值线级别（${levels.length} 条）：${levels.map((l) => l.toFixed(2)).join(', ')}\n` +
    `生成线段数：${fc.features.length} 条 LineString`

  msgText.value = `生成完成，共 ${fc.features.length} 条等值线，${levels.length} 个级别`
  msgClass.value = 'ok'
}

async function copyGeoJson() {
  if (!geojsonOutput.value) return
  try { await navigator.clipboard.writeText(geojsonOutput.value) } catch {
    const ta = document.createElement('textarea')
    ta.value = geojsonOutput.value; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); ta.remove()
  }
  copyLabel.value = '已复制 ✓'
  setTimeout(() => { copyLabel.value = '复制 GeoJSON' }, 1200)
}

function downloadGeoJson() {
  if (!geojsonOutput.value) return
  const blob = new Blob([geojsonOutput.value], { type: 'application/geo+json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'contours.geojson'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
</script>

<style scoped>
.svg-stage {
  flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
}
.svg-stage :deep(svg) { max-width: 100%; height: auto; }
</style>
