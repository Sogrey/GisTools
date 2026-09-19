<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">OSM 解析器</h1>
      <span class="page-subtitle">.osm XML → GeoJSON · node→Point · way→Line/Polygon · 纯本地</span>
    </div>

    <!-- 主内容 -->
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">OSM XML 输入</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <!-- 上传区 -->
            <div
              class="upload-zone"
              :class="{ dragging: isDragging }"
              @click="triggerFileInput"
              @dragover.prevent="isDragging = true"
              @dragleave.prevent="isDragging = false"
              @drop.prevent="handleDrop"
            >
              <input
                ref="fileInputRef"
                type="file"
                accept=".osm,.xml"
                style="display: none"
                @change="handleFileSelect"
              />
              <span v-if="!fileName">点击或拖放 .osm 文件到这里</span>
              <span v-else>{{ fileName }} ({{ fileSize }})</span>
            </div>
            <textarea
              v-model="inputText"
              class="form-textarea"
              placeholder="粘贴 OSM XML 或上传 .osm 文件...  (Ctrl+Enter 解析)"
              @keydown.ctrl.enter.prevent="runParse"
              @keydown.meta.enter.prevent="runParse"
            ></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runParse">解析为 GeoJSON →</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">GeoJSON 输出</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyOutput">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadOutput">下载 .geojson</button>
          </div>
          <div class="panel-body">
            <div v-if="statsVisible" class="result-grid">
              <div class="result-card">
                <span class="label">节点 (Node)</span>
                <span class="value">{{ statNodes }}</span>
              </div>
              <div class="result-card">
                <span class="label">路径 (Way)</span>
                <span class="value">{{ statWays }}</span>
              </div>
              <div class="result-card">
                <span class="label">关系 (Relation)</span>
                <span class="value">{{ statRels }}</span>
              </div>
              <div class="result-card">
                <span class="label">Feature 总数</span>
                <span class="value">{{ statFeat }}</span>
              </div>
            </div>
            <textarea v-model="outputText" class="form-textarea" readonly placeholder="GeoJSON 将在此显示..."></textarea>
            <span class="msg" :class="{ ok: outMsgType === 'ok', err: outMsgType === 'err' }">{{ outMsg }}</span>
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
import { parseOsm } from '../utils/osm-parser'

const router = useRouter()
const goBack = () => router.push('/')

const inputText = ref('')
const outputText = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const statsVisible = ref(false)
const statNodes = ref(0)
const statWays = ref(0)
const statRels = ref(0)
const statFeat = ref(0)
const isDragging = ref(false)
const fileName = ref('')
const fileSize = ref('')
const fileInputRef = ref<HTMLInputElement>()

const SAMPLE_OSM = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="test">
  <node id="1001" lat="39.9087" lon="116.3974" version="1">
    <tag k="name" v="天安门"/>
    <tag k="tourism" v="attraction"/>
  </node>
  <node id="1002" lat="39.9100" lon="116.4000" version="1"/>
  <node id="1003" lat="39.9120" lon="116.4020" version="1"/>
  <node id="1004" lat="39.9080" lon="116.4020" version="1"/>
  <node id="1005" lat="39.9080" lon="116.4000" version="1"/>
  <way id="2001" version="1">
    <nd ref="1002"/>
    <nd ref="1003"/>
    <tag k="highway" v="residential"/>
    <tag k="name" v="测试路"/>
  </way>
  <way id="2002" version="1">
    <nd ref="1002"/>
    <nd ref="1004"/>
    <nd ref="1005"/>
    <nd ref="1002"/>
    <tag k="building" v="yes"/>
    <tag k="name" v="测试楼"/>
  </way>
  <relation id="3001" version="1">
    <member type="way" ref="2002" role="outer"/>
    <tag k="type" v="multipolygon"/>
    <tag k="name" v="测试多边形"/>
  </relation>
</osm>`

function fmtSize(n: number): string {
  if (n < 1024) return n + 'B'
  return (n / 1024).toFixed(1) + 'KB'
}

function runParse() {
  const text = inputText.value.trim()
  if (!text) {
    inMsg.value = '请输入 OSM XML 或上传文件'
    inMsgType.value = 'err'
    return
  }
  try {
    const result = parseOsm(text)
    outputText.value = JSON.stringify(result.geojson, null, 2)
    statsVisible.value = true
    statNodes.value = result.nodeCount
    statWays.value = result.wayCount
    statRels.value = result.relationCount
    statFeat.value = result.featureCount
    inMsg.value = '解析成功，共 ' + result.featureCount + ' 个 Feature'
    inMsgType.value = 'ok'
    outMsg.value = ''
  } catch (e) {
    inMsg.value = '解析失败: ' + (e as Error).message
    inMsgType.value = 'err'
  }
}

function loadSample() {
  inputText.value = SAMPLE_OSM
  fileName.value = ''
  inMsg.value = '已载入示例 OSM XML'
  inMsgType.value = 'ok'
}

function clearAll() {
  inputText.value = ''
  outputText.value = ''
  inMsg.value = ''
  outMsg.value = ''
  statsVisible.value = false
  fileName.value = ''
  fileSize.value = ''
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  readFile(file)
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  readFile(file)
}

function readFile(file: File) {
  const reader = new FileReader()
  reader.onload = (ev) => {
    inputText.value = (ev.target?.result as string) || ''
    fileName.value = file.name
    fileSize.value = fmtSize(file.size)
    inMsg.value = '已加载文件: ' + file.name + ' (' + fmtSize(file.size) + ')'
    inMsgType.value = 'ok'
  }
  reader.readAsText(file)
}

function copyOutput() {
  if (!outputText.value) return
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
  const blob = new Blob([outputText.value], { type: 'application/geo+json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'osm_export.geojson'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }, 500)
}
</script>
