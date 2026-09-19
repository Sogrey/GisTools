<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">地图排版</h1>
      <span class="page-subtitle">经纬网/比例尺/指北针/图例框 SVG 生成</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 左侧：参数设置 -->
        <div class="panel">
          <div class="panel-head"><span class="t">参数设置</span></div>
          <div class="panel-body">
            <div class="form-group">
              <label class="form-label">Bbox（west,south,east,north）</label>
              <input class="form-input" type="text" v-model="bboxText" placeholder="116.0,39.8,116.5,40.1" />
            </div>
            <div class="form-group">
              <label class="form-label">比例尺分母</label>
              <input class="form-input" type="number" v-model.number="scale" min="100" />
            </div>
            <div class="form-group">
              <label class="form-label">中央经线</label>
              <input class="form-input" type="number" v-model.number="centralMeridian" step="any" />
            </div>
            <div class="form-group">
              <label class="form-label">输出宽度 × 高度</label>
              <div class="action-row">
                <input class="form-input" type="number" v-model.number="width" min="200" max="2000" style="width:90px" />
                <span class="form-hint">×</span>
                <input class="form-input" type="number" v-model.number="height" min="200" max="2000" style="width:90px" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">DPI</label>
              <input class="form-input" type="number" v-model.number="dpi" min="72" max="600" style="width:80px" />
            </div>
            <div class="form-group">
              <label class="form-label">经纬网间隔（度，留空自动）</label>
              <input class="form-input" type="number" v-model.number="gratInterval" step="any" style="width:90px" />
            </div>
            <div class="form-group">
              <label class="form-label">元素</label>
              <div class="action-row" style="flex-wrap:wrap">
                <label class="chk-box"><input type="checkbox" v-model="chkGrat" /> 经纬网</label>
                <label class="chk-box"><input type="checkbox" v-model="chkScale" /> 比例尺</label>
                <label class="chk-box"><input type="checkbox" v-model="chkNorth" /> 指北针</label>
                <label class="chk-box"><input type="checkbox" v-model="chkLegend" /> 图例框</label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">图例内容（名称:颜色,...）</label>
              <input class="form-input" type="text" v-model="legendItemsText" />
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="generate">生成排版</button>
              <button class="btn btn-secondary btn-small" @click="resetDefaults">默认参数</button>
            </div>
            <div class="msg" :class="msgClass" v-if="msgText">{{ msgText }}</div>
          </div>
        </div>

        <!-- 右侧：SVG 预览 -->
        <div class="panel">
          <div class="panel-head"><span class="t">SVG 预览</span></div>
          <div class="panel-body">
            <div class="svg-stage" v-html="svgOutput"></div>
          </div>
        </div>
      </div>

      <!-- SVG 代码输出 -->
      <div class="panel" style="margin-top:1rem">
        <div class="panel-head">
          <span class="t">SVG 代码输出</span>
          <span class="spacer"></span>
          <button class="btn btn-secondary btn-small" @click="copySvg">{{ copyLabel }}</button>
          <button class="btn btn-primary btn-small" @click="downloadSvg">下载 .svg</button>
        </div>
        <div class="panel-body">
          <textarea class="form-textarea" :value="svgOutput" readonly spellcheck="false"
            placeholder="点击「生成排版」后在此显示 SVG 代码"></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { buildGraticule, buildScaleBar, buildNorthArrow, buildLegend, parseLegendItems } from '../utils/map-layout'

const router = useRouter()
const goBack = () => router.push('/')

const bboxText = ref('116.0,39.8,116.5,40.1')
const scale = ref(50000)
const centralMeridian = ref(116)
const width = ref(600)
const height = ref(450)
const dpi = ref(96)
const gratInterval = ref(0.1)
const chkGrat = ref(true)
const chkScale = ref(true)
const chkNorth = ref(true)
const chkLegend = ref(true)
const legendItemsText = ref('居民区:#e74c3c,道路:#3498db,绿地:#2ecc71,水体:#1abc9c')

const svgOutput = ref('')
const msgText = ref('')
const msgClass = ref('')
const copyLabel = ref('复制 SVG')

function resetDefaults() {
  bboxText.value = '116.0,39.8,116.5,40.1'
  scale.value = 50000
  centralMeridian.value = 116
  width.value = 600; height.value = 450
  dpi.value = 96; gratInterval.value = 0.1
  legendItemsText.value = '居民区:#e74c3c,道路:#3498db,绿地:#2ecc71,水体:#1abc9c'
  msgText.value = '已恢复默认参数'; msgClass.value = 'ok'
}

function generate() {
  msgText.value = ''
  const bboxParts = bboxText.value.split(',').map((s) => parseFloat(s.trim()))
  if (bboxParts.length !== 4 || bboxParts.some((v) => !isFinite(v))) {
    msgText.value = 'Bbox 格式错误，需 west,south,east,north'; msgClass.value = 'err'; return
  }
  const bbox = bboxParts
  if (bbox[0]! >= bbox[2]! || bbox[1]! >= bbox[3]!) {
    msgText.value = 'Bbox 范围无效：east 须 > west，north 须 > south'; msgClass.value = 'err'; return
  }
  if (!isFinite(scale.value) || scale.value < 100) {
    msgText.value = '比例尺分母须 ≥ 100'; msgClass.value = 'err'; return
  }

  const vw = width.value || 600
  const vh = height.value || 450
  const margin = 40, topMargin = 25, bottomMargin = 55
  const mapX = margin, mapY = topMargin
  const mapW = vw - margin - 15
  const mapH = vh - topMargin - bottomMargin

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}" font-family="Microsoft YaHei,system-ui,sans-serif">`
  svg += `<rect width="${vw}" height="${vh}" fill="#fff"/>`
  svg += `<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="#fafcff" stroke="#90a4ae" stroke-width="1.2" rx="2"/>`

  if (chkGrat.value) {
    const grat = buildGraticule(bbox, gratInterval.value, mapX, mapY, mapW, mapH)
    svg += grat.svg
  }
  svg += `<rect x="${mapX}" y="${mapY}" width="${mapW}" height="${mapH}" fill="none" stroke="#90a4ae" stroke-width="1.2" rx="2"/>`

  if (chkNorth.value) svg += buildNorthArrow(mapX + mapW - 28, mapY + 28, 28)
  if (chkScale.value) svg += buildScaleBar(scale.value, dpi.value, mapX + 20, mapY + mapH + 18, mapW * 0.4)
  if (chkLegend.value) {
    const items = parseLegendItems(legendItemsText.value)
    if (items.length) {
      const legW = 140
      const legH = 22 + items.length * 18 + 8
      svg += buildLegend(mapX + mapW - legW - 10, mapY + mapH - legH - 10, items, legW)
    }
  }

  svg += `<text x="${mapX + mapW}" y="${vh - 8}" font-size="10" fill="#8fa0b5" text-anchor="end">比例尺 1:${scale.value.toLocaleString('zh-CN')} · DPI ${dpi.value}</text>`
  svg += `<text x="${mapX}" y="${vh - 8}" font-size="10" fill="#8fa0b5">WGS84 · 中央经线 ${centralMeridian.value}°</text>`
  svg += '</svg>'

  svgOutput.value = svg
  msgText.value = `排版生成完成 · ${vw}×${vh}px · 1:${scale.value.toLocaleString('zh-CN')}`
  msgClass.value = 'ok'
}

async function copySvg() {
  if (!svgOutput.value) return
  try { await navigator.clipboard.writeText(svgOutput.value) } catch {
    const ta = document.createElement('textarea')
    ta.value = svgOutput.value; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); ta.remove()
  }
  copyLabel.value = '已复制 ✓'
  setTimeout(() => { copyLabel.value = '复制 SVG' }, 1200)
}

function downloadSvg() {
  if (!svgOutput.value) return
  const blob = new Blob([svgOutput.value], { type: 'image/svg+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'map-layout.svg'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

onMounted(() => generate())
</script>

<style scoped>
.svg-stage {
  flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
}
.svg-stage :deep(svg) { max-width: 100%; height: auto; }
.chk-box {
  display: inline-flex; align-items: center; gap: 0.3125rem; cursor: pointer; user-select: none;
  color: #a0a0a0; font-size: 0.8125rem; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.3125rem 0.625rem;
}
.chk-box input { accent-color: #667eea; cursor: pointer; }
</style>
