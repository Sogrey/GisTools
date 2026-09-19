<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">Cesium 相机参数计算器</h1>
      <span class="page-subtitle">相机位置 Cartesian3 · heading/pitch/roll · setView 代码生成</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">相机位置与朝向</span></div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin:0">目标经度</label>
              <input class="form-input" type="number" v-model.number="lng" step="any" style="width:110px" />
              <label class="form-label" style="margin:0">目标纬度</label>
              <input class="form-input" type="number" v-model.number="lat" step="any" style="width:110px" />
              <label class="form-label" style="margin:0">目标高度m</label>
              <input class="form-input" type="number" v-model.number="targetH" step="any" style="width:90px" />
            </div>
            <div class="action-row">
              <label class="form-label" style="margin:0">相机距离m</label>
              <input class="form-input" type="number" v-model.number="dist" step="any" style="width:110px" />
              <label class="form-label" style="margin:0">方位角°</label>
              <input class="form-input" type="number" v-model.number="az" step="any" style="width:90px" />
              <label class="form-label" style="margin:0">俯仰角°</label>
              <input class="form-input" type="number" v-model.number="pitch" step="any" style="width:90px" />
              <button class="btn btn-primary" @click="calc">计算</button>
            </div>
            <div class="result-grid" v-if="result">
              <div class="result-card"><span class="label">相机位置 Cartesian3</span><span class="value" style="font-size:0.75rem">Cesium.Cartesian3({{ fmt(result.cam[0]) }}, {{ fmt(result.cam[1]) }}, {{ fmt(result.cam[2]) }})</span></div>
              <div class="result-card"><span class="label">目标位置 Cartesian3</span><span class="value" style="font-size:0.75rem">Cesium.Cartesian3({{ fmt(result.tgt[0]) }}, {{ fmt(result.tgt[1]) }}, {{ fmt(result.tgt[2]) }})</span></div>
              <div class="result-card"><span class="label">朝向</span><span class="value">heading={{ fmt(result.heading) }}°<br>pitch={{ fmt(result.pitch) }}°<br>roll=0°</span></div>
            </div>
            <div class="form-group">
              <label class="form-label">Cesium 代码（可直接复制）</label>
              <textarea class="form-textarea" v-model="code" readonly></textarea>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">经纬度 → ECEF（Cartesian3）</span></div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin:0">经度</label>
              <input class="form-input" type="number" v-model.number="eLng" step="any" style="width:110px" />
              <label class="form-label" style="margin:0">纬度</label>
              <input class="form-input" type="number" v-model.number="eLat" step="any" style="width:110px" />
              <label class="form-label" style="margin:0">高度m</label>
              <input class="form-input" type="number" v-model.number="eH" step="any" style="width:90px" />
              <button class="btn btn-secondary" @click="calcEcef">计算</button>
            </div>
            <div class="result-grid" v-if="ecefResult">
              <div class="result-card"><span class="label">ECEF / Cartesian3</span><span class="value" style="font-size:0.75rem">Cesium.Cartesian3({{ fmt(ecefResult[0]) }}, {{ fmt(ecefResult[1]) }}, {{ fmt(ecefResult[2]) }})</span></div>
              <div class="result-card"><span class="label">数值数组</span><span class="value">[{{ ecefResult[0].toFixed(2) }}, {{ ecefResult[1].toFixed(2) }}, {{ ecefResult[2].toFixed(2) }}]</span></div>
            </div>
          </div>
        </section>
      </div>
      <div class="tool-footer">heading 自北顺时针 0-360°；pitch 负=俯视；roll 默认 0。ECEF 与 Cesium Cartesian3 一致（WGS84 椭球）</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { calcCamera, genSetViewCode, lngLatToEcef, type Vec3 } from '../utils/cesium-camera'

const router = useRouter()
const goBack = () => router.push('/')

const lng = ref(116.391428)
const lat = ref(39.907547)
const targetH = ref(0)
const dist = ref(5000)
const az = ref(123)
const pitch = ref(-25)

const result = computed(() => calcCamera(lng.value, lat.value, targetH.value, dist.value, az.value, pitch.value))
const code = computed(() => genSetViewCode(lng.value, lat.value, targetH.value, dist.value, az.value, pitch.value))

const eLng = ref(116.391428)
const eLat = ref(39.907547)
const eH = ref(0)
const ecefResult = ref<Vec3 | null>(null)

function fmt(v: number): string { return v.toFixed(4) }

function calc() { /* computed handles it */ }
function calcEcef() {
  ecefResult.value = lngLatToEcef(eLng.value, eLat.value, eH.value)
}
calcEcef()
</script>
