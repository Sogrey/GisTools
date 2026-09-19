<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">几何展平 / 合并</h1>
      <span class="page-subtitle">Multi* 展平为单要素 · 同类型合并为 Multi*</span>
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
              <button class="tab" :class="{ active: mode === 'flatten' }" @click="mode = 'flatten'">展平 Multi*</button>
              <button class="tab" :class="{ active: mode === 'merge' }" @click="mode = 'merge'">反向合并</button>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON：Feature / FeatureCollection / 裸 Geometry..."></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">执行</button>
              <div class="spacer" style="flex:1;"></div>
              <span class="msg" :class="inMsgClass">{{ inMsg }}</span>
            </div>
            <span class="form-hint">{{ modeHint }}</span>
          </div>
        </div>
        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输出结果</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copy">复制</button>
            <button class="btn btn-secondary btn-small" @click="download">下载</button>
          </div>
          <div class="panel-body">
            <div class="result-grid">
              <div class="result-card"><span class="label">原始要素数</span><span class="value">{{ sOrig }}</span></div>
              <div class="result-card"><span class="label">输出要素数</span><span class="value">{{ sOut }}</span></div>
              <div class="result-card"><span class="label">类型变化</span><span class="value" style="font-size:0.75rem;line-height:1.5;" v-html="sChanges"></span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="处理结果将显示在这里"></textarea>
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
import { flattenGeometry, mergeFeatures, makeFC } from '../utils/geometry-flatten'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const mode = ref<'flatten' | 'merge'>('flatten')

const inMsg = ref('')
const inMsgClass = ref('')
const outMsg = ref('')
const outMsgClass = ref('')
const sOrig = ref('—')
const sOut = ref('—')
const sChanges = ref('—')

const modeHint = computed(() =>
  mode.value === 'flatten'
    ? '展平模式：将每个 Multi* 几何拆成多个单几何 Feature，属性原样复制。GeometryCollection 递归展平。'
    : '合并模式：将多个同类型单几何合并为一个 Multi* Feature。Point→MultiPoint、LineString→MultiLineString、Polygon→MultiPolygon。',
)

function formatChanges(changes: Record<string, number>): string {
  const keys = Object.keys(changes)
  if (keys.length === 0) return ''
  return keys.map((k) => k + ' ×' + changes[k]).join('<br>')
}

function run() {
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  const raw = input.value.trim()
  if (!raw) {
    outMsg.value = '请先输入 GeoJSON'
    outMsgClass.value = 'err'
    return
  }
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    outMsg.value = 'JSON 解析失败: ' + (e as Error).message
    outMsgClass.value = 'err'
    return
  }
  try {
    let res
    if (mode.value === 'flatten') {
      res = flattenGeometry(obj)
      output.value = JSON.stringify(makeFC(res.features), null, 2)
      sChanges.value = formatChanges(res.changes) || '无 Multi* 展平'
      inMsg.value = '展平 ' + res.inputCount + ' 个要素'
    } else {
      res = mergeFeatures(obj)
      output.value = JSON.stringify(makeFC(res.features), null, 2)
      sChanges.value = formatChanges(res.changes) || '无合并发生'
      inMsg.value = '合并 ' + res.inputCount + ' 个要素'
    }
    inMsgClass.value = 'ok'
    sOrig.value = String(res.inputCount)
    sOut.value = String(res.features.length)
    outMsg.value = '处理完成'
    outMsgClass.value = 'ok'
  } catch (e) {
    outMsg.value = '处理失败: ' + (e as Error).message
    outMsgClass.value = 'err'
  }
}

function loadSample() {
  const sample = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '双地块', code: 'A' },
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[116.38, 39.9], [116.42, 39.9], [116.42, 39.94], [116.38, 39.94], [116.38, 39.9]]],
            [[[116.44, 39.9], [116.48, 39.9], [116.48, 39.94], [116.44, 39.94], [116.44, 39.9]]],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: '多点', code: 'B' },
        geometry: { type: 'MultiPoint', coordinates: [[116.39, 39.91], [116.45, 39.93]] },
      },
    ],
  }
  input.value = JSON.stringify(sample, null, 2)
  mode.value = 'flatten'
  run()
}

function clear() {
  input.value = ''
  output.value = ''
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  sOrig.value = '—'
  sOut.value = '—'
  sChanges.value = '—'
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
  a.download = mode.value === 'flatten' ? 'flattened.geojson' : 'merged.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
  outMsg.value = '已下载'
  outMsgClass.value = 'ok'
}
</script>
