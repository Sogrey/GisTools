<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">要素合并 / 拆分 / 过滤</h1>
      <span class="page-subtitle">多源合并 · 属性过滤 · 几何过滤 · 分组拆分</span>
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
              <button class="tab" :class="{ active: mode === 'merge' }" @click="mode = 'merge'">合并多个</button>
              <button class="tab" :class="{ active: mode === 'filter-attr' }" @click="mode = 'filter-attr'">属性过滤</button>
              <button class="tab" :class="{ active: mode === 'filter-geom' }" @click="mode = 'filter-geom'">几何过滤</button>
              <button class="tab" :class="{ active: mode === 'split' }" @click="mode = 'split'">分组拆分</button>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴一个或多个 GeoJSON FeatureCollection，多个之间用空行或分号隔开..."></textarea>
            <!-- 属性过滤条件 -->
            <div v-if="mode === 'filter-attr'" class="action-row">
              <label class="form-label" style="margin:0;">属性名</label>
              <input class="form-input" v-model="attrName" style="flex:1;" placeholder="如 name" />
              <select class="form-select" v-model="attrMatch">
                <option value="eq">等于 =</option>
                <option value="neq">不等于 ≠</option>
                <option value="contains">包含</option>
                <option value="exists">字段存在</option>
                <option value="notnull">值非空</option>
              </select>
              <input class="form-input" v-model="attrValue" style="flex:1;" placeholder="属性值" />
            </div>
            <!-- 几何过滤条件 -->
            <div v-if="mode === 'filter-geom'" class="action-row">
              <label class="form-label" style="margin:0;">几何类型</label>
              <select class="form-select" v-model="geomType" style="flex:1;">
                <option value="Point">Point</option>
                <option value="MultiPoint">MultiPoint</option>
                <option value="LineString">LineString</option>
                <option value="MultiLineString">MultiLineString</option>
                <option value="Polygon">Polygon</option>
                <option value="MultiPolygon">MultiPolygon</option>
                <option value="Point,MultiPoint">Point 类（含 Multi）</option>
                <option value="LineString,MultiLineString">Line 类（含 Multi）</option>
                <option value="Polygon,MultiPolygon">Polygon 类（含 Multi）</option>
              </select>
            </div>
            <!-- 分组拆分条件 -->
            <div v-if="mode === 'split'" class="action-row">
              <label class="form-label" style="margin:0;">分组属性名</label>
              <input class="form-input" v-model="splitAttr" style="flex:1;" placeholder="如 type / category" />
            </div>
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
              <div class="result-card"><span class="label">输出类型</span><span class="value">{{ sType }}</span></div>
              <div class="result-card"><span class="label">Feature 数</span><span class="value">{{ sFeat }}</span></div>
              <div class="result-card"><span class="label">分组数</span><span class="value">{{ sGroup }}</span></div>
              <div class="result-card"><span class="label">体积</span><span class="value">{{ sSize }}</span></div>
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
import {
  parseMultiJSON, mergeFeatures, filterByAttr, filterByGeom, splitByAttr, fmtSize,
} from '../utils/feature-merge'
import type { MatchType } from '../utils/feature-merge'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const output = ref('')
const mode = ref<'merge' | 'filter-attr' | 'filter-geom' | 'split'>('merge')
const attrName = ref('type')
const attrMatch = ref<MatchType>('eq')
const attrValue = ref('')
const geomType = ref('Point')
const splitAttr = ref('type')

const inMsg = ref('')
const inMsgClass = ref('')
const outMsg = ref('')
const outMsgClass = ref('')
const sType = ref('—')
const sFeat = ref('0')
const sGroup = ref('—')
const sSize = ref('0B')

const modeHint = computed(() => {
  const hints: Record<string, string> = {
    merge: '合并模式：将输入中的所有 FeatureCollection 的 Feature 合并为一个 FeatureCollection。',
    'filter-attr': '属性过滤：输入属性名和值，保留匹配的 Feature。支持精确匹配 / 不等于 / 包含 / 字段存在 / 非空。',
    'filter-geom': '几何过滤：只保留指定几何类型的 Feature。可多选，用逗号分隔。',
    split: '分组拆分：按指定属性值分组，每个组输出一个独立的 FeatureCollection。',
  }
  return hints[mode.value]
})

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
  try {
    const objects = parseMultiJSON(raw)
    if (objects.length === 0) throw new Error('未提取到任何 JSON 对象')
    let outText = ''
    let featCount = 0
    let groupCount: string = '—'
    let typeLabel = 'FeatureCollection'

    if (mode.value === 'merge') {
      const result = mergeFeatures(objects)
      outText = JSON.stringify(result, null, 2)
      featCount = result.features.length
      inMsg.value = '从 ' + objects.length + ' 个 JSON 对象中合并'
      inMsgClass.value = 'ok'
    } else if (mode.value === 'filter-attr') {
      if (objects.length > 1) {
        inMsg.value = '检测到 ' + objects.length + ' 个 JSON，已自动合并后过滤'
        inMsgClass.value = 'ok'
      }
      const fc = mergeFeatures(objects)
      if (!attrName.value.trim() && attrMatch.value !== 'exists' && attrMatch.value !== 'notnull') {
        throw new Error('请输入属性名')
      }
      const result = filterByAttr(fc, attrName.value.trim(), attrValue.value, attrMatch.value)
      outText = JSON.stringify(result, null, 2)
      featCount = result.features.length
    } else if (mode.value === 'filter-geom') {
      if (objects.length > 1) {
        inMsg.value = '检测到 ' + objects.length + ' 个 JSON，已自动合并后过滤'
        inMsgClass.value = 'ok'
      }
      const fc = mergeFeatures(objects)
      const result = filterByGeom(fc, geomType.value)
      outText = JSON.stringify(result, null, 2)
      featCount = result.features.length
    } else if (mode.value === 'split') {
      if (objects.length > 1) {
        inMsg.value = '检测到 ' + objects.length + ' 个 JSON，已自动合并后拆分'
        inMsgClass.value = 'ok'
      }
      const fc = mergeFeatures(objects)
      if (!splitAttr.value.trim()) throw new Error('请输入分组属性名')
      const groups = splitByAttr(fc, splitAttr.value.trim())
      outText = JSON.stringify(groups, null, 2)
      featCount = fc.features.length
      groupCount = String(Object.keys(groups).length)
      typeLabel = '分组集合 (Object)'
    }

    output.value = outText
    sType.value = typeLabel
    sFeat.value = String(featCount)
    sGroup.value = groupCount
    sSize.value = fmtSize(outText.length)
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
      { type: 'Feature', properties: { name: '天安门', type: '景点', level: '5A' }, geometry: { type: 'Point', coordinates: [116.391, 39.908] } },
      { type: 'Feature', properties: { name: '颐和园', type: '景点', level: '5A' }, geometry: { type: 'Point', coordinates: [116.395, 39.999] } },
      { type: 'Feature', properties: { name: '中关村', type: '商圈', level: null }, geometry: { type: 'Point', coordinates: [116.31, 39.982] } },
      { type: 'Feature', properties: { name: '五道口', type: '商圈', level: null }, geometry: { type: 'Point', coordinates: [116.338, 39.992] } },
      { type: 'Feature', properties: { name: '故宫城墙', type: '遗迹', level: '4A' }, geometry: { type: 'LineString', coordinates: [[116.397, 39.918], [116.398, 39.916], [116.398, 39.912]] } },
      { type: 'Feature', properties: { name: '奥林匹克公园', type: '绿地', level: '5A' }, geometry: { type: 'Polygon', coordinates: [[[116.385, 40.002], [116.396, 40.002], [116.396, 39.994], [116.385, 39.994], [116.385, 40.002]]] } },
    ],
  }
  input.value = JSON.stringify(sample, null, 2)
  mode.value = 'split'
  run()
}

function clear() {
  input.value = ''
  output.value = ''
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  sType.value = '—'
  sFeat.value = '0'
  sGroup.value = '—'
  sSize.value = '0B'
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
  a.download = 'feature-merge-output.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
  outMsg.value = '已下载'
  outMsgClass.value = 'ok'
}
</script>
