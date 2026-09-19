<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">属性字段计算器</h1>
      <span class="page-subtitle">按表达式为 Feature 批量计算新字段</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入与表达式</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clear">清空</button>
          </div>
          <div class="panel-body">
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON FeatureCollection..."></textarea>
            <div class="action-row">
              <label class="form-label" style="margin:0;">新字段名</label>
              <input class="form-input" v-model="fieldName" placeholder="如 result / area_km2" style="max-width:180px;" />
            </div>
            <div>
              <label class="form-label">表达式（可直接引用 properties 中的字段名）</label>
              <textarea class="form-textarea" v-model="expr" style="min-height:60px;" placeholder="示例：&#10;a * b&#10;Math.round(area / 1000)&#10;name.toUpperCase()&#10;val > 100 ? '高' : '低'"></textarea>
            </div>
            <span class="form-hint">支持：数学 + - * / % · Math.round/floor/abs/sqrt/pow · 字符串 .toUpperCase/.toLowerCase · 条件 cond ? a : b · 常量 Math.PI</span>
            <div class="action-row">
              <button class="btn btn-primary" @click="doPreview">预览前 3 条</button>
              <button class="btn btn-secondary" @click="doApply">应用到全部</button>
              <span class="msg" :class="inMsgClass">{{ inMsg }}</span>
            </div>
            <div v-if="preview.length > 0" class="info-box" style="flex-direction:column;align-items:flex-start;">
              <span style="color:#667eea;font-weight:700;font-size:0.8125rem;">预览前 {{ preview.length }} 条</span>
              <div v-for="r in preview" :key="r.index" style="font-family:Consolas,monospace;font-size:0.75rem;padding:2px 0;">
                <span style="color:#606060;">#{{ r.index }}</span>
                = <span v-if="r.error" style="color:#ef4444;">错误: {{ r.error }}</span>
                <span v-else style="color:#fff;font-weight:600;">{{ typeof r.value === 'string' ? '"' + r.value + '"' : String(r.value) }}</span>
              </div>
            </div>
          </div>
        </div>
        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输出结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="outMsgClass">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div v-if="resultCards.length > 0" class="result-grid">
              <div v-for="c in resultCards" :key="c.label" class="result-card">
                <span class="label">{{ c.label }}</span>
                <span class="value" :style="c.color ? { color: c.color } : {}">{{ c.value }}</span>
              </div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="计算结果将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copy">复制</button>
              <button class="btn btn-secondary" @click="download">下载 .geojson</button>
              <span class="msg" :class="actMsgClass">{{ actMsg }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { previewValues, applyToAll } from '../utils/field-calc'
import type { PreviewItem, FeatureCollection } from '../utils/field-calc'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const fieldName = ref('result')
const expr = ref('a * b')

const inMsg = ref('')
const inMsgClass = ref('')
const outMsg = ref('')
const outMsgClass = ref('')
const actMsg = ref('')
const actMsgClass = ref('')
const preview = ref<PreviewItem[]>([])
const resultCards = ref<{ label: string; value: string; color?: string }[]>([])

function parseInput(): FeatureCollection {
  const text = input.value.trim()
  if (!text) throw new Error('请输入 GeoJSON')
  return JSON.parse(text) as FeatureCollection
}

function doPreview() {
  inMsg.value = ''
  inMsgClass.value = ''
  try {
    const fc = parseInput()
    preview.value = previewValues(fc, expr.value, 3)
    if (preview.value.length === 0) {
      inMsg.value = '无要素可预览'
      return
    }
    inMsg.value = '预览完成'
    inMsgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '预览失败: ' + (e as Error).message
    inMsgClass.value = 'err'
    preview.value = []
  }
}

function doApply() {
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  actMsg.value = ''
  actMsgClass.value = ''
  try {
    const fc = parseInput()
    const t0 = Date.now()
    const res = applyToAll(fc, fieldName.value.trim(), expr.value)
    output.value = JSON.stringify(res.fc, null, 2)
    resultCards.value = [
      { label: '新字段', value: fieldName.value },
      { label: '要素总数', value: String(res.total) },
      { label: '成功', value: String(res.okCount), color: '#10b981' },
      { label: '失败', value: String(res.errCount), color: res.errCount ? '#ef4444' : '#606060' },
      { label: '耗时', value: (Date.now() - t0) + ' ms' },
    ]
    inMsg.value = '应用成功: ' + res.okCount + '/' + res.total
    inMsgClass.value = 'ok'
    outMsg.value = '已生成'
    outMsgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '应用失败: ' + (e as Error).message
    inMsgClass.value = 'err'
    resultCards.value = []
  }
}

function loadSample() {
  const sample = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { name: '地块A', a: 10, b: 3, area: 5600 }, geometry: { type: 'Point', coordinates: [116.4, 39.9] } },
      { type: 'Feature', properties: { name: '地块B', a: 25, b: 4, area: 12000 }, geometry: { type: 'Point', coordinates: [116.5, 39.95] } },
      { type: 'Feature', properties: { name: '地块C', a: 8, b: 5, area: 3200 }, geometry: { type: 'Point', coordinates: [116.45, 39.85] } },
      { type: 'Feature', properties: { name: '地块D', a: 15, b: 6, area: 8800 }, geometry: { type: 'Point', coordinates: [116.42, 39.88] } },
    ],
  }
  input.value = JSON.stringify(sample, null, 2)
  fieldName.value = 'result'
  expr.value = 'a * b'
  doPreview()
}

function clear() {
  input.value = ''
  output.value = ''
  fieldName.value = ''
  expr.value = ''
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  actMsg.value = ''
  actMsgClass.value = ''
  preview.value = []
  resultCards.value = []
}

function copy() {
  if (!output.value) {
    actMsg.value = '请先应用'
    actMsgClass.value = 'err'
    return
  }
  navigator.clipboard.writeText(output.value).then(() => {
    actMsg.value = '已复制'
    actMsgClass.value = 'ok'
  })
}

function download() {
  if (!output.value) {
    actMsg.value = '请先应用'
    actMsgClass.value = 'err'
    return
  }
  const blob = new Blob([output.value], { type: 'application/geo+json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'field-calculated.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
  actMsg.value = '已下载'
  actMsgClass.value = 'ok'
}
</script>
