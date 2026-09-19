<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">TopoJSON ↔ GeoJSON 互转</h1>
      <span class="page-subtitle">共享弧段去重 · 量化精度可调 · 纯本地</span>
    </div>

    <!-- 主内容 -->
    <div class="tool-main">
      <!-- 工具栏 -->
      <div class="toolbar-row">
        <span class="dir-badge" :class="{ unknown: direction === 'unknown' }">{{ dirLabel }}</span>
        <div class="spacer"></div>
        <span class="toolbar-label">量化精度</span>
        <select v-model.number="precision" class="form-select precision-select">
          <option :value="1">1 位小数</option>
          <option :value="2">2 位小数</option>
          <option :value="4">4 位小数</option>
          <option :value="6">6 位小数（推荐）</option>
          <option :value="8">8 位小数</option>
          <option :value="0">不量化</option>
        </select>
      </div>

      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">{{ inputLabel }}</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadExample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="swapOutput">⇄ 用作输入</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="inputText"
              class="form-textarea"
              placeholder="粘贴 TopoJSON 或 GeoJSON …  (Ctrl+Enter 转换)"
              @input="updateDirection"
              @keydown.ctrl.enter.prevent="runConvert"
              @keydown.meta.enter.prevent="runConvert"
            ></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runConvert">转换 →</button>
              <span class="msg" :class="msgClass">{{ inMsg }}</span>
            </div>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">{{ outputLabel }}</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyOutput">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadOutput">下载</button>
          </div>
          <div class="panel-body">
            <div class="stat-bar">
              <span>要素 <b>{{ statFeat }}</b></span>
              <span>弧段 <b>{{ statArcs }}</b></span>
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
import { topoToGeo, geoToTopo, detectDirection } from '../utils/topojson-convert'
import type { TopoJSON } from '../utils/topojson-convert'

const router = useRouter()
const goBack = () => router.push('/')

const inputText = ref('')
const outputText = ref('')
const direction = ref<'topo-to-geo' | 'geo-to-topo' | 'unknown'>('unknown')
const precision = ref(6)
const inMsg = ref('')
const outMsg = ref('')
const msgClass = ref('')
const outMsgType = ref('')
const statFeat = ref(0)
const statArcs = ref(0)
const statSize = ref('0B')
const downloadName = ref('output.json')
const downloadType = ref('application/json;charset=utf-8')

const SAMPLE_TOPO: TopoJSON = {
  type: 'Topology',
  arcs: [
    [[0, 0], [1, 0]],
    [[1, 0], [0, 1]],
    [[1, 1], [-1, 0], [0, -1]],
    [[1, 0], [1, 0]],
    [[2, 0], [0, 1]],
    [[2, 1], [-1, 0]],
  ],
  objects: {
    layer: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', arcs: [[0, 1, 2]], properties: { name: 'A' } },
        { type: 'Polygon', arcs: [[3, 4, 5, -2]], properties: { name: 'B' } },
      ],
    },
  },
}

const dirLabel = computed(() => {
  if (direction.value === 'topo-to-geo') return 'TopoJSON → GeoJSON'
  if (direction.value === 'geo-to-topo') return 'GeoJSON → TopoJSON'
  return inputText.value.trim() ? '未识别' : '自动识别'
})

const inputLabel = computed(() => {
  if (direction.value === 'topo-to-geo') return '输入 · TopoJSON'
  if (direction.value === 'geo-to-topo') return '输入 · GeoJSON'
  return '输入'
})

const outputLabel = computed(() => {
  if (direction.value === 'topo-to-geo') return '输出 · GeoJSON'
  if (direction.value === 'geo-to-topo') return '输出 · TopoJSON'
  return '输出'
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
    inMsg.value = '请先输入数据'
    msgClass.value = 'err'
    return
  }

  const dir = detectDirection(text)
  if (dir === 'unknown') {
    inMsg.value = '无法识别输入格式'
    msgClass.value = 'err'
    return
  }

  try {
    const obj = JSON.parse(text)
    let result: unknown
    if (dir === 'topo-to-geo') {
      const fc = topoToGeo(obj)
      result = fc
      statFeat.value = fc.features.length
      statArcs.value = 0
      downloadName.value = 'output.geojson'
      downloadType.value = 'application/geo+json;charset=utf-8'
      inMsg.value = 'TopoJSON → GeoJSON 完成，' + fc.features.length + ' 个 Feature'
    } else {
      const topo = geoToTopo(obj, precision.value)
      result = topo
      statFeat.value = topo.objects.layer?.geometries?.length || 0
      statArcs.value = topo.arcs.length
      downloadName.value = 'output.topojson'
      downloadType.value = 'application/json;charset=utf-8'
      inMsg.value =
        'GeoJSON → TopoJSON 完成，' +
        (topo.objects.layer?.geometries?.length || 0) +
        ' 个几何 · ' +
        topo.arcs.length +
        ' 条弧段'
    }
    outputText.value = JSON.stringify(result, null, 2)
    statSize.value = fmtSize(outputText.value.length)
    msgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '转换失败: ' + (e as Error).message
    msgClass.value = 'err'
  }
}

function copyOutput() {
  if (!outputText.value) {
    outMsg.value = '没有可复制的内容'
    outMsgType.value = 'err'
    return
  }
  navigator.clipboard
    .writeText(outputText.value)
    .then(() => {
      outMsg.value = '已复制'
      outMsgType.value = 'ok'
      setTimeout(() => {
        outMsg.value = ''
      }, 900)
    })
    .catch(() => {
      const ta = document.createElement('textarea')
      ta.value = outputText.value
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        outMsg.value = '已复制'
        outMsgType.value = 'ok'
      } catch {
        outMsg.value = '复制失败'
        outMsgType.value = 'err'
      }
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
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }, 500)
}

function loadExample() {
  inputText.value = JSON.stringify(SAMPLE_TOPO, null, 2)
  updateDirection()
  runConvert()
}

function swapOutput() {
  if (!outputText.value) {
    inMsg.value = '没有可填入的内容'
    msgClass.value = 'err'
    return
  }
  inputText.value = outputText.value
  outputText.value = ''
  statFeat.value = 0
  statArcs.value = 0
  statSize.value = '0B'
  updateDirection()
  inMsg.value = '已将输出填入输入'
  msgClass.value = 'ok'
  outMsg.value = ''
}

function clearAll() {
  inputText.value = ''
  outputText.value = ''
  inMsg.value = ''
  outMsg.value = ''
  statFeat.value = 0
  statArcs.value = 0
  statSize.value = '0B'
  updateDirection()
}
</script>

<style scoped>
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.dir-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.75rem;
  background: rgba(102, 126, 234, 0.12);
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 700;
}

.dir-badge.unknown {
  color: #606060;
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.1);
  font-weight: 400;
}

.toolbar-label {
  font-size: 0.75rem;
  color: #a0a0a0;
}

.precision-select {
  width: auto;
  min-width: 140px;
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
