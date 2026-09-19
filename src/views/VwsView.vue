<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">Visvalingam-Whyatt 简化</h1>
      <span class="page-subtitle">VWS 有效面积算法 · 比 DP 更好保持形状特征</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入 GeoJSON</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clear">清空</button>
          </div>
          <div class="panel-body">
            <div class="tabs">
              <button class="tab" :class="{ active: vwsMode === 'area' }" @click="setMode('area')">按面积阈值</button>
              <button class="tab" :class="{ active: vwsMode === 'percent' }" @click="setMode('percent')">按百分比保留</button>
            </div>
            <div class="action-row">
              <label class="form-label" style="margin:0;">{{ paramLabel }}</label>
              <input class="form-input" type="number" v-model.number="param" :min="paramMin" style="width:110px;" />
              <button class="btn btn-primary" @click="run">执行</button>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON：LineString / MultiLineString / Polygon / MultiPolygon..."></textarea>
            <span class="msg" :class="inMsgClass">{{ inMsg }}</span>
            <span class="form-hint">{{ modeHint }}</span>
          </div>
        </div>
        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">简化结果</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copy">复制</button>
            <button class="btn btn-secondary btn-small" @click="download">下载</button>
          </div>
          <div class="panel-body">
            <div class="result-grid">
              <div class="result-card"><span class="label">原始点数</span><span class="value">{{ origPoints }}</span></div>
              <div class="result-card"><span class="label">简化点数</span><span class="value">{{ outPoints }}</span></div>
              <div class="result-card"><span class="label">压缩率</span><span class="value">{{ compressRate }}</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="简化后的 GeoJSON 将显示在这里"></textarea>
            <span class="msg" :class="outMsgClass">{{ outMsg }}</span>
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
import { parseGeometry } from '../utils/vws-simplify'
import type { VwsMode } from '../utils/vws-simplify'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const vwsMode = ref<VwsMode>('area')
const param = ref(100)

const inMsg = ref('')
const inMsgClass = ref('')
const outMsg = ref('')
const outMsgClass = ref('')
const origPoints = ref('—')
const outPoints = ref('—')
const compressRate = ref('—')

const paramLabel = computed(() => (vwsMode.value === 'area' ? '阈值 (m²)' : '保留百分比 (%)'))
const paramMin = computed(() => (vwsMode.value === 'area' ? 0 : 1))
const modeHint = computed(() =>
  vwsMode.value === 'area'
    ? '按面积阈值：移除所有三角形面积小于阈值的点（单位 m²）。面积用局部等距投影计算。'
    : '按百分比保留：按三角形面积从小到大移除，直到剩余指定百分比的顶点数。始终保留首末点。',
)

function setMode(m: VwsMode) {
  vwsMode.value = m
  if (m === 'area') param.value = 100
  else param.value = 50
}

function run() {
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  const raw = input.value.trim()
  if (!raw) {
    inMsg.value = '请输入 GeoJSON'
    inMsgClass.value = 'err'
    return
  }
  if (vwsMode.value === 'area' && !(param.value >= 0)) {
    inMsg.value = '面积阈值需 >= 0'
    inMsgClass.value = 'err'
    return
  }
  if (vwsMode.value === 'percent' && !(param.value > 0 && param.value <= 100)) {
    inMsg.value = '百分比需在 1~100 之间'
    inMsgClass.value = 'err'
    return
  }
  try {
    const res = parseGeometry(raw, param.value, vwsMode.value, param.value)
    output.value = JSON.stringify(res.geometry, null, 2)
    origPoints.value = String(res.origPoints)
    outPoints.value = String(res.outPoints)
    compressRate.value =
      res.origPoints > 0 ? ((1 - res.outPoints / res.origPoints) * 100).toFixed(1) + '%' : '—'
    inMsg.value =
      (vwsMode.value === 'area' ? '面积阈值 ' + param.value + ' m²' : '保留 ' + param.value + '%') +
      ' · ' +
      res.origPoints +
      ' → ' +
      res.outPoints +
      ' 点'
    inMsgClass.value = 'ok'
    outMsg.value = '简化完成'
    outMsgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '处理失败: ' + (e as Error).message
    inMsgClass.value = 'err'
  }
}

function loadSample() {
  const sample = {
    type: 'LineString',
    coordinates: [
      [116.0, 39.0], [116.1, 39.0], [116.2, 39.1], [116.3, 39.0], [116.4, 39.05],
      [116.5, 39.0], [116.6, 39.1], [116.7, 39.0], [116.8, 39.05], [116.9, 39.0],
    ],
  }
  input.value = JSON.stringify(sample, null, 2)
  setMode('percent')
  run()
}

function clear() {
  input.value = ''
  output.value = ''
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  origPoints.value = '—'
  outPoints.value = '—'
  compressRate.value = '—'
}

function copy() {
  if (!output.value) {
    outMsg.value = '无内容可复制'
    outMsgClass.value = 'err'
    return
  }
  navigator.clipboard.writeText(output.value).then(() => {
    outMsg.value = '已复制到剪贴板'
    outMsgClass.value = 'ok'
  })
}

function download() {
  if (!output.value) {
    outMsg.value = '暂无内容可下载'
    outMsgClass.value = 'err'
    return
  }
  const blob = new Blob([output.value], { type: 'application/json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'vws-simplified.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
  outMsg.value = '已下载'
  outMsgClass.value = 'ok'
}
</script>
