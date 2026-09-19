<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">缓冲区生成器</h1>
      <span class="page-subtitle">点/线/多边形 → 缓冲区 GeoJSON · 平面米制近似</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head">
            <span class="t">输入几何</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin: 0;">几何类型</label>
              <select class="form-select" v-model="typeMode" style="width: auto;">
                <option value="auto">自动识别</option>
                <option value="point">多个点（每行一点）</option>
                <option value="line">折线（串联所有点）</option>
                <option value="polygon">多边形（自动闭合）</option>
              </select>
              <label class="form-label" style="margin: 0;">缓冲距离</label>
              <input class="form-input" type="number" v-model.number="dist" min="1" step="1" style="width: 90px;" />
              <span class="form-hint" style="margin: 0;">米</span>
            </div>
            <div class="action-row">
              <label class="form-label" style="margin: 0;">点形状</label>
              <select class="form-select" v-model="shape" style="width: auto;">
                <option value="circle">圆形</option>
                <option value="square">方形（bbox）</option>
              </select>
              <label class="form-label" style="margin: 0;">弧段数</label>
              <select class="form-select" v-model.number="segments" style="width: auto;">
                <option :value="36">36 段</option>
                <option :value="64">64 段</option>
              </select>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴坐标（每行：经度,纬度）或 GeoJSON"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">生成缓冲区</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">缓冲区输出</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="stats">
              <div class="result-card"><span class="label">缓冲几何</span><span class="value">{{ stats.featureCount }} 个</span><span class="sub">{{ stats.srcText }}</span></div>
              <div class="result-card"><span class="label">总顶点数</span><span class="value">{{ stats.verts }}</span></div>
              <div class="result-card"><span class="label">总面积(近似)</span><span class="value">{{ stats.areaKm2.toFixed(4) }} km²</span><span class="sub">{{ (stats.areaKm2 * 100).toFixed(2) }} 公顷</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="生成结果 GeoJSON 将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copyResult">复制 GeoJSON</button>
              <span class="msg" :class="{ ok: actMsgType === 'ok' }">{{ actMsg }}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">点：圆形/方形 · 线：圆角折线 · 面：法线外推 · 平面米制近似 · 纯本地</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { generateBuffer, totalAreaKm2, countVertices, type BufferResult } from '../utils/buffer-gen'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const typeMode = ref('auto')
const dist = ref(500)
const shape = ref<'circle' | 'square'>('circle')
const segments = ref(36)
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const actMsg = ref('')
const actMsgType = ref('')
const stats = ref<{ featureCount: number; srcText: string; verts: number; areaKm2: number } | null>(null)

const samples = [
  { label: '点', text: '116.391,39.907\n116.414,39.912\n116.391,39.926' },
  { label: '线', text: '116.31,39.90\n116.36,39.95\n116.42,39.92\n116.47,39.97' },
  { label: '面', text: '116.34,39.88\n116.44,39.88\n116.44,39.96\n116.34,39.96\n116.34,39.88' },
]
let sampleIdx = -1

function run() {
  const text = input.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  actMsg.value = ''
  stats.value = null
  if (!text) { inMsg.value = '请输入坐标或 GeoJSON'; inMsgType.value = 'err'; return }
  if (!(dist.value > 0)) { inMsg.value = '缓冲距离需 > 0 米'; inMsgType.value = 'err'; return }
  const seg = segments.value || 36
  try {
    const t0 = Date.now()
    const res = generateBuffer(text, typeMode.value, dist.value, shape.value, seg)
    const fc = res.fc as { type: string; features: { geometry: { coordinates: [number, number][][] } }[] }
    const areaKm2 = totalAreaKm2(fc)
    const verts = countVertices(fc)
    const src = res.srcInfo.reduce<Record<string, number>>((a, b) => { a[b] = (a[b] || 0) + 1; return a }, {})
    const srcTxt = Object.keys(src).map((k) => k + '×' + src[k]).join('、')
    stats.value = { featureCount: (fc.features as unknown[]).length, srcText: srcTxt, verts, areaKm2 }
    output.value = JSON.stringify(fc, null, 2)
    inMsg.value = '生成成功：' + (fc.features as unknown[]).length + ' 个缓冲面'
    inMsgType.value = 'ok'
    outMsg.value = '耗时 ' + (Date.now() - t0) + ' ms'
    outMsgType.value = 'ok'
  } catch (e) {
    inMsg.value = '生成失败：' + (e as Error).message
    inMsgType.value = 'err'
  }
}

function copyResult() {
  if (!output.value) { actMsg.value = '请先生成缓冲区'; return }
  navigator.clipboard?.writeText(output.value).then(() => { actMsg.value = '已复制到剪贴板'; actMsgType.value = 'ok' })
}

function loadSample() {
  sampleIdx = (sampleIdx + 1) % samples.length
  const s = samples[sampleIdx]!
  input.value = s.text
  typeMode.value = 'auto'
  dist.value = s.label === '面' ? 300 : 500
  inMsg.value = '已载入' + s.label + '示例'
  inMsgType.value = 'ok'
  run()
}

function clearAll() {
  input.value = ''
  output.value = ''
  stats.value = null
  inMsg.value = ''
  outMsg.value = ''
  actMsg.value = ''
}
</script>
