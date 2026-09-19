<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">DEM 高程数据处理</h1>
      <span class="page-subtitle">高程统计 · 等值线插值 · 规则格网聚合</span>
    </div>
    <div class="tool-main">
      <section class="panel" style="margin-bottom:1rem">
        <div class="panel-head"><span class="t">高程点数据输入</span><div class="spacer"></div><span class="form-hint">每行 lng lat elev 或 x y z</span></div>
        <div class="panel-body">
          <textarea class="form-textarea" v-model="input" placeholder="粘贴高程点数据，每行三个数值"></textarea>
          <div class="action-row" style="margin-top:0.5rem">
            <button class="btn btn-primary btn-small" @click="doAnalyze">分析数据</button>
            <button class="btn btn-secondary btn-small" @click="loadExample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            <span class="msg" :class="{ ok: msgOk, err: msgErr }" style="margin-left:auto">{{ msg }}</span>
          </div>
        </div>
      </section>
      <template v-if="dem">
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head"><span class="t">高程统计</span></div>
          <div class="panel-body">
            <div class="result-grid">
              <div class="result-card"><span class="label">点数</span><span class="value">{{ dem.stats.n }}</span></div>
              <div class="result-card"><span class="label">最低高程</span><span class="value">{{ fmt(dem.stats.min, 3) }} m</span></div>
              <div class="result-card"><span class="label">最高高程</span><span class="value">{{ fmt(dem.stats.max, 3) }} m</span></div>
              <div class="result-card"><span class="label">高差</span><span class="value">{{ fmt(dem.stats.range, 3) }} m</span></div>
              <div class="result-card"><span class="label">平均高程</span><span class="value">{{ fmt(dem.stats.mean, 3) }} m</span></div>
              <div class="result-card"><span class="label">中位数</span><span class="value">{{ fmt(dem.stats.median, 3) }} m</span></div>
              <div class="result-card"><span class="label">标准差</span><span class="value">{{ fmt(dem.stats.sd, 3) }} m</span></div>
            </div>
            <div class="form-group" style="margin-top:0.5rem">
              <label class="form-label">直方图（{{ dem.hist.length }} 个区间）</label>
              <div style="display:flex;align-items:flex-end;gap:3px;height:120px;padding-top:4px;border-bottom:1px solid rgba(255,255,255,0.1)">
                <div v-for="(b, i) in dem.hist" :key="i" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%">
                  <span style="font-size:9px;color:#667eea">{{ b.count }}</span>
                  <div :style="{ width: '70%', height: histHeight(b.count) + '%', background: 'linear-gradient(180deg,#4a90f0,#667eea)', borderRadius: '3px 3px 0 0', minHeight: '2px' }" :title="fmt(b.lo, 2) + '~' + fmt(b.hi, 2) + 'm: ' + b.count + '点'"></div>
                  <span style="font-size:8px;color:#606060;transform:rotate(-42deg);white-space:nowrap;margin-top:2px">{{ fmt((b.lo + b.hi) / 2, 1) }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head"><span class="t">等值线插值</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0;min-width:auto">目标高程</label>
              <input class="form-input" type="number" v-model.number="zTarget" step="any" style="width:100px" />
              <button class="btn btn-primary btn-small" @click="contourSingle">单级</button>
              <label class="form-label" style="margin:0;min-width:auto">等值距</label>
              <input class="form-input" type="number" v-model.number="zInterval" step="any" style="width:80px" />
              <button class="btn btn-primary btn-small" @click="contourInterval">按等值距</button>
            </div>
            <div class="msg ok" v-if="contourInfo">{{ contourInfo }}</div>
            <div v-for="(L, i) in contourLevels" :key="i" style="margin-bottom:0.5rem">
              <div class="action-row"><span class="tag">等值线 {{ fmt(L.z, 3) }} m</span><span class="form-hint" style="margin:0">{{ L.hits.length }} 个交点</span></div>
              <table class="data-table" v-if="L.hits.length">
                <thead><tr><th>#</th><th>段号</th><th>X</th><th>Y</th><th>Z</th><th>t</th></tr></thead>
                <tbody>
                  <tr v-for="(h, j) in L.hits.slice(0, 100)" :key="j"><td>{{ j + 1 }}</td><td>P{{ h.seg }}</td><td>{{ fmt(h.x, 6) }}</td><td>{{ fmt(h.y, 6) }}</td><td>{{ fmt(L.z, 3) }}</td><td>{{ fmt(h.t, 4) }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">规则格网聚合</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0;min-width:auto">格网间距</label>
              <input class="form-input" type="number" v-model.number="gridD" step="any" style="width:80px" />
              <label class="form-label" style="margin:0;min-width:auto">原点</label>
              <select class="form-select" v-model="gridAlign" style="width:auto">
                <option value="min">数据最小角</option>
                <option value="snap">坐标原点</option>
              </select>
              <button class="btn btn-primary btn-small" @click="doGrid">网格化</button>
            </div>
            <div class="form-hint" v-if="gridResult">{{ gridResult.colsN }} × {{ gridResult.rowsN }} · 有值格 {{ gridResult.filled }}/{{ gridResult.total }}</div>
            <textarea class="form-textarea" v-model="gridText" readonly style="min-height:120px" v-if="gridText"></textarea>
          </div>
        </section>
      </template>
      <div class="tool-footer">纯本地运行 · 数据不出本机</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseXYZ, calcStats, calcHist, contourAt, levelsFor, gridify, buildExample, fmt, type DemPoint, type DemStats, type HistBin, type ContourHit, type GridifyResult } from '../utils/dem-tools'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const msg = ref('')
const msgOk = ref(false)
const msgErr = ref(false)

const dem = ref<{ pts: DemPoint[]; stats: DemStats; hist: HistBin[] } | null>(null)

const zTarget = ref(350)
const zInterval = ref(50)
const contourLevels = ref<{ z: number; hits: ContourHit[] }[]>([])
const contourInfo = ref('')

const gridD = ref(0.05)
const gridAlign = ref('min')
const gridResult = ref<GridifyResult | null>(null)
const gridText = ref('')

function histHeight(count: number): number {
  if (!dem.value) return 0
  const maxC = Math.max(...dem.value.hist.map(b => b.count))
  return maxC ? Math.max(2, Math.round(count / maxC * 100)) : 2
}

function doAnalyze() {
  const { pts, skipped } = parseXYZ(input.value)
  if (pts.length < 2) { msg.value = '至少需要 2 个有效高程点'; msgErr.value = true; msgOk.value = false; return }
  const stats = calcStats(pts)
  const bins = Math.max(8, Math.min(24, Math.round(Math.sqrt(pts.length))))
  const hist = calcHist(pts, stats.min, stats.max, bins)
  dem.value = { pts, stats, hist }
  msg.value = `解析成功：${pts.length} 个点${skipped ? '，跳过 ' + skipped + ' 行' : ''}`
  msgOk.value = true; msgErr.value = false
}

function loadExample() {
  input.value = buildExample()
  doAnalyze()
}

function clearAll() {
  input.value = ''; dem.value = null; msg.value = ''
  contourLevels.value = []; contourInfo.value = ''
  gridResult.value = null; gridText.value = ''
}

function contourSingle() {
  if (!dem.value) return
  const hits = contourAt(dem.value.pts, zTarget.value, false)
  contourLevels.value = [{ z: zTarget.value, hits }]
  contourInfo.value = `单级等值线（${fmt(zTarget.value, 3)} m）：${hits.length} 个交点`
}

function contourInterval() {
  if (!dem.value) return
  const zs = levelsFor(dem.value.pts, zInterval.value)
  contourLevels.value = zs.map(z => ({ z, hits: contourAt(dem.value!.pts, z, false) }))
  contourInfo.value = `多级等值线（等值距 ${fmt(zInterval.value, 3)} m，共 ${zs.length} 级）`
}

function doGrid() {
  if (!dem.value) return
  const g = gridify(dem.value.pts, gridD.value, gridAlign.value === 'snap')
  gridResult.value = g
  gridText.value = g.text
}
</script>
