<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">GPX 工具箱</h1>
      <span class="page-subtitle">互转 · 轨迹统计 · 纯本地</span>
    </div>

    <!-- 标签页 -->
    <div class="tool-main">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'cvt' }" @click="activeTab = 'cvt'">互转</button>
        <button class="tab" :class="{ active: activeTab === 'stat' }" @click="activeTab = 'stat'">轨迹统计</button>
      </div>

      <!-- ==================== 互转 ==================== -->
      <div v-show="activeTab === 'cvt'" class="tool-grid">
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入</span>
            <span class="dir-tag" :class="{ unknown: cvtDir === 'unknown' }">{{ cvtDirLabel }}</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadCvtSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearCvt">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="cvtInput"
              class="form-textarea"
              placeholder="粘贴 GPX 或 GeoJSON 文本，方向自动识别：&#10;&#10;GPX: <gpx version=&quot;1.1&quot;>...&#10;GeoJSON: {&quot;type&quot;:&quot;FeatureCollection&quot;,...}"
              @input="updateCvtDir"
            ></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runCvt">转换 →</button>
              <span class="msg" :class="cvtMsgClass">{{ cvtInMsg }}</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="t">输出</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="swapCvtOutput">⇄ 用作输入</button>
            <button class="btn btn-secondary btn-small" @click="copyCvtOutput">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadCvtOutput">下载</button>
          </div>
          <div class="panel-body">
            <div class="stat-bar">
              <span>方向 <b>{{ cvtStDir }}</b></span>
              <span>要素 <b>{{ cvtStFeat }}</b></span>
              <span>坐标点 <b>{{ cvtStPts }}</b></span>
              <span style="flex:1"></span>
              <span>体积 <b>{{ cvtStSize }}</b></span>
            </div>
            <textarea v-model="cvtOutput" class="form-textarea" readonly placeholder="转换结果将显示在这里"></textarea>
            <span class="msg" :class="{ ok: cvtOutMsgType === 'ok' }">{{ cvtOutMsg }}</span>
          </div>
        </div>
      </div>

      <!-- ==================== 轨迹统计 ==================== -->
      <div v-show="activeTab === 'stat'" class="tool-grid">
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入 GPX</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadStatSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearStat">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="statInput"
              class="form-textarea"
              placeholder="粘贴 GPX 文件内容：&#10;&#10;<trk><trkseg><trkpt lat=&quot;39.9&quot; lon=&quot;116.4&quot;>...</trkseg></trk>&#10;&#10;支持 trkpt（轨迹点）与 wpt（航点）"
            ></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runStat">分析</button>
              <span class="msg" :class="statMsgClass">{{ statInMsg }}</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="t">统计结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: statOutMsgType === 'ok' }">{{ statOutMsg }}</span>
          </div>
          <div class="panel-body">
            <div v-if="statResult" class="result-grid">
              <div class="result-card">
                <span class="label">总距离</span>
                <span class="value">{{ statResult.dist.toFixed(2) }} km</span>
              </div>
              <div class="result-card">
                <span class="label">累计爬升</span>
                <span class="value">{{ statResult.climb.toFixed(1) }} m</span>
              </div>
              <div class="result-card">
                <span class="label">累计下降</span>
                <span class="value">{{ statResult.drop.toFixed(1) }} m</span>
              </div>
              <div class="result-card">
                <span class="label">海拔范围</span>
                <span class="value">{{ statResult.eleMin === null ? '—' : statResult.eleMin.toFixed(0) }} ~ {{ statResult.eleMax === null ? '—' : statResult.eleMax.toFixed(0) }} m</span>
              </div>
              <div class="result-card">
                <span class="label">平均海拔</span>
                <span class="value">{{ statResult.eleAvg === null ? '—' : statResult.eleAvg.toFixed(1) }} m</span>
              </div>
              <div class="result-card">
                <span class="label">用时</span>
                <span class="value">{{ fmtDuration(statResult.durationS) }}</span>
              </div>
              <div class="result-card">
                <span class="label">平均速度</span>
                <span class="value">{{ statResult.avgSpeed === null ? '—' : statResult.avgSpeed.toFixed(2) }} km/h</span>
              </div>
            </div>
            <div v-if="statDetail" class="stat-detail">{{ statDetail }}</div>
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
  gpxToGeoJson, geoJsonToGpx, detectFormat, countPoints,
  parseGpx, analyze,
} from '../utils/gpx-convert'
import type { GpxStats } from '../utils/gpx-convert'

const router = useRouter()
const goBack = () => router.push('/')

const activeTab = ref<'cvt' | 'stat'>('cvt')

/* ---- 互转状态 ---- */
const cvtInput = ref('')
const cvtOutput = ref('')
const cvtDir = ref<'gpx' | 'geojson' | 'unknown'>('unknown')
const cvtInMsg = ref('')
const cvtOutMsg = ref('')
const cvtMsgClass = ref('')
const cvtOutMsgType = ref('')
const cvtStDir = ref('—')
const cvtStFeat = ref(0)
const cvtStPts = ref(0)
const cvtStSize = ref('0B')

const cvtDirLabel = computed(() => {
  if (cvtDir.value === 'gpx') return 'GPX → GeoJSON'
  if (cvtDir.value === 'geojson') return 'GeoJSON → GPX'
  return cvtInput.value.trim() ? '未识别' : '自动识别'
})

function updateCvtDir() {
  cvtDir.value = detectFormat(cvtInput.value)
}

function fmtSize(n: number): string {
  if (n < 1024) return n + 'B'
  return (n / 1024).toFixed(1) + 'KB'
}

const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="gpx-converter" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>示例轨迹</name>
    <time>2026-09-01T08:00:00Z</time>
  </metadata>
  <wpt lat="39.90" lon="116.40">
    <name>起点</name>
    <ele>50</ele>
    <time>2026-09-01T08:00:00Z</time>
    <desc>天安门广场</desc>
  </wpt>
  <wpt lat="39.910" lon="116.410">
    <name>终点</name>
    <ele>55</ele>
    <time>2026-09-01T09:00:00Z</time>
  </wpt>
  <trk>
    <name>晨跑轨迹</name>
    <trkseg>
      <trkpt lat="39.900" lon="116.400">
        <ele>50</ele>
        <time>2026-09-01T08:00:00Z</time>
      </trkpt>
      <trkpt lat="39.905" lon="116.405">
        <ele>52</ele>
        <time>2026-09-01T08:05:00Z</time>
      </trkpt>
      <trkpt lat="39.910" lon="116.410">
        <ele>55</ele>
        <time>2026-09-01T08:10:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
  <rte>
    <name>步行路线</name>
    <rtept lat="39.900" lon="116.400"/>
    <rtept lat="39.903" lon="116.403"/>
    <rtept lat="39.910" lon="116.410"/>
  </rte>
</gpx>`

function runCvt() {
  const text = cvtInput.value.trim()
  cvtInMsg.value = ''
  cvtOutMsg.value = ''
  cvtMsgClass.value = ''
  cvtOutMsgType.value = ''

  if (!text) {
    cvtInMsg.value = '请粘贴 GPX 或 GeoJSON 文本'
    cvtMsgClass.value = 'err'
    return
  }

  const fmt = detectFormat(text)
  cvtDir.value = fmt
  if (fmt === 'unknown') {
    cvtInMsg.value = '无法识别格式（需 GPX XML 或 GeoJSON）'
    cvtMsgClass.value = 'err'
    return
  }

  try {
    let output: string
    let dir: string
    if (fmt === 'gpx') {
      const fc = gpxToGeoJson(text)
      if (fc.features.length === 0) {
        cvtInMsg.value = '未解析到任何要素'
        cvtMsgClass.value = 'err'
        return
      }
      output = JSON.stringify(fc, null, 2)
      dir = 'GPX → GeoJSON'
      cvtStFeat.value = fc.features.length
      cvtStPts.value = countPoints(fc)
    } else {
      const fc2 = JSON.parse(text)
      output = geoJsonToGpx(fc2)
      dir = 'GeoJSON → GPX'
      const featureCount = (fc2.features || (fc2.type === 'Feature' ? [fc2] : [])).length
      cvtStFeat.value = featureCount
      const fcParsed = { type: 'FeatureCollection' as const, features: fc2.features || (fc2.type === 'Feature' ? [fc2] : []) }
      cvtStPts.value = countPoints(fcParsed)
    }
    cvtOutput.value = output
    cvtStDir.value = dir
    cvtStSize.value = fmtSize(new Blob([output]).size)
    cvtInMsg.value = '转换成功 · ' + dir
    cvtMsgClass.value = 'ok'
  } catch (e) {
    cvtInMsg.value = '转换失败: ' + (e as Error).message
    cvtMsgClass.value = 'err'
  }
}

function loadCvtSample() {
  cvtInput.value = SAMPLE_GPX
  updateCvtDir()
  runCvt()
}

function clearCvt() {
  cvtInput.value = ''
  cvtOutput.value = ''
  cvtInMsg.value = ''
  cvtOutMsg.value = ''
  cvtStDir.value = '—'
  cvtStFeat.value = 0
  cvtStPts.value = 0
  cvtStSize.value = '0B'
  updateCvtDir()
}

function copyCvtOutput() {
  if (!cvtOutput.value) return
  navigator.clipboard.writeText(cvtOutput.value).then(() => {
    cvtOutMsg.value = '已复制到剪贴板'
    cvtOutMsgType.value = 'ok'
    setTimeout(() => { cvtOutMsg.value = '' }, 900)
  })
}

function downloadCvtOutput() {
  if (!cvtOutput.value) return
  const isGpx = cvtOutput.value.trim().startsWith('<?xml') || cvtOutput.value.trim().startsWith('<gpx')
  const ext = isGpx ? '.gpx' : '.geojson'
  const mime = isGpx ? 'application/gpx+xml' : 'application/geo+json'
  const blob = new Blob([cvtOutput.value], { type: mime + ';charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'converted' + ext
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
}

function swapCvtOutput() {
  if (!cvtOutput.value) return
  cvtInput.value = cvtOutput.value
  cvtOutput.value = ''
  updateCvtDir()
  runCvt()
}

/* ---- 轨迹统计状态 ---- */
const statInput = ref('')
const statInMsg = ref('')
const statOutMsg = ref('')
const statMsgClass = ref('')
const statOutMsgType = ref('')
const statResult = ref<GpxStats | null>(null)
const statDetail = ref('')

function fmtDuration(s: number | null): string {
  if (s === null || s === undefined) return '—'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  return (h > 0 ? h + '时' : '') + (m > 0 ? m + '分' : '') + sec + '秒'
}

function runStat() {
  const text = statInput.value.trim()
  statInMsg.value = ''
  statOutMsg.value = ''
  statMsgClass.value = ''
  statOutMsgType.value = ''
  statResult.value = null
  statDetail.value = ''

  if (!text) {
    statInMsg.value = '请粘贴 GPX'
    statMsgClass.value = 'err'
    return
  }

  try {
    const pts = parseGpx(text)
    if (pts.length < 2) {
      statInMsg.value = '解析到 ' + pts.length + ' 个点，至少需 2 个'
      statMsgClass.value = 'err'
      return
    }
    const r = analyze(pts)
    statResult.value = r
    statInMsg.value = '解析到 ' + r.points + ' 个轨迹点'
    statMsgClass.value = 'ok'
    statDetail.value = `海拔中位数: ${r.eleAvg !== null ? r.eleAvg.toFixed(1) + ' m' : '—'} · 速度: ${r.speed !== null ? r.speed.toFixed(2) + ' km/h' : '—'}`
  } catch (e) {
    statInMsg.value = '解析失败: ' + (e as Error).message
    statMsgClass.value = 'err'
  }
}

function loadStatSample() {
  const pts: string[] = []
  for (let i = 0; i <= 30; i++) {
    const lon = 116.39 + i * 0.001
    const lat = 39.90 + i * 0.001
    const ele = 40 + Math.sin(i / 3) * 5
    const t = new Date(Date.UTC(2026, 8, 1, 8, 0, i * 60)).toISOString()
    pts.push(`<trkpt lat="${lat.toFixed(6)}" lon="${lon.toFixed(6)}"><ele>${ele.toFixed(1)}</ele><time>${t}</time></trkpt>`)
  }
  statInput.value = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="demo"><trk><name>晨跑</name><trkseg>\n${pts.join('\n')}\n</trkseg></trk></gpx>`
  runStat()
}

function clearStat() {
  statInput.value = ''
  statResult.value = null
  statDetail.value = ''
  statInMsg.value = ''
  statOutMsg.value = ''
}
</script>

<style scoped>
.stat-bar {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #a0a0a0;
  font-size: 0.8125rem;
  flex-wrap: wrap;
}

.stat-bar b {
  color: #ffffff;
}

.dir-tag {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 6px;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

.dir-tag.unknown {
  background: rgba(255, 255, 255, 0.03);
  color: #606060;
  border-color: rgba(255, 255, 255, 0.08);
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.625rem;
}

.stat-detail {
  color: #606060;
  font-size: 0.8125rem;
  padding-top: 0.25rem;
}
</style>
