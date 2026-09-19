<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">瓦片下载脚本</h1>
      <span class="page-subtitle">按范围生成 wget 批量下载脚本 · 5 种底图源</span>
    </div>
    <div class="tool-main">
      <div class="panel">
        <div class="panel-head"><span class="t">下载范围与参数</span></div>
        <div class="panel-body">
          <div class="form-group">
            <label class="form-label">范围（西 lon, 南 lat, 东 lon, 北 lat）</label>
            <div class="action-row">
              <input class="form-input" v-model.number="bWest" style="width:110px" placeholder="西" />
              <input class="form-input" v-model.number="bSouth" style="width:110px" placeholder="南" />
              <input class="form-input" v-model.number="bEast" style="width:110px" placeholder="东" />
              <input class="form-input" v-model.number="bNorth" style="width:110px" placeholder="北" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">层级范围</label>
            <div class="action-row">
              <label class="form-label" style="margin:0">最小 Z</label>
              <input class="form-input" type="number" v-model.number="zMin" min="0" max="22" style="width:80px" />
              <label class="form-label" style="margin:0">最大 Z</label>
              <input class="form-input" type="number" v-model.number="zMax" min="0" max="22" style="width:80px" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">底图源</label>
            <select class="form-select" v-model="tileSrc">
              <option v-for="(name, key) in SRC_NAMES" :key="key" :value="key">{{ name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="chk-box">
              <input type="checkbox" v-model="tmsMode" /> TMS 行号翻转
            </label>
          </div>
          <div class="action-row">
            <button class="btn btn-primary btn-small" @click="generate">生成脚本</button>
          </div>
          <div class="action-row" v-if="scriptResult"
            style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:0.5rem 0.75rem;font-size:0.8125rem;color:#a0a0a0">
            <span>瓦片总数 <b style="color:#fff">{{ scriptResult.total }}</b></span>
            <span>预计体积 <b style="color:#fff">{{ estSize }}</b></span>
          </div>
          <textarea class="form-textarea" :value="scriptText" readonly spellcheck="false"
            style="margin-top:0.5rem;min-height:260px" placeholder="生成的 wget 下载脚本显示在这里"></textarea>
          <div class="action-row" style="margin-top:0.5rem">
            <button class="btn btn-secondary btn-small" @click="copyScript">{{ copyLabel }}</button>
            <button class="btn btn-primary btn-small" @click="downloadScript">下载 .sh</button>
          </div>
          <div class="form-hint" style="margin-top:0.375rem">
            脚本用法：保存为 download.sh，在 Git Bash / Linux 执行 <code>bash download.sh</code>；天地图需将 <code>YOUR_KEY</code> 替换为实际 tk
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { genScript, SRC_NAMES } from '../utils/tile-downloader'

const router = useRouter()
const goBack = () => router.push('/')

const bWest = ref(116.35), bSouth = ref(39.88), bEast = ref(116.43), bNorth = ref(39.94)
const zMin = ref(10), zMax = ref(15)
const tileSrc = ref('osm')
const tmsMode = ref(false)

const scriptResult = ref<{ script: string; total: number } | null>(null)
const scriptText = computed(() => scriptResult.value?.script || '')
const estSize = computed(() => scriptResult.value ? (scriptResult.value.total * 30 / 1024).toFixed(1) + ' MB' : '—')
const copyLabel = ref('复制脚本')

function generate() {
  if ([bWest.value, bSouth.value, bEast.value, bNorth.value, zMin.value, zMax.value].some(isNaN)) return
  let zMinVal = zMin.value, zMaxVal = zMax.value
  if (zMaxVal < zMinVal) { [zMinVal, zMaxVal] = [zMaxVal, zMinVal] }
  scriptResult.value = genScript({
    west: bWest.value, south: bSouth.value, east: bEast.value, north: bNorth.value,
    zMin: zMinVal, zMax: zMaxVal, tms: tmsMode.value, src: tileSrc.value,
  })
}

async function copyScript() {
  if (!scriptText.value) return
  try { await navigator.clipboard.writeText(scriptText.value) } catch {
    const ta = document.createElement('textarea')
    ta.value = scriptText.value; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); ta.remove()
  }
  copyLabel.value = '已复制 ✓'
  setTimeout(() => { copyLabel.value = '复制脚本' }, 1200)
}

function downloadScript() {
  if (!scriptText.value) return
  const blob = new Blob([scriptText.value], { type: 'text/plain;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = 'download_tiles.sh'
  document.body.appendChild(a); a.click()
  setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href) }, 500)
}

onMounted(() => generate())
</script>

<style scoped>
.chk-box {
  display: inline-flex; align-items: center; gap: 0.3125rem; cursor: pointer; user-select: none;
  color: #a0a0a0; font-size: 0.8125rem; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.3125rem 0.625rem;
}
.chk-box input { accent-color: #667eea; cursor: pointer; }
</style>
