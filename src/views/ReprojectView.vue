<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">GeoJSON 批量投影变换</h1>
      <span class="page-subtitle">WGS84 ↔ 墨卡托 ↔ GCJ02 ↔ BD09</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入 GeoJSON</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom: 0.5rem;">
              <label class="form-label" style="margin: 0;">源投影</label>
              <select class="form-select" v-model="srcCrs" style="width: 160px;">
                <option value="EPSG:4326">WGS84 (4326)</option>
                <option value="EPSG:3857">Web 墨卡托 (3857)</option>
                <option value="EPSG:4490">CGCS2000 (4490)</option>
                <option value="GCJ02">GCJ02 火星坐标</option>
                <option value="BD09">BD09 百度坐标</option>
              </select>
              <span style="color: #606060;">→</span>
              <label class="form-label" style="margin: 0;">目标投影</label>
              <select class="form-select" v-model="dstCrs" style="width: 160px;">
                <option value="EPSG:3857">Web 墨卡托 (3857)</option>
                <option value="EPSG:4326">WGS84 (4326)</option>
                <option value="EPSG:4490">CGCS2000 (4490)</option>
                <option value="GCJ02">GCJ02 火星坐标</option>
                <option value="BD09">BD09 百度坐标</option>
              </select>
            </div>
            <textarea v-model="inputText" class="form-textarea" placeholder="粘贴 GeoJSON FeatureCollection / Feature / Geometry..."></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runTransform">批量变换</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">变换结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" style="margin-bottom: 0.5rem;">
              <div class="result-card">
                <span class="label">变换路径</span>
                <span class="value" style="font-size: 0.8125rem;">{{ srcCrs }} → {{ dstCrs }}</span>
              </div>
              <div class="result-card">
                <span class="label">要素数</span>
                <span class="value">{{ statFeat }}</span>
              </div>
              <div class="result-card">
                <span class="label">坐标数</span>
                <span class="value">{{ statCoords }}</span>
              </div>
              <div class="result-card">
                <span class="label">耗时</span>
                <span class="value">{{ statTime }} ms</span>
              </div>
            </div>
            <textarea v-model="outputText" class="form-textarea" readonly placeholder="变换结果将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copyOutput">复制</button>
              <button class="btn btn-secondary" @click="downloadOutput">下载 .geojson</button>
              <span class="msg" :class="{ ok: actMsgType === 'ok', err: actMsgType === 'err' }">{{ actMsg }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="tool-footer">
        WGS84↔墨卡托精确公式 · WGS84↔GCJ02↔BD09 纠偏公式 · CGCS2000≈WGS84（差异 &lt;1cm）· 其他投影暂不支持
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { reprojectGeoJSON, countFeatures, countCoords } from '../utils/reproject'

const router = useRouter()
const goBack = () => router.push('/')

const inputText = ref('')
const outputText = ref('')
const srcCrs = ref('EPSG:4326')
const dstCrs = ref('EPSG:3857')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const actMsg = ref('')
const actMsgType = ref('')
const statFeat = ref(0)
const statCoords = ref(0)
const statTime = ref(0)

const SAMPLE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '北京' }, geometry: { type: 'Point', coordinates: [116.4, 39.9] } },
    { type: 'Feature', properties: { name: '上海' }, geometry: { type: 'Point', coordinates: [121.47, 31.23] } },
    { type: 'Feature', properties: { name: '广州' }, geometry: { type: 'Point', coordinates: [113.23, 23.13] } },
  ],
}, null, 2)

function runTransform() {
  const text = inputText.value.trim()
  inMsg.value = ''
  outMsg.value = ''
  actMsg.value = ''
  if (!text) {
    inMsg.value = '请输入 GeoJSON'
    inMsgType.value = 'err'
    return
  }
  try {
    const gj = JSON.parse(text)
    const t0 = Date.now()
    const result = reprojectGeoJSON(gj, srcCrs.value, dstCrs.value)
    statFeat.value = countFeatures(result)
    statCoords.value = countCoords(result)
    statTime.value = Date.now() - t0
    outputText.value = JSON.stringify(result, null, 2)
    inMsg.value = '变换成功'
    inMsgType.value = 'ok'
    outMsg.value = '已生成'
    outMsgType.value = 'ok'
  } catch (e) {
    inMsg.value = '变换失败: ' + (e as Error).message
    inMsgType.value = 'err'
    outMsg.value = ''
    statFeat.value = 0
    statCoords.value = 0
    statTime.value = 0
  }
}

function copyOutput() {
  if (!outputText.value) {
    actMsg.value = '请先变换'
    actMsgType.value = 'err'
    return
  }
  navigator.clipboard.writeText(outputText.value).then(() => {
    actMsg.value = '已复制'
    actMsgType.value = 'ok'
    setTimeout(() => { actMsg.value = '' }, 1500)
  }).catch(() => {
    const ta = document.createElement('textarea')
    ta.value = outputText.value
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy'); actMsg.value = '已复制'; actMsgType.value = 'ok' } catch { actMsg.value = '复制失败'; actMsgType.value = 'err' }
    document.body.removeChild(ta)
  })
}

function downloadOutput() {
  if (!outputText.value) {
    actMsg.value = '请先变换'
    actMsgType.value = 'err'
    return
  }
  const blob = new Blob([outputText.value], { type: 'application/geo+json;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'reprojected.geojson'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
  actMsg.value = '已下载 reprojected.geojson'
  actMsgType.value = 'ok'
}

function loadSample() {
  inputText.value = SAMPLE
  srcCrs.value = 'EPSG:4326'
  dstCrs.value = 'EPSG:3857'
  runTransform()
}

function clearAll() {
  inputText.value = ''
  outputText.value = ''
  inMsg.value = ''
  outMsg.value = ''
  actMsg.value = ''
  statFeat.value = 0
  statCoords.value = 0
  statTime.value = 0
}
</script>
