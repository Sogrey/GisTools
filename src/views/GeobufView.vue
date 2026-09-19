<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">GeoBuf 编解码</h1>
      <span class="page-subtitle">GeoJSON ↔ 压缩格式 · Base64 · 压缩率统计 · 纯本地</span>
    </div>

    <!-- 主内容 -->
    <div class="tool-main">
      <!-- 提示 -->
      <div class="info-box" style="margin-bottom: 1rem">
        <span>简化实现，非标准 GeoBuf（基于 JSON + 字符串替换压缩 + Base64 编码，保证完美往返）</span>
      </div>

      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">GeoJSON 输入</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearLeft">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="leftText"
              class="form-textarea"
              placeholder="粘贴 GeoJSON..."
              @keydown.ctrl.enter.prevent="runEncode"
              @keydown.meta.enter.prevent="runEncode"
            ></textarea>
            <span class="msg" :class="{ ok: leftMsgType === 'ok', err: leftMsgType === 'err' }">{{ leftMsg }}</span>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">GeoBuf (Base64)</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyRight">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadRight">下载</button>
            <button class="btn btn-secondary btn-small" @click="clearRight">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="rightText"
              class="form-textarea"
              placeholder="Base64 编码结果将在此显示..."
              @keydown.ctrl.enter.prevent="runDecode"
              @keydown.meta.enter.prevent="runDecode"
            ></textarea>
            <span class="msg" :class="{ ok: rightMsgType === 'ok', err: rightMsgType === 'err' }">{{ rightMsg }}</span>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="center-btn-row">
        <button class="btn btn-primary" @click="runEncode">编码 →</button>
        <button class="btn btn-primary" @click="runDecode">← 解码</button>
        <button class="btn btn-secondary" @click="swapContent">⇄ 互换</button>
      </div>

      <!-- 统计 -->
      <div v-if="statsVisible" class="result-grid" style="margin-top: 1rem">
        <div class="result-card">
          <span class="label">原始大小</span>
          <span class="value">{{ statOriginal }} 字符</span>
        </div>
        <div class="result-card">
          <span class="label">编码大小</span>
          <span class="value">{{ statEncoded }} 字符</span>
        </div>
        <div class="result-card">
          <span class="label">压缩率</span>
          <span class="value">{{ statRatio }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { encodeGeoBuf, decodeGeoBuf } from '../utils/geobuf-codec'

const router = useRouter()
const goBack = () => router.push('/')

const leftText = ref('')
const rightText = ref('')
const leftMsg = ref('')
const leftMsgType = ref('')
const rightMsg = ref('')
const rightMsgType = ref('')
const statsVisible = ref(false)
const statOriginal = ref(0)
const statEncoded = ref(0)
const statRatio = ref('0')

const SAMPLE_GEOJSON = JSON.stringify(
  {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '点A' },
        geometry: { type: 'Point', coordinates: [116.4, 39.9] },
      },
      {
        type: 'Feature',
        properties: { name: '线B' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [116.4, 39.9],
            [116.5, 40.0],
            [116.6, 40.05],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: '面C' },
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [116.39, 39.92],
              [116.4, 39.92],
              [116.4, 39.91],
              [116.39, 39.91],
              [116.39, 39.92],
            ],
          ],
        },
      },
    ],
  },
  null,
  2,
)

function runEncode() {
  const text = leftText.value.trim()
  if (!text) {
    leftMsg.value = '请输入 GeoJSON'
    leftMsgType.value = 'err'
    return
  }
  try {
    const geojson = JSON.parse(text)
    const result = encodeGeoBuf(geojson)
    rightText.value = result.encoded
    statsVisible.value = true
    statOriginal.value = result.originalSize
    statEncoded.value = result.encodedSize
    statRatio.value = result.ratio
    leftMsg.value = '编码成功'
    leftMsgType.value = 'ok'
    rightMsg.value = ''
  } catch (e) {
    leftMsg.value = '编码失败: ' + (e as Error).message
    leftMsgType.value = 'err'
  }
}

function runDecode() {
  const text = rightText.value.trim()
  if (!text) {
    rightMsg.value = '请输入 Base64 编码'
    rightMsgType.value = 'err'
    return
  }
  try {
    const geojson = decodeGeoBuf(text)
    leftText.value = JSON.stringify(geojson, null, 2)
    statsVisible.value = true
    statOriginal.value = JSON.stringify(geojson).length
    statEncoded.value = text.length
    statRatio.value = ((text.length / JSON.stringify(geojson).length) * 100).toFixed(1)
    rightMsg.value = '解码成功'
    rightMsgType.value = 'ok'
    leftMsg.value = ''
  } catch (e) {
    rightMsg.value = '解码失败: ' + (e as Error).message
    rightMsgType.value = 'err'
  }
}

function swapContent() {
  const tmp = leftText.value
  leftText.value = rightText.value
  rightText.value = tmp
  leftMsg.value = ''
  rightMsg.value = ''
  statsVisible.value = false
}

function loadSample() {
  leftText.value = SAMPLE_GEOJSON
  leftMsg.value = '已载入示例 GeoJSON'
  leftMsgType.value = 'ok'
}

function clearLeft() {
  leftText.value = ''
  leftMsg.value = ''
}

function clearRight() {
  rightText.value = ''
  rightMsg.value = ''
  statsVisible.value = false
}

function copyRight() {
  if (!rightText.value) return
  navigator.clipboard
    .writeText(rightText.value)
    .then(() => {
      rightMsg.value = '已复制'
      rightMsgType.value = 'ok'
      setTimeout(() => {
        rightMsg.value = ''
      }, 900)
    })
    .catch(() => {
      const ta = document.createElement('textarea')
      ta.value = rightText.value
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        rightMsg.value = '已复制'
        rightMsgType.value = 'ok'
      } catch {
        rightMsg.value = '复制失败'
        rightMsgType.value = 'err'
      }
      document.body.removeChild(ta)
    })
}

function downloadRight() {
  if (!rightText.value) return
  const blob = new Blob([rightText.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'geobuf.b64'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }, 500)
}
</script>

<style scoped>
.center-btn-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
}
</style>
