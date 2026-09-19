<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">瓦片工具箱</h1>
      <span class="page-subtitle">瓦片计算（单点/范围→行列号）+ 需求估算（bbox+层级→瓦片数/存储/耗时）</span>
    </div>
    <div class="tool-main">
      <div class="tabs" style="margin-bottom:1rem">
        <button class="tab" :class="{ active: tab === 'calc' }" @click="tab = 'calc'">瓦片计算</button>
        <button class="tab" :class="{ active: tab === 'estimate' }" @click="tab = 'estimate'">需求估算</button>
      </div>

      <!-- ===== 标签页 1：瓦片计算 ===== -->
      <template v-if="tab === 'calc'">
        <!-- 单点 → 瓦片行列号 -->
        <div class="panel" style="margin-bottom:1rem">
          <div class="panel-head"><span class="t">单点 → 瓦片行列号</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0">经度</label>
              <input class="form-input" v-model.number="lng" style="width:110px" />
              <label class="form-label" style="margin:0">纬度</label>
              <input class="form-input" v-model.number="lat" style="width:110px" />
              <label class="form-label" style="margin:0">层级 Z</label>
              <input class="form-input" type="number" v-model.number="z" min="0" max="22" style="width:80px" />
              <input type="range" v-model.number="z" min="0" max="22" step="1" style="flex:1;max-width:200px;accent-color:#667eea" />
            </div>
            <div class="result-grid" v-if="singleResult">
              <div class="result-card" style="background:rgba(102,126,234,0.12);border-color:rgba(102,126,234,0.3)">
                <span class="label">XYZ 行列号</span>
                <span class="value">{{ singleResult.x }} / {{ singleResult.y }} / {{ singleResult.z }}</span>
                <span class="sub">x={{ singleResult.x }} y={{ singleResult.y }}</span>
              </div>
              <div class="result-card">
                <span class="label">TMS 行号（翻转）</span>
                <span class="value">{{ singleResult.x }} / {{ singleResult.tms }} / {{ singleResult.z }}</span>
                <span class="sub">tmsY = 2^z-1-y = {{ singleResult.tms }}</span>
              </div>
              <div class="result-card">
                <span class="label">该瓦片覆盖范围</span>
                <span class="value">{{ singleResult.bounds.west.toFixed(5) }}, {{ singleResult.bounds.south.toFixed(5) }}</span>
                <span class="sub">→ {{ singleResult.bounds.east.toFixed(5) }}, {{ singleResult.bounds.north.toFixed(5) }}</span>
              </div>
            </div>
            <div style="margin-top:0.75rem">
              <div class="form-hint" style="margin-bottom:0.25rem">常用底图瓦片 URL（XYZ 模板）</div>
              <textarea class="form-textarea" :value="urlTemplate" readonly style="min-height:70px"></textarea>
            </div>
          </div>
        </div>

        <!-- 范围 → 瓦片覆盖 -->
        <div class="panel">
          <div class="panel-head"><span class="t">范围 → 瓦片覆盖</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0">西 lon</label>
              <input class="form-input" v-model.number="bWest" style="width:110px" />
              <label class="form-label" style="margin:0">南 lat</label>
              <input class="form-input" v-model.number="bSouth" style="width:110px" />
              <label class="form-label" style="margin:0">东 lon</label>
              <input class="form-input" v-model.number="bEast" style="width:110px" />
              <label class="form-label" style="margin:0">北 lat</label>
              <input class="form-input" v-model.number="bNorth" style="width:110px" />
              <label class="form-label" style="margin:0">层级 Z</label>
              <input class="form-input" type="number" v-model.number="bz" min="0" max="22" style="width:80px" />
            </div>
            <div class="action-row" v-if="boundResult" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.1);border-radius:9px;padding:0.5rem 0.75rem;font-size:0.8125rem;color:#a0a0a0">
              <span>瓦片总数 <b style="color:#fff">{{ boundResult.count }}</b></span>
              <span>X 范围 <b style="color:#fff">{{ boundResult.x0 }} ~ {{ boundResult.x1 }}</b></span>
              <span>Y 范围 <b style="color:#fff">{{ boundResult.y0 }} ~ {{ boundResult.y1 }}</b></span>
              <span class="spacer" style="flex:1"></span>
              <button class="btn btn-secondary btn-small" @click="showList = !showList">{{ showList ? '隐藏清单' : '列出清单' }}</button>
            </div>
            <div v-if="showList && boundResult" style="margin-top:0.625rem">
              <textarea class="form-textarea" :value="tileList" readonly style="min-height:120px"></textarea>
            </div>
          </div>
        </div>
      </template>

      <!-- ===== 标签页 2：需求估算 ===== -->
      <template v-if="tab === 'estimate'">
        <div class="tool-grid">
          <!-- 左侧：参数 -->
          <div class="panel">
            <div class="panel-head"><span class="t">地理范围（BBOX）</span></div>
            <div class="panel-body">
              <div class="result-grid" style="grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.625rem">
                <div>
                  <label class="form-label">西经 (°)</label>
                  <input class="form-input" type="number" v-model.number="eLonW" step="0.0001" />
                </div>
                <div>
                  <label class="form-label">南纬 (°)</label>
                  <input class="form-input" type="number" v-model.number="eLatS" step="0.0001" />
                </div>
                <div>
                  <label class="form-label">东经 (°)</label>
                  <input class="form-input" type="number" v-model.number="eLonE" step="0.0001" />
                </div>
                <div>
                  <label class="form-label">北纬 (°)</label>
                  <input class="form-input" type="number" v-model.number="eLatN" step="0.0001" />
                </div>
              </div>
              <div class="action-row">
                <button class="btn btn-secondary btn-small" @click="showGeoJsonModal = true">从 GeoJSON 提取 BBOX</button>
              </div>
              <div class="form-group" style="margin-top:0.75rem">
                <label class="form-label">层级范围</label>
                <div class="action-row">
                  <select class="form-select" v-model.number="eMinZ" style="width:80px">
                    <option v-for="i in 23" :key="i - 1" :value="i - 1">Z{{ i - 1 }}</option>
                  </select>
                  <span class="form-hint">~</span>
                  <select class="form-select" v-model.number="eMaxZ" style="width:80px">
                    <option v-for="i in 23" :key="i - 1" :value="i - 1">Z{{ i - 1 }}</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">瓦片大小</label>
                <select class="form-select" v-model.number="eTileSize">
                  <option value="256">256 px</option>
                  <option value="512">512 px</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">单张大小</label>
                <div class="action-row">
                  <input class="form-input" type="number" v-model.number="eAvgSizeKB" min="1" step="1" />
                  <span class="form-hint">KB</span>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">下载速度</label>
                <div class="action-row">
                  <input class="form-input" type="number" v-model.number="eSpeedMbps" min="0.1" step="0.1" />
                  <span class="form-hint">Mbps</span>
                </div>
              </div>
              <button class="btn btn-primary" @click="calcEstimate" style="width:100%">计 算</button>
              <div class="msg" :class="estMsgClass" v-if="estMsgText">{{ estMsgText }}</div>
            </div>
          </div>

          <!-- 右侧：结果 -->
          <div class="panel">
            <div class="panel-head"><span class="t">估算结果</span></div>
            <div class="panel-body">
              <template v-if="estLevels.length">
                <div class="result-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:1rem">
                  <div class="result-card" style="text-align:center">
                    <span class="label">总瓦片数</span>
                    <span class="value" style="font-size:1.25rem;font-weight:700">{{ formatNumber(estTotalTiles) }}</span>
                  </div>
                  <div class="result-card" style="text-align:center">
                    <span class="label">总存储</span>
                    <span class="value" style="font-size:1.25rem;font-weight:700">{{ estSizeVal }}</span>
                    <span class="sub">{{ estSizeUnit }}</span>
                  </div>
                  <div class="result-card" style="text-align:center">
                    <span class="label">下载耗时</span>
                    <span class="value" style="font-size:1rem;font-weight:700">{{ estTimeStr }}</span>
                  </div>
                  <div class="result-card" style="text-align:center">
                    <span class="label">最大单层瓦片数</span>
                    <span class="value" style="font-size:1.25rem;font-weight:700">{{ formatNumber(estMaxLevelCount) }}</span>
                  </div>
                </div>
                <table class="data-table">
                  <thead>
                    <tr><th>层级</th><th>X 范围</th><th>Y 范围</th><th>瓦片数</th><th>存储小计</th><th>累计存储</th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="lv in [...estLevels].reverse()" :key="lv.z">
                      <td style="color:#667eea;font-weight:600">Z{{ lv.z }}</td>
                      <td>{{ lv.xMin }} ~ {{ lv.xMax }}</td>
                      <td>{{ lv.yMin }} ~ {{ lv.yMax }}</td>
                      <td>{{ formatNumber(lv.count) }}</td>
                      <td>{{ formatSizeMB(lv.sizeMB) }}</td>
                      <td>{{ formatSizeMB(lv.cumMB) }}</td>
                    </tr>
                  </tbody>
                </table>
              </template>
              <div v-else style="text-align:center;color:#606060;padding:3rem 0;line-height:2">
                填写左侧参数后点击「计算」按钮<br>查看瓦片需求估算结果
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- GeoJSON 提取弹窗 -->
      <div v-if="showGeoJsonModal" class="modal-overlay" @click.self="showGeoJsonModal = false">
        <div class="modal-box">
          <h3 style="font-size:0.9375rem;font-weight:700;margin-bottom:0.625rem">从 GeoJSON 提取 BBOX</h3>
          <textarea class="form-textarea" v-model="geoJsonInput" style="min-height:120px"
            placeholder="粘贴 GeoJSON 内容"></textarea>
          <div class="msg err" v-if="modalErrText">{{ modalErrText }}</div>
          <div class="action-row" style="justify-content:flex-end;margin-top:0.625rem">
            <button class="btn btn-secondary btn-small" @click="showGeoJsonModal = false">取消</button>
            <button class="btn btn-primary btn-small" @click="extractBBox">提 取</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  lngToTileX, latToTileY, tileBounds, tmsY, multiUrl,
  calcBound, listTiles, calcAllLevels, formatNumber, formatSizeMB, formatTime,
  extractBBoxFromGeoJSON,
} from '../utils/tile-tools'
import type { LevelResult } from '../utils/tile-tools'

const router = useRouter()
const goBack = () => router.push('/')

const tab = ref<'calc' | 'estimate'>('calc')

/* ---- 瓦片计算 ---- */
const lng = ref(116.391428)
const lat = ref(39.907547)
const z = ref(14)

const singleResult = computed(() => {
  if (isNaN(lng.value) || isNaN(lat.value) || isNaN(z.value)) return null
  const x = lngToTileX(lng.value, z.value)
  const y = latToTileY(lat.value, z.value)
  const b = tileBounds(x, y, z.value)
  return { x, y, z: z.value, tms: tmsY(y, z.value), bounds: b }
})

const urlTemplate = computed(() => singleResult.value ? multiUrl(singleResult.value.x, singleResult.value.y, singleResult.value.z) : '')

/* ---- 范围计算 ---- */
const bWest = ref(116.35), bSouth = ref(39.88), bEast = ref(116.43), bNorth = ref(39.94)
const bz = ref(15)
const showList = ref(false)

const boundResult = computed(() => {
  if ([bWest.value, bSouth.value, bEast.value, bNorth.value, bz.value].some(isNaN)) return null
  return calcBound(bWest.value, bSouth.value, bEast.value, bNorth.value, bz.value)
})

const tileList = computed(() => {
  if (!boundResult.value) return ''
  return listTiles(boundResult.value).join('\n')
})

/* ---- 需求估算 ---- */
const eLonW = ref(116.0), eLatS = ref(39.0), eLonE = ref(117.0), eLatN = ref(40.0)
const eMinZ = ref(6), eMaxZ = ref(14)
const eTileSize = ref(256), eAvgSizeKB = ref(30), eSpeedMbps = ref(10)
const estLevels = ref<LevelResult[]>([])
const estMsgText = ref(''), estMsgClass = ref('')

const showGeoJsonModal = ref(false)
const geoJsonInput = ref('')
const modalErrText = ref('')

const estTotalTiles = computed(() => estLevels.value.reduce((s, l) => s + l.count, 0))
const estTotalMB = computed(() => estLevels.value.reduce((s, l) => s + l.sizeKB, 0) / 1024)
const estMaxLevelCount = computed(() => Math.max(0, ...estLevels.value.map((l) => l.count)))
const estSizeVal = computed(() => {
  const gb = estTotalMB.value / 1024
  return gb >= 1 ? gb.toFixed(2) : estTotalMB.value.toFixed(2)
})
const estSizeUnit = computed(() => estTotalMB.value / 1024 >= 1 ? 'GB' : 'MB')
const estTimeStr = computed(() => formatTime(estTotalMB.value * 8 / eSpeedMbps.value))

function calcEstimate() {
  estMsgText.value = ''
  if (isNaN(eLonW.value) || isNaN(eLatS.value) || isNaN(eLonE.value) || isNaN(eLatN.value)) {
    estMsgText.value = '请填写完整的 BBOX 坐标'; estMsgClass.value = 'err'; return
  }
  if (eLonW.value >= eLonE.value) { estMsgText.value = '西经应小于东经'; estMsgClass.value = 'err'; return }
  if (eLatS.value >= eLatN.value) { estMsgText.value = '南纬应小于北纬'; estMsgClass.value = 'err'; return }
  if (eMinZ.value > eMaxZ.value) { estMsgText.value = '最小层级不能大于最大层级'; estMsgClass.value = 'err'; return }
  if (isNaN(eAvgSizeKB.value) || eAvgSizeKB.value <= 0) { estMsgText.value = '单张大小必须为正数'; estMsgClass.value = 'err'; return }

  estLevels.value = calcAllLevels(eLonW.value, eLatS.value, eLonE.value, eLatN.value, eMinZ.value, eMaxZ.value, eAvgSizeKB.value)

  const total = estTotalTiles.value
  if (total > 1e8) estMsgText.value = `警告：总瓦片数超过 1 亿（${formatNumber(total)}），下载量和耗时极大`, estMsgClass.value = 'warn'
  else if (total > 1e7) estMsgText.value = `提示：总瓦片数 ${formatNumber(total)}，规模较大，请注意存储空间`, estMsgClass.value = 'warn'
  else if (total > 1e5) estMsgText.value = `计算完成：共 ${formatNumber(total)} 张瓦片，预估存储 ${formatSizeMB(estTotalMB.value)}`, estMsgClass.value = 'ok'
  else estMsgText.value = `计算完成：共 ${formatNumber(total)} 张瓦片`, estMsgClass.value = 'ok'
}

function extractBBox() {
  const text = geoJsonInput.value.trim()
  if (!text) { modalErrText.value = '请粘贴 GeoJSON 内容'; return }
  try {
    const geojson = JSON.parse(text)
    const bbox = extractBBoxFromGeoJSON(geojson)
    if (!bbox) { modalErrText.value = '未能从 GeoJSON 中提取坐标'; return }
    eLonW.value = bbox.lonW; eLatS.value = bbox.latS
    eLonE.value = bbox.lonE; eLatN.value = bbox.latN
    showGeoJsonModal.value = false
    modalErrText.value = ''
  } catch (e: any) {
    modalErrText.value = 'JSON 解析失败: ' + e.message
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex;
  align-items: center; justify-content: center; z-index: 1000;
}
.modal-box {
  background: #1a1a2e; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px;
  padding: 1.25rem; width: 90%; max-width: 560px;
}
</style>
