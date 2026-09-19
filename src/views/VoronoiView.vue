<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">Voronoi / Delaunay 三角网</h1>
      <span class="page-subtitle">Bowyer-Watson 三角剖分 · 外心对偶图 Voronoi</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head">
            <span class="t">输入点集</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin: 0;">模式</label>
              <select class="form-select" v-model="mode" style="width: auto;">
                <option value="both">Delaunay + Voronoi</option>
                <option value="delaunay">Delaunay 三角网</option>
                <option value="voronoi">Voronoi 图</option>
              </select>
              <button class="btn btn-primary" @click="run">生成</button>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder='粘贴 GeoJSON Point / MultiPoint 或 CSV 经度,纬度'></textarea>
            <div class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">结果输出</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="result">
              <div class="result-card"><span class="label">点数</span><span class="value">{{ result.pointCount }}</span><span class="sub">输入点</span></div>
              <div class="result-card"><span class="label">三角面数</span><span class="value">{{ result.triangleCount }}</span><span class="sub">Delaunay 面</span></div>
              <div class="result-card"><span class="label">Voronoi 单元</span><span class="value">{{ result.cellCount }}</span><span class="sub">闭合多边形</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="生成的 GeoJSON 将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copyResult">复制结果</button>
              <span class="msg" :class="{ ok: actMsgType === 'ok' }">{{ actMsg }}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">Bowyer-Watson：超级三角形 + 逐点插入 + 空腔重剖 · Voronoi 单元由 Delaunay 邻接点中垂面半平面交裁</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parsePoints, delaunay, voronoiCells, buildGeoJSON, type VoronoiMode } from '../utils/voronoi'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const mode = ref<VoronoiMode>('both')
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const actMsg = ref('')
const actMsgType = ref('')
const result = ref<{ pointCount: number; triangleCount: number; cellCount: number } | null>(null)

const SAMPLE = JSON.stringify({
  type: 'MultiPoint',
  coordinates: [
    [116.3, 39.95], [116.45, 39.88], [116.38, 40.02], [116.52, 39.96],
    [116.25, 39.85], [116.6, 40.05], [116.42, 39.78], [116.35, 40.1],
    [116.48, 40.12], [116.55, 39.82],
  ],
}, null, 2)

function run() {
  const text = input.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  actMsg.value = ''
  result.value = null
  if (!text) { inMsg.value = '请输入点集'; inMsgType.value = 'err'; return }
  let points: [number, number][]
  try { points = parsePoints(text) } catch (e) { inMsg.value = '解析失败: ' + (e as Error).message; inMsgType.value = 'err'; return }
  if (points.length < 3) { inMsg.value = '至少需要 3 个点（当前 ' + points.length + '）'; inMsgType.value = 'err'; return }
  const t0 = Date.now()
  let triangles: number[][], cells: [number, number][][]
  try {
    triangles = delaunay(points)
    cells = voronoiCells(points, triangles)
  } catch (e) { inMsg.value = '生成失败: ' + (e as Error).message; inMsgType.value = 'err'; return }
  const res = buildGeoJSON(mode.value, points, triangles, cells)
  output.value = JSON.stringify(res.geo, null, 2)
  result.value = { pointCount: res.pointCount, triangleCount: res.triangleCount, cellCount: res.cellCount }
  const modeNames: Record<string, string> = { delaunay: 'Delaunay 三角网', voronoi: 'Voronoi 图', both: 'Delaunay + Voronoi' }
  inMsg.value = modeNames[mode.value] + ' 生成完成：' + res.pointCount + ' 点 / ' + res.triangleCount + ' 三角面 / ' + res.cellCount + ' 单元'
  inMsgType.value = 'ok'
  outMsg.value = '耗时 ' + (Date.now() - t0) + ' ms'
  outMsgType.value = 'ok'
}

function copyResult() {
  if (!output.value) { actMsg.value = '请先生成结果'; return }
  navigator.clipboard?.writeText(output.value).then(() => { actMsg.value = '已复制到剪贴板'; actMsgType.value = 'ok' })
}

function loadSample() { input.value = SAMPLE; mode.value = 'both'; run() }
function clearAll() {
  input.value = ''
  output.value = ''
  result.value = null
  inMsg.value = ''
  outMsg.value = ''
  actMsg.value = ''
}
</script>
