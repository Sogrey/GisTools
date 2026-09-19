<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">建筑高度/体积估算器</h1>
      <span class="page-subtitle">底面 GeoJSON × 层数层高 → 底面积 / 体积 / 表面积（球面算法）</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">参数输入</span></div>
          <div class="panel-body">
            <div class="form-group">
              <label class="form-label">建筑底面 GeoJSON</label>
              <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON（Polygon / Feature / FeatureCollection）"></textarea>
            </div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例底面</button>
            </div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0;min-width:60px">层数</label>
              <input class="form-input" type="number" v-model.number="floors" min="1" step="1" style="width:100px" />
              <label class="form-label" style="margin:0;min-width:60px">层高</label>
              <input class="form-input" type="number" v-model.number="floorHeight" min="0.5" step="0.1" style="width:100px" />
              <span class="form-hint" style="margin:0">m</span>
            </div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0;min-width:60px">屋顶</label>
              <select class="form-select" v-model="roof" style="width:auto">
                <option value="flat">平屋顶</option>
                <option value="cone">锥屋顶</option>
              </select>
              <template v-if="roof === 'cone'">
                <label class="form-label" style="margin:0;min-width:60px">屋顶高度</label>
                <input class="form-input" type="number" v-model.number="roofHeight" min="0" step="0.1" style="width:80px" />
                <span class="form-hint" style="margin:0">m</span>
              </template>
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="doCalc">计算</button>
              <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            </div>
            <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err' }" v-if="msg">{{ msg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">估算结果</span></div>
          <div class="panel-body" v-if="calcResult">
            <div class="result-grid" style="margin-bottom:1rem">
              <div class="result-card"><span class="label">底面积</span><span class="value">{{ fmt(calcResult.baseArea) }}</span><span class="sub">m²</span></div>
              <div class="result-card"><span class="label">建筑高度</span><span class="value">{{ fmt(calcResult.height, 1) }}</span><span class="sub">m</span></div>
              <div class="result-card"><span class="label">体积</span><span class="value">{{ fmt(calcResult.volume) }}</span><span class="sub">m³</span></div>
              <div class="result-card"><span class="label">表面积</span><span class="value">{{ fmt(calcResult.surf.totalArea) }}</span><span class="sub">m²</span></div>
            </div>
            <table class="data-table">
              <thead><tr><th>项目</th><th>数值</th><th>说明</th></tr></thead>
              <tbody>
                <tr><td>外环面积</td><td>{{ fmt(calcResult.surf.outerArea) }} m²</td><td>球面超额公式</td></tr>
                <tr v-if="calcResult.surf.holesArea > 0"><td>洞（内环）扣除</td><td>-{{ fmt(calcResult.surf.holesArea) }} m²</td><td>{{ calcResult.ringCount - 1 }} 个洞</td></tr>
                <tr><td>底面周长</td><td>{{ fmt(calcResult.surf.perimeter) }} m</td><td>球面测地距离</td></tr>
                <tr><td>主体体积</td><td>{{ fmt(calcResult.baseArea * calcResult.height) }} m³</td><td>底面积 × {{ fmt(calcResult.height, 1) }}m</td></tr>
                <tr v-if="calcResult.roofVolume > 0"><td>锥屋顶附加体积</td><td>+{{ fmt(calcResult.roofVolume) }} m³</td><td>底面积 × {{ fmt(roofHeight, 1) }}m ÷ 3</td></tr>
                <tr><td>外墙面面积</td><td>{{ fmt(calcResult.surf.wallArea) }} m²</td><td>周长 × 建筑高度</td></tr>
                <tr><td>屋顶面积</td><td>{{ fmt(calcResult.surf.roofArea) }} m²</td><td>{{ roof === 'cone' && roofHeight > 0 ? '圆锥侧面积' : '平屋顶=底面积' }}</td></tr>
              </tbody>
            </table>
            <div class="form-hint" v-if="calcResult.note" style="margin-top:0.5rem">{{ calcResult.note }}</div>
          </div>
          <div class="panel-body" v-else>
            <div class="form-hint" style="text-align:center;padding:3rem 0">输入建筑底面 GeoJSON 与层数层高<br>点击「计算」查看结果</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">建筑高度/体积估算器 · 纯本地计算 · 结果仅供参考</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { extractRings, polygonArea, buildingVolume, calcSurface, SAMPLE_BUILDING, type SurfaceResult } from '../utils/building-volume'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const floors = ref(6)
const floorHeight = ref(3.0)
const roof = ref('flat')
const roofHeight = ref(2.0)
const msg = ref('')
const msgType = ref('')

const calcResult = ref<{ baseArea: number; height: number; volume: number; surf: SurfaceResult; note: string; ringCount: number; roofVolume: number } | null>(null)

function fmt(n: number, d = 2): string {
  if (!isFinite(n)) return '-'
  return n.toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: 0 })
}

function doCalc() {
  const text = input.value.trim()
  if (!text) { msg.value = '请先粘贴建筑底面 GeoJSON'; msgType.value = 'err'; return }
  if (!(floors.value > 0)) { msg.value = '层数必须为正数'; msgType.value = 'err'; return }
  if (!(floorHeight.value > 0)) { msg.value = '层高必须为正数'; msgType.value = 'err'; return }
  let geo: unknown
  try { geo = JSON.parse(text) } catch { msg.value = 'JSON 解析失败'; msgType.value = 'err'; return }
  try {
    const ex = extractRings(geo)
    const ringCount = ex.rings.length
    const height = Math.round(floors.value * floorHeight.value * 100) / 100
    const baseArea = polygonArea(geo)
    if (baseArea <= 0) { msg.value = '底面积为 0，请检查多边形顶点'; msgType.value = 'err'; return }
    const volume = buildingVolume(baseArea, height, roof.value, roofHeight.value)
    const surf = calcSurface(geo, height, roof.value, roofHeight.value)
    const roofVolume = roof.value === 'cone' && roofHeight.value > 0 ? baseArea * roofHeight.value / 3 : 0
    calcResult.value = { baseArea, height, volume, surf, note: ex.note, ringCount, roofVolume }
    msg.value = `计算完成：底面积 ${fmt(baseArea)} m²，体积 ${fmt(volume)} m³`; msgType.value = 'ok'
  } catch (e) {
    msg.value = (e as Error).message; msgType.value = 'err'
  }
}

function loadSample() { input.value = SAMPLE_BUILDING }
function clearAll() { input.value = ''; calcResult.value = null; msg.value = '' }
</script>
