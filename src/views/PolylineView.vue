<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">Encoded Polyline 编解码</h1>
      <span class="page-subtitle">Google 标准 · delta 编码 · 精度 5/6 位 · 纯本地</span>
    </div>

    <!-- 主内容 -->
    <div class="tool-main">
      <!-- 工具栏 -->
      <div class="toolbar-row">
        <span class="toolbar-label">精度：</span>
        <select v-model.number="precision" class="form-select precision-select">
          <option :value="5">5 — 标准 (1e5)</option>
          <option :value="6">6 — 高精度 (1e6)</option>
        </select>
        <span class="toolbar-label" style="margin-left: 0.5rem">方向：</span>
        <span class="dir-badge">{{ mode === 'encode' ? '坐标 → 编码' : '编码 → 坐标' }}</span>
        <button class="btn btn-secondary btn-small" @click="swapMode">⇄ 切换方向</button>
      </div>

      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">{{ leftLabel }}</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearLeft">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="leftText"
              class="form-textarea"
              :placeholder="leftPlaceholder"
              @keydown.ctrl.enter.prevent="doConvert"
              @keydown.meta.enter.prevent="doConvert"
            ></textarea>
            <span class="msg" :class="{ ok: leftMsgType === 'ok', err: leftMsgType === 'err' }">{{ leftMsg }}</span>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">{{ rightLabel }}</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyRight">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadRight">下载</button>
            <button class="btn btn-secondary btn-small" @click="clearRight">清空</button>
          </div>
          <div class="panel-body">
            <div v-if="statsVisible" class="result-grid">
              <div class="result-card">
                <span class="label">坐标点数</span>
                <span class="value">{{ statCount }}</span>
              </div>
              <div class="result-card">
                <span class="label">{{ mode === 'encode' ? '编码长度' : '精度' }}</span>
                <span class="value">{{ statExtra }}</span>
              </div>
              <div class="result-card">
                <span class="label">精度</span>
                <span class="value">1e{{ precision }}</span>
              </div>
            </div>
            <textarea v-model="rightText" class="form-textarea" :readonly="mode === 'encode'" :placeholder="rightPlaceholder"></textarea>
            <span class="msg" :class="{ ok: rightMsgType === 'ok', err: rightMsgType === 'err' }">{{ rightMsg }}</span>
          </div>
        </div>
      </div>

      <!-- 转换按钮 -->
      <div class="center-btn-row">
        <button class="btn btn-primary" @click="doConvert">{{ mode === 'encode' ? '编码 →' : '解码 →' }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { encodePolyline, decodePolyline, parseCoords, coordsToText } from '../utils/polyline-codec'
import type { Coord } from '../utils/polyline-codec'

const router = useRouter()
const goBack = () => router.push('/')

const mode = ref<'encode' | 'decode'>('encode')
const precision = ref(5)
const leftText = ref('')
const rightText = ref('')
const leftMsg = ref('')
const leftMsgType = ref('')
const rightMsg = ref('')
const rightMsgType = ref('')
const statsVisible = ref(false)
const statCount = ref(0)
const statExtra = ref('')

const SAMPLE_COORDS = '[[116.4,39.9],[116.5,40.0],[116.6,40.05],[116.55,39.95]]'

const leftLabel = computed(() => (mode.value === 'encode' ? '坐标数组' : '编码字符串'))
const rightLabel = computed(() => (mode.value === 'encode' ? '编码字符串' : '坐标数组'))
const leftPlaceholder = computed(() =>
  mode.value === 'encode'
    ? '[[lng,lat],[lng,lat],...]  或  lng,lat;lng,lat;...'
    : 'Encoded Polyline 字符串...',
)
const rightPlaceholder = computed(() =>
  mode.value === 'encode' ? 'Encoded Polyline 字符串...' : '[[lng,lat],[lng,lat],...]',
)

function doConvert() {
  const input = leftText.value.trim()
  if (!input) {
    leftMsg.value = '请输入内容'
    leftMsgType.value = 'err'
    return
  }
  try {
    if (mode.value === 'encode') {
      const coords = parseCoords(input)
      const encoded = encodePolyline(coords as Coord[], precision.value)
      rightText.value = encoded
      statsVisible.value = true
      statCount.value = coords.length
      statExtra.value = encoded.length + ' 字符'
      leftMsg.value = '编码成功'
      leftMsgType.value = 'ok'
      rightMsg.value = ''
    } else {
      const decoded = decodePolyline(input, precision.value)
      if (decoded.length === 0) throw new Error('解码结果为空')
      rightText.value = coordsToText(decoded, precision.value)
      statsVisible.value = true
      statCount.value = decoded.length
      statExtra.value = decoded[0]![0]! + ',' + decoded[0]![1]!
      leftMsg.value = '解码成功'
      leftMsgType.value = 'ok'
      rightMsg.value = ''
    }
  } catch (e) {
    leftMsg.value = '操作失败: ' + (e as Error).message
    leftMsgType.value = 'err'
  }
}

function swapMode() {
  mode.value = mode.value === 'encode' ? 'decode' : 'encode'
  const tmp = leftText.value
  leftText.value = rightText.value
  rightText.value = tmp
  leftMsg.value = ''
  rightMsg.value = ''
  statsVisible.value = false
}

function loadSample() {
  if (mode.value === 'encode') {
    leftText.value = SAMPLE_COORDS
    leftMsg.value = '已载入示例坐标'
    leftMsgType.value = 'ok'
  } else {
    const coords: Coord[] = JSON.parse(SAMPLE_COORDS)
    leftText.value = encodePolyline(coords, precision.value)
    leftMsg.value = '已载入示例编码'
    leftMsgType.value = 'ok'
  }
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
  const name = mode.value === 'encode' ? 'polyline.txt' : 'coords.json'
  const blob = new Blob([rightText.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  }, 500)
}
</script>

<style scoped>
.toolbar-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.toolbar-label {
  font-size: 0.75rem;
  color: #a0a0a0;
}

.precision-select {
  width: auto;
  min-width: 130px;
}

.dir-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.75rem;
  background: rgba(102, 126, 234, 0.12);
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 700;
}

.center-btn-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0;
}
</style>
