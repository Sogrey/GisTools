<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">按属性溶解</h1>
      <span class="page-subtitle">按属性分组 · 同组相邻多边形合并</span>
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
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON FeatureCollection（Polygon / MultiPolygon）..."></textarea>
            <div class="action-row">
              <label class="form-label" style="margin:0;">分组属性名</label>
              <input class="form-input" v-model="propName" placeholder="如 type / category / zone" />
            </div>
            <span class="form-hint">按指定属性值分组，同组的多边形通过消除共享边合并为外边界。仅处理外环，不支持内部洞。</span>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">溶解</button>
              <span class="msg" :class="inMsgClass">{{ inMsg }}</span>
            </div>
          </div>
        </div>
        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">溶解结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="outMsgClass">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div v-if="resultCards.length > 0" class="result-grid">
              <div v-for="c in resultCards" :key="c.label" class="result-card">
                <span class="label">{{ c.label }}</span>
                <span class="value">{{ c.value }}</span>
              </div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="溶解结果将显示在这里"></textarea>
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
import { dissolveByProperty } from '../utils/dissolve'
import type { FeatureCollection } from '../utils/dissolve'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const propName = ref('zone')

const inMsg = ref('')
const inMsgClass = ref('')
const outMsg = ref('')
const outMsgClass = ref('')
const actMsg = ref('')
const actMsgClass = ref('')
const resultCards = ref<{ label: string; value: string }[]>([])

function run() {
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  actMsg.value = ''
  actMsgClass.value = ''
  const text = input.value.trim()
  if (!text) {
    inMsg.value = '请输入 GeoJSON'
    inMsgClass.value = 'err'
    return
  }
  try {
    const fc = JSON.parse(text) as FeatureCollection
    const t0 = Date.now()
    const res = dissolveByProperty(fc, propName.value.trim())
    output.value = JSON.stringify(res.fc, null, 2)
    resultCards.value = [
      { label: '原始要素', value: String(res.stats.originalCount) },
      { label: '溶解后组数', value: String(res.stats.groupCount) },
      { label: '最大组', value: String(res.stats.maxGroup) },
      { label: '耗时', value: (Date.now() - t0) + ' ms' },
    ]
    inMsg.value = '溶解完成: ' + res.stats.originalCount + ' 个要素 -> ' + res.stats.groupCount + ' 组'
    inMsgClass.value = 'ok'
    outMsg.value = '已生成'
    outMsgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '溶解失败: ' + (e as Error).message
    inMsgClass.value = 'err'
    resultCards.value = []
  }
}

function loadSample() {
  const sample = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { zone: 'A' }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] } },
      { type: 'Feature', properties: { zone: 'A' }, geometry: { type: 'Polygon', coordinates: [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]] } },
      { type: 'Feature', properties: { zone: 'A' }, geometry: { type: 'Polygon', coordinates: [[[0, 1], [1, 1], [1, 2], [0, 2], [0, 1]]] } },
      { type: 'Feature', properties: { zone: 'B' }, geometry: { type: 'Polygon', coordinates: [[[3, 3], [4, 3], [4, 4], [3, 4], [3, 3]]] } },
    ],
  }
  input.value = JSON.stringify(sample, null, 2)
  propName.value = 'zone'
  run()
}

function clear() {
  input.value = ''
  output.value = ''
  propName.value = ''
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  actMsg.value = ''
  actMsgClass.value = ''
  resultCards.value = []
}

function copy() {
  if (!output.value) {
    actMsg.value = '请先溶解'
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
    actMsg.value = '请先溶解'
    actMsgClass.value = 'err'
    return
  }
  const blob = new Blob([output.value], { type: 'application/geo+json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dissolved.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
  actMsg.value = '已下载'
  actMsgClass.value = 'ok'
}
</script>
