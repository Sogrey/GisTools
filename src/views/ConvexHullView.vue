<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">凸包计算器</h1>
      <span class="page-subtitle">Monotone Chain O(n log n) · 点集 → 凸包多边形</span>
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
              支持每行一个点「经度,纬度」或 GeoJSON（Point / MultiPoint / FeatureCollection）
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴坐标或 GeoJSON"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">计算凸包</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">凸包结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok', err: outMsgType === 'err' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="result">
              <div class="result-card"><span class="label">输入点数</span><span class="value">{{ result.points.length }}</span><span class="sub">{{ result.source === 'geojson' ? 'GeoJSON' : 'CSV' }}{{ result.ignored > 0 ? ' · 忽略 ' + result.ignored + ' 个' : '' }}</span></div>
              <div class="result-card"><span class="label">凸包顶点数</span><span class="value">{{ result.hull.length }}</span><span class="sub">{{ result.degenerate ? '共线退化' : '逆时针 CCW' }}</span></div>
              <div class="result-card"><span class="label">凸包面积</span><span class="value">{{ result.areaKm2.toFixed(4) }} km²</span><span class="sub">{{ (result.areaKm2 * 100).toFixed(2) }} 公顷</span></div>
              <div class="result-card"><span class="label">凸包周长</span><span class="value">{{ result.perimKm.toFixed(4) }} km</span><span class="sub">{{ (result.perimKm * 1000).toFixed(0) }} m</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="凸包 GeoJSON 将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copyResult">复制 GeoJSON</button>
              <span class="msg" :class="{ ok: actMsgType === 'ok' }">{{ actMsg }}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">Andrew's Monotone Chain · shoelace 面积近似 · Haversine 周长（R=6371.0088 km）</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { buildResult, type HullResult } from '../utils/convex-hull'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const actMsg = ref('')
const actMsgType = ref('')
const result = ref<HullResult | null>(null)

function randomSample(): string {
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const lng = (116.0 + Math.random() * 0.6).toFixed(4)
    const lat = (39.75 + Math.random() * 0.35).toFixed(4)
    pts.push(lng + ',' + lat)
  }
  return pts.join('\n')
}

function run() {
  const text = input.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  actMsg.value = ''
  result.value = null
  if (!text) { inMsg.value = '请输入点坐标或 GeoJSON'; inMsgType.value = 'err'; return }
  try {
    const t0 = Date.now()
    const res = buildResult(text)
    const elapsed = Date.now() - t0
    output.value = JSON.stringify(res.fc, null, 2)
    result.value = res
    if (res.degenerate) {
      inMsg.value = '注意：点集共线或仅 2 个不同位置，凸包退化为线段'
      inMsgType.value = ''
    } else {
      inMsg.value = '计算成功：' + res.points.length + ' 点 → ' + res.hull.length + ' 个凸包顶点（' + elapsed + ' ms）'
      inMsgType.value = 'ok'
    }
    outMsg.value = '已生成'
    outMsgType.value = 'ok'
  } catch (e) {
    inMsg.value = '计算失败：' + (e as Error).message
    inMsgType.value = 'err'
    outMsgType.value = 'err'
  }
}

function copyResult() {
  if (!output.value) { actMsg.value = '请先计算凸包'; return }
  navigator.clipboard?.writeText(output.value).then(() => { actMsg.value = '已复制到剪贴板'; actMsgType.value = 'ok' })
}

function loadSample() { input.value = randomSample(); run() }
function clearAll() {
  input.value = ''
  output.value = ''
  result.value = null
  inMsg.value = ''
  outMsg.value = ''
  actMsg.value = ''
}
</script>
