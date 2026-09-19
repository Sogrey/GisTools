<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">最近邻搜索器</h1>
      <span class="page-subtitle">KNN · Haversine 距离 + 方位角 · Mutual NN</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">输入点集</span><div class="spacer"></div></div>
          <div class="panel-body">
            <div class="action-row">
              <strong style="color: #667eea;">目标点</strong>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="sampleTarget">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="targetInput = ''">清空</button>
            </div>
            <textarea class="form-textarea" v-model="targetInput" placeholder="目标点 GeoJSON（FeatureCollection of Points）" style="min-height: 80px;"></textarea>
            <div class="action-row">
              <strong style="color: #667eea;">搜索点</strong>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="sampleSearch">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="searchInput = ''">清空</button>
            </div>
            <textarea class="form-textarea" v-model="searchInput" placeholder="搜索点 GeoJSON（FeatureCollection of Points）" style="min-height: 80px;"></textarea>
            <div class="action-row">
              <label class="form-label" style="margin: 0;">K 值</label>
              <input class="form-input" type="number" v-model.number="kValue" min="1" max="100" style="width: 90px;" />
              <label class="form-label" style="margin: 0;">模式</label>
              <select class="form-select" v-model="mode" style="width: auto;">
                <option value="oneway">单向（目标→搜索）</option>
                <option value="mutual">双向 Mutual NN</option>
              </select>
            </div>
            <div class="action-row">
              <button class="btn btn-primary" @click="run">执行搜索</button>
              <span class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">搜索结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="{ ok: outMsgType === 'ok' }">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="stats">
              <div class="result-card"><span class="label">目标点</span><span class="value">{{ stats.targetCount }} 个</span></div>
              <div class="result-card"><span class="label">搜索点</span><span class="value">{{ stats.searchCount }} 个</span></div>
              <div class="result-card"><span class="label">平均距离</span><span class="value">{{ stats.avgDist.toFixed(3) }} km</span></div>
              <div class="result-card" v-if="mode === 'mutual'"><span class="label">互为最近</span><span class="value">{{ stats.mutualCount }} 对</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="结果 GeoJSON 将显示在这里"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="copyResult">复制 GeoJSON</button>
              <span class="msg" :class="{ ok: actMsgType === 'ok' }">{{ actMsg }}</span>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">Haversine 球面距离（R=6371 km）· 方位角正北 0° 顺时针 · KNN 暴力搜索 O(n×m)</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parsePoints, knn, runMutualKnn, type KnnAllResult } from '../utils/nearest-neighbor'

const router = useRouter()
const goBack = () => router.push('/')

const targetInput = ref('')
const searchInput = ref('')
const kValue = ref(1)
const mode = ref<'oneway' | 'mutual'>('oneway')
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const actMsg = ref('')
const actMsgType = ref('')
const stats = ref<{ targetCount: number; searchCount: number; avgDist: number; mutualCount: number } | null>(null)

const sampleTargets = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '站点A' }, geometry: { type: 'Point', coordinates: [116.391, 39.907] } },
    { type: 'Feature', properties: { name: '站点B' }, geometry: { type: 'Point', coordinates: [116.414, 39.912] } },
    { type: 'Feature', properties: { name: '站点C' }, geometry: { type: 'Point', coordinates: [116.391, 39.926] } },
  ],
}, null, 2)
const sampleSearches = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '医院1' }, geometry: { type: 'Point', coordinates: [116.401, 39.910] } },
    { type: 'Feature', properties: { name: '医院2' }, geometry: { type: 'Point', coordinates: [116.420, 39.920] } },
    { type: 'Feature', properties: { name: '医院3' }, geometry: { type: 'Point', coordinates: [116.380, 39.900] } },
  ],
}, null, 2)

function run() {
  const tText = targetInput.value.trim()
  const sText = searchInput.value.trim()
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  actMsg.value = ''
  stats.value = null
  if (!tText || !sText) { inMsg.value = '请输入目标点和搜索点'; inMsgType.value = 'err'; return }
  if (!(kValue.value >= 1)) { inMsg.value = 'K 值需 ≥ 1'; inMsgType.value = 'err'; return }
  const isMutual = mode.value === 'mutual'
  try {
    const t0 = Date.now()
    const targets = parsePoints(tText)
    const searches = parsePoints(sText)
    let kk = kValue.value
    if (kk > searches.length) kk = searches.length
    let fwd: KnnAllResult[]
    if (isMutual) fwd = runMutualKnn(targets, searches, kk)
    else fwd = knn(targets, searches, kk)

    const outFeatures = fwd.map((r) => {
      const nearest = r.knn[0] || null
      const props: Record<string, unknown> = { ...(r.target.props || {}) }
      if (nearest) {
        props.nearest = {
          coord: nearest.coord,
          distance_km: nearest.distance_km,
          bearing_deg: nearest.bearing_deg,
          mutual: !!nearest.mutual,
          props: nearest.props,
        }
      } else props.nearest = null
      props.knn = r.knn.map((n) => ({
        coord: n.coord,
        distance_km: n.distance_km,
        bearing_deg: n.bearing_deg,
        mutual: !!n.mutual,
        props: n.props,
      }))
      return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: r.target.coord } }
    })
    const fc = { type: 'FeatureCollection', features: outFeatures }
    output.value = JSON.stringify(fc, null, 2)

    const mutualCount = fwd.filter((r) => r.knn[0] && r.knn[0].mutual).length
    const dists = fwd.map((r) => (r.knn[0] ? r.knn[0].distance_km : 0))
    const avgDist = dists.reduce((a, b) => a + b, 0) / (dists.length || 1)

    stats.value = { targetCount: targets.length, searchCount: searches.length, avgDist, mutualCount }
    inMsg.value = '搜索完成：' + fwd.length + ' 个配对' + (isMutual ? '（mutual ' + mutualCount + ' 对）' : '')
    inMsgType.value = 'ok'
    outMsg.value = '耗时 ' + (Date.now() - t0) + ' ms'
    outMsgType.value = 'ok'
  } catch (e) {
    inMsg.value = '搜索失败：' + (e as Error).message
    inMsgType.value = 'err'
  }
}

function copyResult() {
  if (!output.value) { actMsg.value = '请先执行搜索'; return }
  navigator.clipboard?.writeText(output.value).then(() => { actMsg.value = '已复制到剪贴板'; actMsgType.value = 'ok' })
}

function sampleTarget() { targetInput.value = sampleTargets }
function sampleSearch() { searchInput.value = sampleSearches }
</script>
