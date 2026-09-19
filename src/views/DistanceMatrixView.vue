<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">距离矩阵计算器</h1>
      <span class="page-subtitle">GeoJSON / CSV → Haversine 球面距离 N×N 矩阵</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head">
            <span class="t">输入点集</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <div class="info-box" style="margin-bottom: 0.5rem;">
              支持 GeoJSON FeatureCollection of Points 或 CSV（name,经度,纬度 / 经度,纬度）
            </div>
            <textarea class="form-textarea" v-model="input" placeholder='粘贴点集数据'></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">计算</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">距离矩阵</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyResult">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadCsv">下载 .csv</button>
            <span class="msg" :class="{ ok: outMsgType === 'ok' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="stats">
              <div class="result-card"><span class="label">点数</span><span class="value">{{ stats.n }}</span></div>
              <div class="result-card"><span class="label">矩阵元素数</span><span class="value">{{ stats.cells }}</span></div>
              <div class="result-card"><span class="label">最大距离对</span><span class="value">{{ stats.maxPair ? stats.maxPair[0] + ' ↔ ' + stats.maxPair[1] : '—' }}</span><span class="sub">{{ stats.maxPair ? stats.max.toFixed(4) + ' km' : '' }}</span></div>
              <div class="result-card"><span class="label">最小距离对</span><span class="value">{{ stats.minPair ? stats.minPair[0] + ' ↔ ' + stats.minPair[1] : '—' }}</span><span class="sub">{{ stats.minPair ? stats.min.toFixed(4) + ' km' : '' }}</span></div>
              <div class="result-card"><span class="label">平均距离</span><span class="value">{{ stats.n > 1 ? stats.avg.toFixed(4) + ' km' : '—' }}</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="计算结果 CSV 矩阵将显示在此..."></textarea>
          </div>
        </section>
      </div>
      <div class="tool-footer">距离采用 Haversine 球面公式（R = 6371.0088 km）；矩阵对称，对角线为 0</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parsePoints, distanceMatrix, matrixToCsv, matrixStats, type MatrixStats } from '../utils/distance-matrix'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const stats = ref<MatrixStats | null>(null)

const SAMPLE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '北京' }, geometry: { type: 'Point', coordinates: [116.4, 39.9] } },
    { type: 'Feature', properties: { name: '上海' }, geometry: { type: 'Point', coordinates: [121.47, 31.23] } },
    { type: 'Feature', properties: { name: '广州' }, geometry: { type: 'Point', coordinates: [113.26, 23.13] } },
    { type: 'Feature', properties: { name: '成都' }, geometry: { type: 'Point', coordinates: [104.07, 30.57] } },
    { type: 'Feature', properties: { name: '西安' }, geometry: { type: 'Point', coordinates: [108.94, 34.34] } },
  ],
}, null, 2)

function run() {
  const text = input.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  stats.value = null
  if (!text) { inMsg.value = '请输入点集数据'; inMsgType.value = 'err'; return }
  try {
    const points = parsePoints(text)
    if (points.length < 1) { inMsg.value = '未解析到任何点'; inMsgType.value = 'err'; return }
    if (points.length > 1000) { inMsg.value = '点数过多（>1000），请分批'; inMsgType.value = 'err'; return }
    const names = points.map((p) => p.name)
    const mat = distanceMatrix(points)
    output.value = matrixToCsv(names, mat)
    const s = matrixStats(points, mat)
    stats.value = s
    inMsg.value = '解析到 ' + s.n + ' 个点，矩阵 ' + s.n + '×' + s.n
    inMsgType.value = 'ok'
  } catch (e) {
    inMsg.value = '解析失败: ' + (e as Error).message
    inMsgType.value = 'err'
  }
}

function copyResult() {
  if (!output.value) { outMsg.value = '无结果可复制'; outMsgType.value = 'err'; return }
  navigator.clipboard?.writeText(output.value).then(() => { outMsg.value = '已复制'; outMsgType.value = 'ok' })
}

function downloadCsv() {
  if (!output.value) { outMsg.value = '无结果可下载'; outMsgType.value = 'err'; return }
  const blob = new Blob(['\uFEFF' + output.value], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'distance-matrix.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
  outMsg.value = '已下载'
  outMsgType.value = 'ok'
}

function loadSample() { input.value = SAMPLE; run() }
function clearAll() {
  input.value = ''
  output.value = ''
  stats.value = null
  inMsg.value = ''
  outMsg.value = ''
}
</script>
