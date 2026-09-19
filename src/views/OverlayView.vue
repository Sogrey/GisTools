<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">多边形叠加分析</h1>
      <span class="page-subtitle">相交 ∩ · 并集 ∪ · 差集 − · 对称差 ⊕</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">输入几何</span><div class="spacer"></div></div>
          <div class="panel-body">
            <div class="action-row">
              <strong>多边形 A</strong>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="sampleA">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="inA = ''">清空</button>
            </div>
            <textarea class="form-textarea" v-model="inA" placeholder='粘贴 GeoJSON：Polygon / MultiPolygon / Feature / FeatureCollection' style="min-height: 100px;"></textarea>
            <div class="action-row">
              <strong>多边形 B</strong>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="sampleB">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="inB = ''">清空</button>
            </div>
            <textarea class="form-textarea" v-model="inB" placeholder='粘贴 GeoJSON：Polygon / MultiPolygon / Feature / FeatureCollection' style="min-height: 100px;"></textarea>
            <div class="action-row" style="background: rgba(102,126,234,0.08); border: 1px solid rgba(102,126,234,0.15); border-radius: 9px; padding: 9px;">
              <span class="form-label" style="margin: 0; font-weight: 600;">叠加操作</span>
              <button class="btn btn-primary btn-small" @click="runOp('intersect')">相交 ∩</button>
              <button class="btn btn-primary btn-small" @click="runOp('union')">并集 ∪</button>
              <button class="btn btn-primary btn-small" @click="runOp('difference')">差集 A−B</button>
              <button class="btn btn-primary btn-small" @click="runOp('xor')">对称差 ⊕</button>
            </div>
            <div class="msg" :class="{ ok: inMsgType === 'ok', err: inMsgType === 'err' }">{{ inMsg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">叠加结果</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyResult">复制</button>
          </div>
          <div class="panel-body">
            <div class="result-grid" v-if="stats">
              <div class="result-card"><span class="label">运算类型</span><span class="value">{{ stats.opLabel }}</span></div>
              <div class="result-card"><span class="label">结果面积</span><span class="value">{{ stats.areaR }}</span></div>
              <div class="result-card"><span class="label">A 面积</span><span class="value">{{ stats.areaA }}</span></div>
              <div class="result-card"><span class="label">B 面积</span><span class="value">{{ stats.areaB }}</span></div>
            </div>
            <textarea class="form-textarea" v-model="output" readonly placeholder="点击操作按钮，结果 GeoJSON 将显示在这里"></textarea>
            <div class="msg" :class="{ ok: outMsgType === 'ok', err: outMsgType === 'err' }">{{ outMsg }}</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">Sutherland-Hodgman 裁剪（凸多边形精确，凹多边形近似）· 球面环形面积公式（WGS84）· 纯本地计算</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { overlay, parseGeometry, polygonArea, fmtArea, type OverlayOp, type GeoGeom } from '../utils/overlay'

const router = useRouter()
const goBack = () => router.push('/')

const inA = ref('')
const inB = ref('')
const output = ref('')
const inMsg = ref('')
const inMsgType = ref('')
const outMsg = ref('')
const outMsgType = ref('')
const stats = ref<{ opLabel: string; areaR: string; areaA: string; areaB: string } | null>(null)

const OP_LABELS: Record<OverlayOp, string> = {
  intersect: '相交 A ∩ B',
  union: '并集 A ∪ B',
  difference: '差集 A − B',
  xor: '对称差 A ⊕ B',
}

const SAMPLE_A = JSON.stringify({
  type: 'Polygon',
  coordinates: [[[116.38, 39.9], [116.43, 39.9], [116.43, 39.94], [116.38, 39.94], [116.38, 39.9]]],
}, null, 2)
const SAMPLE_B = JSON.stringify({
  type: 'Polygon',
  coordinates: [[[116.44165, 39.9325], [116.4075, 39.94165], [116.39835, 39.9075], [116.4325, 39.89835], [116.44165, 39.9325]]],
}, null, 2)

function runOp(op: OverlayOp) {
  inMsg.value = ''
  inMsgType.value = ''
  outMsg.value = ''
  outMsgType.value = ''
  let gA: GeoGeom, gB: GeoGeom
  try { gA = parseGeometry(inA.value) } catch (e) { inMsg.value = '输入 A：' + (e as Error).message; inMsgType.value = 'err'; return }
  try { gB = parseGeometry(inB.value) } catch (e) { inMsg.value = '输入 B：' + (e as Error).message; inMsgType.value = 'err'; return }
  let result: GeoGeom | null
  try { result = overlay(op, gA, gB) } catch (e) { outMsg.value = '计算失败：' + (e as Error).message; outMsgType.value = 'err'; return }
  const aA = polygonArea(gA), aB = polygonArea(gB)
  const aR = result ? polygonArea(result) : 0
  const blocks = result ? (result.type === 'Polygon' ? 1 : (result.coordinates as unknown[]).length) : 0
  output.value = result ? JSON.stringify(result, null, 2) : 'null'
  stats.value = { opLabel: OP_LABELS[op], areaR: fmtArea(aR), areaA: fmtArea(aA), areaB: fmtArea(aB) }
  if (!result) {
    outMsg.value = '结果为空'
    outMsgType.value = 'ok'
  } else {
    outMsg.value = '完成：结果为 ' + result.type + '（' + blocks + ' 块），面积 ' + fmtArea(aR)
    outMsgType.value = 'ok'
  }
}

function copyResult() {
  if (!output.value) { outMsg.value = '无内容可复制'; outMsgType.value = 'err'; return }
  navigator.clipboard?.writeText(output.value).then(() => { outMsg.value = '已复制到剪贴板'; outMsgType.value = 'ok' })
}

function sampleA() { inA.value = SAMPLE_A; inMsg.value = ''; inMsgType.value = '' }
function sampleB() { inB.value = SAMPLE_B; inMsg.value = ''; inMsgType.value = '' }
</script>
