<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">图幅编号计算</h1>
      <span class="page-subtitle">国家基本比例尺地形图 · 经纬度↔图幅号互查</span>
    </div>
    <div class="tool-main">
      <!-- 经纬度 → 图幅号 -->
      <div class="panel" style="margin-bottom:1rem;">
        <div class="panel-head"><span class="t">经纬度 → 图幅号</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom:0.75rem;">
            <label class="form-label" style="margin:0;min-width:50px;">经度</label>
            <input class="form-input" type="number" v-model.number="lng" style="width:130px;" />
            <label class="form-label" style="margin:0;min-width:50px;">纬度</label>
            <input class="form-input" type="number" v-model.number="lat" style="width:130px;" />
            <button class="btn btn-primary" @click="calc">查询</button>
          </div>
          <div class="result-grid">
            <div v-for="r in sheetResults" :key="r.scale" class="result-card">
              <span class="label">{{ r.scale }}</span>
              <span class="value">{{ r.code }}</span>
              <span class="sub">{{ r.west.toFixed(4) }},{{ r.south.toFixed(4) }} → {{ r.east.toFixed(4) }},{{ r.north.toFixed(4) }}</span>
            </div>
          </div>
        </div>
      </div>
      <!-- 图幅号 → 范围 -->
      <div class="panel">
        <div class="panel-head"><span class="t">图幅号 → 范围</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom:0.75rem;">
            <label class="form-label" style="margin:0;min-width:60px;">图幅号</label>
            <input class="form-input" v-model="sheetNo" style="width:160px;" />
            <label class="form-label" style="margin:0;min-width:60px;">比例尺</label>
            <select class="form-select" v-model="scale" style="width:120px;">
              <option value="1M">1:100万</option>
              <option value="500K">1:50万</option>
              <option value="250K">1:25万</option>
              <option value="100K">1:10万</option>
              <option value="50K">1:5万</option>
              <option value="25K">1:2.5万</option>
              <option value="10K">1:1万</option>
            </select>
            <button class="btn btn-secondary" @click="reverse">反查</button>
          </div>
          <div class="result-grid">
            <div v-if="revError" class="result-card">
              <span class="label">错误</span>
              <span class="value" style="color:#ef4444;">{{ revError }}</span>
            </div>
            <div v-else-if="revResult" class="result-card">
              <span class="label">{{ revResult.scale || '1:100万' }}</span>
              <span class="value">{{ revResult.code }}</span>
              <span class="sub">{{ revResult.west.toFixed(4) }},{{ revResult.south.toFixed(4) }} → {{ revResult.east.toFixed(4) }},{{ revResult.north.toFixed(4) }}</span>
              <span v-if="revResult.hint" class="sub" style="color:#f59e0b;">{{ revResult.hint }}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="tool-footer">
        1:100万图幅：经度6°带(1-60)+纬度4°带(A-V)；北京(116.4,39.9)在 J-50 图幅
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { lngLatToSheet, sheetToBbox } from '../utils/map-sheet'
import type { SheetResult, ReverseResult } from '../utils/map-sheet'

const router = useRouter()
const goBack = () => router.push('/')

const lng = ref(116.391428)
const lat = ref(39.907547)
const sheetNo = ref('J-50')
const scale = ref('1M')

const sheetResults = ref<SheetResult[]>([])
const revResult = ref<ReverseResult | null>(null)
const revError = ref('')

function calc() {
  if (isNaN(lng.value) || isNaN(lat.value)) return
  sheetResults.value = lngLatToSheet(lng.value, lat.value)
}

function reverse() {
  const r = sheetToBbox(sheetNo.value, scale.value)
  if (r.error) {
    revError.value = r.error
    revResult.value = null
  } else {
    revError.value = ''
    revResult.value = r
  }
}

calc()
</script>
