<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">线等距重采样器</h1>
      <span class="page-subtitle">等距加密 · 抽稀简化 · 按数量重采样 + Douglas-Peucker</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head">
            <span class="t">输入线几何</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin: 0;">模式</label>
              <select class="form-select" v-model="mode" style="width: auto;" @change="updateParamUI">
                <option value="densify">等距加密</option>
                <option value="simplify">抽稀简化</option>
                <option value="count">按数量重采样</option>
              </select>
              <select v-show="mode === 'simplify'" class="form-select" v-model="subMode" style="width: auto;" @change="updateParamUI">
                <option value="interval">按间距保留</option>
                <option value="dp">Douglas-Peucker</option>
              </select>
            </div>
            <div class="action-row">
              <label class="form-label" style="margin: 0;">{{ paramLabel }}</label>
              <input class="form-input" type="number" v-model.number="param" :min="paramMin" step="1" style="width: 100px;" />
              <button class="btn btn-primary" @click="run">执行</button>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder='粘贴 GeoJSON LineString 或 MultiLineString'></textarea>
            <div class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">重采样结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="stats">
              <div class="result-card"><span class="label">原始点数</span><span class="value">{{ stats.origPts }}</span></div>
              <div class="result-card"><span class="label">输出点数</span><span class="value">{{ stats.outPts }}</span></div>
              <div class="result-card"><span class="label">总长度</span><span class="value">{{ (stats.totalLen / 1000).toFixed(3) }} km</span></div>
              <div class="result-card"><span class="label">平均间距</span><span class="value">{{ stats.avgSpacing.toFixed(1) }} m</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="重采样后的 GeoJSON 将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copyResult">复制结果</button>
              <span class="msg" :class="{ ok: actMsgType === 'ok' }">{{ actMsg }}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">Haversine 球面距离（R=6371008.8m）· 等距加密保留原始顶点 · 抽稀按累积距离或 DP · 按数量等弧长分布</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseLines, totalLength, densify, simplifyByInterval, dpSimplify, resampleByCount, type ResampleMode, type SimplifySubMode } from '../utils/line-resample'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const mode = ref<ResampleMode>('densify')
const subMode = ref<SimplifySubMode>('interval')
const param = ref(1000)
const paramLabel = ref('间距 (米)')
const paramMin = ref(1)
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const actMsg = ref('')
const actMsgType = ref('')
const stats = ref<{ origPts: number; outPts: number; totalLen: number; avgSpacing: number } | null>(null)

const SAMPLE = JSON.stringify({
  type: 'LineString',
  coordinates: [
    [116.4, 39.9], [117.2, 39.13], [117.0, 36.65], [117.18, 34.26], [118.78, 32.06], [121.47, 31.23],
  ],
}, null, 2)

function updateParamUI() {
  if (mode.value === 'densify') {
    paramLabel.value = '间距 (米)'
    paramMin.value = 1
  } else if (mode.value === 'simplify') {
    if (subMode.value === 'interval') {
      paramLabel.value = '间距 (米)'
      paramMin.value = 1
    } else {
      paramLabel.value = 'DP 容差 (米)'
      paramMin.value = 0
    }
  } else {
    paramLabel.value = '输出点数'
    paramMin.value = 2
  }
}

function run() {
  const text = input.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  actMsg.value = ''
  stats.value = null
  if (!text) { inMsg.value = '请输入 GeoJSON'; inMsgType.value = 'err'; return }

  let lines: [number, number][][]
  try { lines = parseLines(text) } catch (e) { inMsg.value = 'JSON 解析失败: ' + (e as Error).message; inMsgType.value = 'err'; return }
  if (!lines.length) { inMsg.value = '未识别到 LineString / MultiLineString'; inMsgType.value = 'err'; return }

  let p = param.value
  if (mode.value === 'count') {
    p = Math.max(2, Math.floor(p))
    if (p > 100000) { inMsg.value = '输出点数过多（上限 100000）'; inMsgType.value = 'err'; return }
  } else {
    if (!(p > 0)) { inMsg.value = '参数需 > 0'; inMsgType.value = 'err'; return }
  }

  const t0 = Date.now()
  const outLines: [number, number][][] = []
  let totalOrigPts = 0, totalOutPts = 0, totalLen = 0

  try {
    lines.forEach((line) => {
      totalOrigPts += line.length
      totalLen += totalLength(line)
      let result: [number, number][]
      if (mode.value === 'densify') result = densify(line, p)
      else if (mode.value === 'simplify') {
        if (subMode.value === 'interval') result = simplifyByInterval(line, p)
        else result = dpSimplify(line, p)
      } else result = resampleByCount(line, p)
      result = result.map((pt) => [Math.round(pt[0] * 1e7) / 1e7, Math.round(pt[1] * 1e7) / 1e7])
      outLines.push(result)
      totalOutPts += result.length
    })
  } catch (e) {
    inMsg.value = '处理失败: ' + (e as Error).message
    inMsgType.value = 'err'
    return
  }

  const outGeo = outLines.length === 1
    ? { type: 'LineString', coordinates: outLines[0] }
    : { type: 'MultiLineString', coordinates: outLines }
  output.value = JSON.stringify(outGeo, null, 2)

  const avgSpacing = totalOutPts > 1 ? totalLen / (totalOutPts - 1) : 0
  stats.value = { origPts: totalOrigPts, outPts: totalOutPts, totalLen, avgSpacing }

  const modeNames: Record<string, string> = { densify: '等距加密', simplify: '抽稀简化', count: '按数量重采样' }
  inMsg.value = modeNames[mode.value] + '完成：' + totalOrigPts + ' → ' + totalOutPts + ' 点'
  inMsgType.value = 'ok'
  outMsg.value = '耗时 ' + (Date.now() - t0) + ' ms'
  outMsgType.value = 'ok'
}

function copyResult() {
  if (!output.value) { actMsg.value = '请先执行重采样'; return }
  navigator.clipboard?.writeText(output.value).then(() => { actMsg.value = '已复制到剪贴板'; actMsgType.value = 'ok' })
}

function loadSample() {
  input.value = SAMPLE
  mode.value = 'densify'
  param.value = 50000
  updateParamUI()
  run()
}

function clearAll() {
  input.value = ''
  output.value = ''
  stats.value = null
  inMsg.value = ''
  outMsg.value = ''
  actMsg.value = ''
}
</script>
