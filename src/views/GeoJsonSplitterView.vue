<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">GeoJSON 分片拆分器</h1>
      <span class="page-subtitle">按要素数 / 体积 / 属性分组拆分</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head"><span class="t">输入数据</span></div>
          <div class="panel-body">
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON FeatureCollection ..."></textarea>
            <div class="action-row">
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            </div>
            <div class="form-group">
              <label class="form-label">拆分模式</label>
              <select class="form-select" v-model="splitMode">
                <option value="count">按要素数</option>
                <option value="size">按体积</option>
                <option value="group">按属性分组</option>
              </select>
            </div>
            <div v-if="splitMode === 'count'" class="form-group">
              <label class="form-label">每片最大要素数</label>
              <input class="form-input" type="number" v-model.number="maxFeatures" min="1" style="width:120px;" />
            </div>
            <div v-if="splitMode === 'size'" class="form-group">
              <label class="form-label">每片最大体积 (MB)</label>
              <input class="form-input" type="number" v-model.number="maxMB" min="0.1" step="0.1" style="width:120px;" />
            </div>
            <div v-if="splitMode === 'group'" class="form-group">
              <label class="form-label">分组属性名</label>
              <input class="form-input" v-model="groupKey" placeholder="如 category、region" />
            </div>
            <button class="btn btn-primary" @click="doSplit">执行拆分</button>
            <span class="msg" :class="msgClass">{{ msg }}</span>
          </div>
        </div>
        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">拆分结果</span>
            <div class="spacer"></div>
            <button v-if="shards.length > 1" class="btn btn-secondary btn-small" @click="downloadAll">全部下载</button>
          </div>
          <div class="panel-body">
            <div v-if="shards.length > 0" class="result-grid">
              <div class="result-card"><span class="label">原始要素数</span><span class="value">{{ origCount }}</span></div>
              <div class="result-card"><span class="label">分片数</span><span class="value">{{ shards.length }}</span></div>
              <div class="result-card"><span class="label">总大小</span><span class="value">{{ totalSize }}</span></div>
              <div class="result-card"><span class="label">平均每片</span><span class="value">{{ avgSize }}</span></div>
            </div>
            <div v-if="shards.length === 0" class="msg">执行拆分后，分片列表将显示在这里</div>
            <table v-if="shards.length > 0" class="data-table">
              <thead>
                <tr><th>编号</th><th>要素数</th><th>大小</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in shards" :key="i">
                  <td>#{{ String(i + 1).padStart(3, '0') }}</td>
                  <td>{{ s.features.length }}</td>
                  <td>{{ formatSize(byteLength(JSON.stringify(s))) }}</td>
                  <td>
                    <button class="btn btn-secondary btn-small" style="margin-right:4px;" @click="copyShard(i)">复制</button>
                    <button class="btn btn-secondary btn-small" @click="downloadShard(i)">下载</button>
                  </td>
                </tr>
              </tbody>
            </table>
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
import {
  parseGeoJSON, executeSplit, byteLength, formatSize, generateExample,
} from '../utils/geojson-splitter'
import type { SplitMode, FeatureCollection } from '../utils/geojson-splitter'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const splitMode = ref<SplitMode>('count')
const maxFeatures = ref(1000)
const maxMB = ref(5)
const groupKey = ref('')
const shards = ref<FeatureCollection[]>([])
const origCount = ref(0)
const totalSize = ref('0 B')
const avgSize = ref('0 B')
const msg = ref('')
const msgClass = ref('')

function doSplit() {
  msg.value = ''
  msgClass.value = ''
  const text = input.value.trim()
  if (!text) {
    msg.value = '请先输入或上传 GeoJSON 数据'
    msgClass.value = 'err'
    return
  }
  let geojson: FeatureCollection
  try {
    geojson = parseGeoJSON(text)
  } catch (e) {
    msg.value = '解析失败: ' + (e as Error).message
    msgClass.value = 'err'
    return
  }
  try {
    shards.value = executeSplit(geojson, splitMode.value, {
      maxFeatures: String(maxFeatures.value),
      maxBytes: String(maxMB.value),
      groupKey: groupKey.value,
    })
    origCount.value = geojson.features.length
    let total = 0
    for (const s of shards.value) total += byteLength(JSON.stringify(s))
    totalSize.value = formatSize(total)
    avgSize.value = formatSize(Math.round(total / shards.value.length))
    msg.value = '拆分完成：共 ' + shards.value.length + ' 个分片'
    msgClass.value = 'ok'
  } catch (e) {
    msg.value = '拆分失败: ' + (e as Error).message
    msgClass.value = 'err'
  }
}

function loadSample() {
  input.value = JSON.stringify(generateExample(), null, 2)
  msg.value = '已载入 20 个要素的示例数据'
  msgClass.value = 'ok'
}

function clearAll() {
  input.value = ''
  shards.value = []
  msg.value = ''
  msgClass.value = ''
}

function pad3(n: number): string {
  return String(n).padStart(3, '0')
}

function copyShard(idx: number) {
  const content = JSON.stringify(shards.value[idx], null, 2)
  navigator.clipboard.writeText(content).then(() => {
    msg.value = '已复制分片 #' + pad3(idx + 1)
    msgClass.value = 'ok'
  })
}

function downloadShard(idx: number) {
  const content = JSON.stringify(shards.value[idx], null, 2)
  const blob = new Blob([content], { type: 'application/geo+json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'split_' + pad3(idx + 1) + '.geojson'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(a.href)
}

function downloadAll() {
  for (let i = 0; i < shards.value.length; i++) {
    setTimeout(() => downloadShard(i), i * 350)
  }
}
</script>
