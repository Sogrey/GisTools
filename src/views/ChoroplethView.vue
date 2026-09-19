<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">专题图着色</h1>
      <span class="page-subtitle">GeoJSON Polygon 按属性分色 · 等间隔/分位数 · SVG 预览+图例</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 左侧：数据与参数 -->
        <div class="panel">
          <div class="panel-head"><span class="t">数据与参数</span></div>
          <div class="panel-body">
            <textarea class="form-textarea" v-model="inputText" spellcheck="false"
              placeholder="粘贴 GeoJSON FeatureCollection (Polygon/MultiPolygon)"></textarea>
            <div class="form-group" style="margin-top:0.5rem">
              <label class="form-label">属性字段</label>
              <select class="form-select" v-model="field" :disabled="!fields.length">
                <option value="">{{ fields.length ? '请选择' : '先粘贴数据' }}</option>
                <option v-for="f in fields" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">分级方式</label>
              <select class="form-select" v-model="method">
                <option value="equal">等间隔</option>
                <option value="quantile">分位数</option>
                <option value="custom">自定义区间</option>
              </select>
              <label class="form-label" style="margin-top:0.5rem">分级数</label>
              <input class="form-input" type="number" v-model.number="classes" min="2" max="20" style="width:70px" />
            </div>
            <div class="form-group">
              <label class="form-label">色带</label>
              <div class="action-row">
                <select class="form-select" v-model="paletteName" style="flex:1">
                  <option value="viridis">viridis（黄紫蓝绿）</option>
                  <option value="rdylgn">rdylgn（红黄绿）</option>
                  <option value="bluered">蓝红渐变</option>
                </select>
                <label class="chk-box"><input type="checkbox" v-model="rev" /> 反转</label>
              </div>
            </div>
            <div class="form-group" v-show="method === 'custom'">
              <label class="form-label">自定义区间（逗号分隔，升序）</label>
              <input class="form-input" type="text" v-model="customBreaks" placeholder="如：0,10,20,50,100" />
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="render">渲染专题图</button>
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            </div>
            <div class="msg" :class="msgClass" v-if="msgText">{{ msgText }}</div>
          </div>
        </div>

        <!-- 右侧：预览与图例 -->
        <div class="panel">
          <div class="panel-head"><span class="t">预览与图例</span></div>
          <div class="panel-body">
            <div class="svg-stage" v-html="svgOutput"></div>
            <div class="legend-box" v-if="legendItems.length">
              <div v-for="(item, i) in legendItems" :key="i" class="legend-item">
                <i :style="{ background: item.color }"></i>
                <span>{{ item.lo.toFixed(2) }} ~ {{ item.hi.toFixed(2) }}</span>
              </div>
            </div>
            <div class="result-card" v-if="statsText" style="margin-top:0.5rem">
              <span class="label">统计信息</span>
              <span class="value" style="white-space:pre-line;font-size:0.75rem">{{ statsText }}</span>
            </div>
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
            placeholder="点击「渲染专题图」后在此显示 SVG 代码"></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  classifyEqual, classifyQuantile, classifyCustom, colorize, buildSvg,
  extractFields, getClassIndex, rgbToHex,
} from '../utils/choropleth'

const router = useRouter()
const goBack = () => router.push('/')

const inputText = ref('')
const field = ref('')
const method = ref<'equal' | 'quantile' | 'custom'>('equal')
const classes = ref(5)
const paletteName = ref('viridis')
const rev = ref(false)
const customBreaks = ref('')

const fields = ref<string[]>([])
const svgOutput = ref('')
const legendItems = ref<{ color: string; lo: number; hi: number }[]>([])
const statsText = ref('')
const msgText = ref('')
const msgClass = ref('')
const copyLabel = ref('复制 SVG')

const SAMPLE = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'A区', pop: 120 }, geometry: { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } },
    { type: 'Feature', properties: { name: 'B区', pop: 350 }, geometry: { type: 'Polygon', coordinates: [[[2, 0], [4, 0], [4, 2], [2, 2], [2, 0]]] } },
    { type: 'Feature', properties: { name: 'C区', pop: 80 }, geometry: { type: 'Polygon', coordinates: [[[0, 2], [2, 2], [2, 4], [0, 4], [0, 2]]] } },
    { type: 'Feature', properties: { name: 'D区', pop: 500 }, geometry: { type: 'Polygon', coordinates: [[[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]] } },
    { type: 'Feature', properties: { name: 'E区', pop: 210 }, geometry: { type: 'Polygon', coordinates: [[[0, 4], [4, 4], [4, 6], [0, 6], [0, 4]]] } },
  ],
}

watch(inputText, () => {
  try {
    const fc = JSON.parse(inputText.value)
    fields.value = extractFields(fc)
    msgText.value = ''
  } catch { /* 静默 */ }
})

function loadSample() {
  inputText.value = JSON.stringify(SAMPLE, null, 2)
  try {
    const fc = JSON.parse(inputText.value)
    fields.value = extractFields(fc)
    field.value = 'pop'
    msgText.value = '已载入示例数据，5 个区域，属性 pop'
    msgClass.value = 'ok'
  } catch (e: any) {
    msgText.value = '示例数据错误：' + e.message
    msgClass.value = 'err'
  }
}

function render() {
  msgText.value = ''
  let fc: any
  try {
    fc = JSON.parse(inputText.value)
  } catch (e: any) {
    msgText.value = '解析失败：' + e.message; msgClass.value = 'err'; return
  }
  if (!field.value) { msgText.value = '请选择属性字段'; msgClass.value = 'err'; return }

  const values: number[] = []
  for (let i = 0; i < fc.features.length; i++) {
    const v = fc.features[i].properties ? fc.features[i].properties[field.value] : null
    if (typeof v === 'number' && isFinite(v)) values.push(v)
  }
  if (!values.length) { msgText.value = '该字段无数值数据'; msgClass.value = 'err'; return }

  let breaks: number[]
  if (method.value === 'equal') breaks = classifyEqual(values, classes.value)
  else if (method.value === 'quantile') breaks = classifyQuantile(values, classes.value)
  else {
    const b = classifyCustom(customBreaks.value)
    if (!b) { msgText.value = '自定义区间格式错误，需至少 2 个升序数值'; msgClass.value = 'err'; return }
    breaks = b
  }

  const colors = colorize(breaks, paletteName.value, rev.value)
  try {
    svgOutput.value = buildSvg(fc, field.value, breaks, colors, { width: 500, height: 400, padding: 16 })
  } catch (e: any) {
    msgText.value = '渲染失败：' + e.message; msgClass.value = 'err'; return
  }

  legendItems.value = colors.map((c, i) => ({ color: rgbToHex(c), lo: breaks[i]!, hi: breaks[i + 1]! }))

  const min = Math.min(...values), max = Math.max(...values)
  statsText.value =
    `要素数：${fc.features.length} · 数值字段：${field.value}\n` +
    `最小值：${min.toFixed(2)} · 最大值：${max.toFixed(2)}\n` +
    `分级方式：${method.value === 'equal' ? '等间隔' : method.value === 'quantile' ? '分位数' : '自定义'} · 类别数：${colors.length}\n` +
    `断点：${breaks.map((b) => b.toFixed(2)).join(' → ')}`

  msgText.value = '渲染完成，共 ' + colors.length + ' 类'
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
  a.href = URL.createObjectURL(blob); a.download = 'choropleth.svg'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
</script>

<style scoped>
.svg-stage {
  flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
}
.svg-stage :deep(svg) { max-width: 100%; height: auto; }
.legend-box { margin-top: 0.625rem; }
.legend-item { display: flex; align-items: center; gap: 0.375rem; margin-bottom: 3px; font-size: 0.75rem; color: #a0a0a0; }
.legend-item i { width: 16px; height: 16px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); flex: none; }
.chk-box {
  display: inline-flex; align-items: center; gap: 0.3125rem; cursor: pointer; user-select: none;
  color: #a0a0a0; font-size: 0.8125rem; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.3125rem 0.625rem;
}
.chk-box input { accent-color: #667eea; cursor: pointer; }
</style>
