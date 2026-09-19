<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">投影带速查器</h1>
      <span class="page-subtitle">高斯3°/6°带 · UTM 带号 · 省市对照</span>
    </div>
    <div class="tool-main">
      <!-- 查询面板 -->
      <div class="panel" style="margin-bottom: 1rem">
        <div class="panel-head">
          <span class="t">按经纬度查带</span>
        </div>
        <div class="panel-body">
          <div class="form-group" style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <label class="form-label" style="margin: 0;">经度</label>
            <input class="form-input" type="number" v-model="lng" step="any" style="width: 110px;" />
            <label class="form-label" style="margin: 0;">纬度</label>
            <input class="form-input" type="number" v-model="lat" step="any" style="width: 110px;" />
            <button class="btn btn-primary" @click="doQuery">查询</button>
            <span class="form-hint" style="margin: 0;">城市快捷：</span>
            <select class="form-select" v-model="selectedCity" @change="onCityChange" style="width: 140px;">
              <option value="">— 选择城市 —</option>
              <option v-for="c in Object.keys(cities)" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div class="result-grid" style="margin-top: 0.5rem;">
            <div class="result-card">
              <span class="label">高斯 3°带</span>
              <span class="value">带号 {{ result.b3 }}</span>
              <span class="sub">中央经线 {{ result.c3 }}°E</span>
            </div>
            <div class="result-card">
              <span class="label">高斯 6°带</span>
              <span class="value">带号 {{ result.b6 }}</span>
              <span class="sub">中央经线 {{ result.c6 }}°E</span>
            </div>
            <div class="result-card">
              <span class="label">UTM</span>
              <span class="value">{{ result.uz }}{{ result.latBand }}</span>
              <span class="sub">中央经线 {{ result.uc }}°E</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 省市对照表 -->
      <div class="panel">
        <div class="panel-head">
          <span class="t">国内主要省市 3°/6°带对照</span>
        </div>
        <div class="panel-body" style="overflow: auto; max-height: 360px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>省市</th><th>省会经度</th><th>3°带号</th><th>3°中央经线</th><th>6°带号</th><th>6°中央经线</th><th>UTM带号</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in provinceRows" :key="p.name">
                <td>{{ p.name }}</td><td>{{ p.lng }}</td><td>{{ p.r.b3 }}</td><td>{{ p.r.c3 }}°</td><td>{{ p.r.b6 }}</td><td>{{ p.r.c6 }}°</td><td>{{ p.r.uz }}{{ p.r.latBand }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="tool-footer">
        3°带带号 = floor((经度+1.5)/3)，中央经线 = 带号×3；6°带带号 = floor(经度/6)+1，中央经线 = 带号×6−3；UTM带号 = floor((经度+180)/6)+1
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { query, PROVINCES, CITY_MAP } from '../utils/band-lookup'
import type { BandQueryResult } from '../utils/band-lookup'

const router = useRouter()
const goBack = () => router.push('/')

const lng = ref(116.391428)
const lat = ref(39.907547)
const selectedCity = ref('')
const cities = CITY_MAP

const result = ref<BandQueryResult>(query(lng.value, lat.value))

function doQuery() {
  const l = parseFloat(String(lng.value))
  const la = parseFloat(String(lat.value))
  if (isNaN(l) || isNaN(la)) return
  result.value = query(l, la)
}

function onCityChange() {
  if (selectedCity.value && cities[selectedCity.value]) {
    lng.value = parseFloat(cities[selectedCity.value]!)
    doQuery()
  }
}

const provinceRows = computed(() =>
  PROVINCES.map(([name, lngStr]) => ({
    name,
    lng: lngStr,
    r: query(parseFloat(lngStr), 30),
  })),
)
</script>
