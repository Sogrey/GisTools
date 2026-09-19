<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">三维坐标转换工作台</h1>
      <span class="page-subtitle">7 系互通 · 4 椭球 · 3°/6° 分带 · 两点距离方位角</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">源坐标</span>
            <div class="spacer"></div>
            <span class="msg err" v-if="errCount > 0">有 {{ errCount }} 行无法解析</span>
          </div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom: 0.5rem; flex-wrap: wrap;">
              <label class="form-label" style="margin: 0;">源坐标系</label>
              <select class="form-select" v-model="srcSrid" style="width: auto; min-width: 180px;" @change="render">
                <option value="wgs84">WGS84 经纬度（GPS / Cesium）</option>
                <option value="gcj02">GCJ02（高德 / 腾讯）</option>
                <option value="bd09">BD09（百度）</option>
                <option value="webm">Web 墨卡托（米）</option>
                <option value="gauss">高斯克吕格（米）</option>
                <option value="utm">UTM（米）</option>
                <option value="ecef">ECEF 地心直角（米）</option>
              </select>
              <label class="form-label" style="margin: 0;">经纬顺序</label>
              <select class="form-select" v-model="latOrder" style="width: auto;" @change="render">
                <option value="lng-lat">经度,纬度</option>
                <option value="lat-lng">纬度,经度</option>
                <option value="auto">自动判断</option>
              </select>
              <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 0.8125rem; color: #a0a0a0;">
                <input type="checkbox" v-model="autoConv" style="accent-color: #667eea;" />自动转换
              </label>
            </div>
            <div class="action-row" style="margin-bottom: 0.5rem;">
              <label class="form-label" style="margin: 0;">椭球</label>
              <select class="form-select" v-model="ell" style="width: auto;" @change="render">
                <option value="cgcs2000">CGCS2000</option>
                <option value="wgs84">WGS84</option>
                <option value="xian80">西安80</option>
                <option value="beijing54">北京54</option>
              </select>
              <label class="form-label" style="margin: 0;">高斯分带</label>
              <select class="form-select" v-model="bandType" style="width: auto;" @change="render">
                <option value="3">3°带</option>
                <option value="6">6°带</option>
              </select>
              <span class="form-hint" style="margin: 0;">{{ ellTip }}</span>
            </div>
            <textarea v-model="inputText" class="form-textarea" placeholder="直接粘贴坐标，支持多种格式，多行批量：&#10;&#10;116.391428,39.907528&#10;116°23′49″E, 39°54′27″N&#10;39500000.12 3400000.5（高斯带号+假东 北）&#10;50 450000 3400000.5（UTM：带号 东 北）&#10;-2150000 4400000 3800000（ECEF：X Y Z）" @input="onInput"></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="render">转换</button>
              <button class="btn btn-secondary btn-small" @click="loadExample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
              <div class="spacer"></div>
              <span class="form-hint">{{ inputLines }} 行</span>
            </div>
          </div>
        </div>

        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">转换结果</span>
            <div class="spacer"></div>
            <label class="form-label" style="margin: 0;">目标坐标系</label>
            <select class="form-select" v-model="dstSrid" style="width: auto; min-width: 150px;" @change="render">
              <option value="wgs84">WGS84 经纬度</option>
              <option value="gcj02">GCJ-02（高德/腾讯）</option>
              <option value="bd09">BD09（百度）</option>
              <option value="webm">Web 墨卡托（米）</option>
              <option value="gauss">高斯克吕格（米）</option>
              <option value="utm">UTM（米）</option>
              <option value="ecef">ECEF 地心直角（米）</option>
            </select>
            <select class="form-select" v-model="outFmt" style="width: auto;" @change="render">
              <option value="deg">小数度</option>
              <option value="dms">度分秒</option>
            </select>
            <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 0.8125rem; color: #a0a0a0;">
              <input type="checkbox" v-model="gaussBand" style="accent-color: #667eea;" @change="render" />带号
            </label>
          </div>
          <div class="panel-body">
            <div class="action-row" style="padding: 0.5rem 0.75rem; background: rgba(102,126,234,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 0.8125rem; color: #a0a0a0; margin-bottom: 0.5rem;">
              <span>总行数 <b style="color:#fff">{{ statTotal }}</b></span>
              <span>成功 <b style="color:#10b981">{{ statOk }}</b></span>
              <span>失败 <b style="color:#ef4444">{{ statErr }}</b></span>
              <span v-if="firstWgs" style="color: #606060;">· 首行 WGS84: {{ firstWgs }}</span>
              <div class="spacer"></div>
              <button class="btn btn-secondary btn-small" @click="copyAll">复制全部</button>
              <button class="btn btn-secondary btn-small" @click="exportCsv">导出 CSV</button>
            </div>
            <div style="flex: 1; overflow: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; min-height: 200px;">
              <div v-if="rows.length === 0" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #606060; gap: 0.5rem; padding: 2.5rem 1rem; text-align: center;">
                <div>在左侧粘贴坐标，或点击「载入示例」快速体验</div>
              </div>
              <table v-else class="data-table">
                <thead>
                  <tr><th>#</th><th>源坐标</th><th>转换结果</th><th>纬度 / Y</th><th>经度 / X</th></tr>
                </thead>
                <tbody>
                  <tr v-for="r in rows" :key="r.no">
                    <td v-if="r.err" colspan="5" style="color: #ef4444;">{{ r.no }}. {{ r.src }} — {{ r.err }}</td>
                    <template v-else>
                      <td>{{ r.no }}</td><td>{{ r.src }}</td><td>{{ r.out }}</td><td>{{ num(r.b) }}</td><td>{{ num(r.a) }}</td>
                    </template>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- 距离方位角 -->
      <div class="panel" style="margin-top: 1rem;">
        <div class="panel-head"><span class="t">两点距离与方位角（WGS84 椭球面 Vincenty 反解）</span></div>
        <div class="panel-body">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem 1rem; margin-bottom: 0.75rem;">
            <div>
              <label class="form-label">A 点（经度,纬度）</label>
              <input class="form-input" v-model="distA" @input="renderDist" style="font-family: Consolas, monospace;" />
            </div>
            <div>
              <label class="form-label">B 点（经度,纬度）</label>
              <input class="form-input" v-model="distB" @input="renderDist" style="font-family: Consolas, monospace;" />
            </div>
          </div>
          <div class="result-grid">
            <div class="result-card"><span class="label">距离</span><span class="value" style="font-size: 1.125rem; font-weight: 700; color: #667eea;">{{ distKm }}</span><span class="sub">km (Vincenty)</span></div>
            <div class="result-card"><span class="label">初始方位角</span><span class="value">{{ distAz1 }}°</span></div>
            <div class="result-card"><span class="label">终点方位角</span><span class="value">{{ distAz2 }}°</span></div>
            <div class="result-card"><span class="label">Haversine</span><span class="value">{{ distHav }}</span><span class="sub">km</span></div>
          </div>
        </div>
      </div>

      <div class="tool-footer">
        粘贴坐标文本，自动识别度分秒/小数度并批量转换 · 7 系坐标全互通 + 4 椭球 · 数据仅在本机处理
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { convertLine, ELLIPSOIDS, num, fmtLngLat, vincenty, haversineKm } from '../utils/coord-workbench'
import type { Srid, ConvertOptions } from '../utils/coord-workbench'

const router = useRouter()
const goBack = () => router.push('/')

const srcSrid = ref<Srid>('wgs84')
const dstSrid = ref<Srid>('gcj02')
const latOrder = ref('lng-lat')
const outFmt = ref<'deg' | 'dms'>('deg')
const gaussBand = ref(true)
const autoConv = ref(true)
const ell = ref('cgcs2000')
const bandType = ref('3')
const inputText = ref('')

const rows = ref<{ no: number; src: string; out: string; a: number; b: number; err: string }[]>([])
const statTotal = ref(0)
const statOk = ref(0)
const statErr = ref(0)
const errCount = ref(0)
const firstWgs = ref('')

const distA = ref('116.397428, 39.90923')
const distB = ref('121.473701, 31.230416')
const distKm = ref('—')
const distAz1 = ref('—')
const distAz2 = ref('—')
const distHav = ref('—')

const ellTip = computed(() => {
  const e = ELLIPSOIDS[ell.value]!
  return '当前椭球: ' + e.name + ' a=' + e.a
})

const inputLines = computed(() => inputText.value.split(/\r?\n/).filter((l) => l.trim()).length)

function opts(): ConvertOptions {
  return { ell: ell.value, bandType: bandType.value }
}

function render() {
  const lines = inputText.value.split(/\r?\n/)
  const out: { no: number; src: string; out: string; a: number; b: number; err: string }[] = []
  let okCount = 0, errCountLocal = 0
  let sampleWgs: [number, number] | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const r = convertLine(srcSrid.value, dstSrid.value, trimmed, latOrder.value, gaussBand.value, outFmt.value === 'dms', opts())
    if (r.ok && r.out) {
      okCount++
      out.push({ no: out.length + 1, src: r.src!, out: r.out.label, a: r.out.a, b: r.out.b, err: '' })
      if (!sampleWgs && r.wgs) sampleWgs = r.wgs
    } else {
      errCountLocal++
      out.push({ no: out.length + 1, src: trimmed, out: '', a: 0, b: 0, err: r.err! })
    }
  }

  rows.value = out
  statTotal.value = lines.filter((l) => l.trim() !== '').length
  statOk.value = okCount
  statErr.value = errCountLocal
  errCount.value = errCountLocal
  firstWgs.value = sampleWgs ? fmtLngLat(sampleWgs[0], sampleWgs[1], outFmt.value === 'dms') : ''
}

function onInput() {
  if (autoConv.value) render()
}

function parseLngLat(s: string): [number, number] | null {
  if (!s) return null
  const parts = s.split(/[,，\s]+/).filter(Boolean)
  if (parts.length < 2) return null
  const a = parseFloat(parts[0]!), b = parseFloat(parts[1]!)
  if (isNaN(a) || isNaN(b)) return null
  return [a, b]
}

function renderDist() {
  const A = parseLngLat(distA.value), B = parseLngLat(distB.value)
  if (!A || !B) {
    distKm.value = '—'; distAz1.value = '—'; distAz2.value = '—'; distHav.value = '—'
    return
  }
  const v = vincenty(A[0], A[1], B[0], B[1])
  distKm.value = (v.dist / 1000).toFixed(3)
  distAz1.value = v.az1.toFixed(2)
  distAz2.value = v.az2.toFixed(2)
  distHav.value = haversineKm(A[0], A[1], B[0], B[1]).toFixed(3)
}

function copyAll() {
  const lines = inputText.value.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const r = convertLine(srcSrid.value, dstSrid.value, trimmed, latOrder.value, gaussBand.value, outFmt.value === 'dms', opts())
    out.push(r.ok && r.out ? r.out.label : '(无法解析) ' + trimmed)
  }
  navigator.clipboard.writeText(out.join('\n'))
}

function exportCsv() {
  const lines = inputText.value.split(/\r?\n/)
  const csvRows: string[][] = [['序号', '源坐标', '转换结果', '值2(Y/lat)', '值1(X/lng)']]
  let n = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    n++
    const r = convertLine(srcSrid.value, dstSrid.value, trimmed, latOrder.value, gaussBand.value, outFmt.value === 'dms', opts())
    if (r.ok && r.out) csvRows.push([String(n), r.src!, r.out.label, String(r.out.b), String(r.out.a)])
    else csvRows.push([String(n), trimmed, '无法解析', '', ''])
  }
  const csv = csvRows.map((rw) => rw.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '坐标转换结果_' + srcSrid.value + '_to_' + dstSrid.value + '.csv'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
}

function loadExample() {
  inputText.value = [
    '116.391428, 39.907547   # 天安门 WGS84',
    '116°23′49″E, 39°54′27″N  # 度分秒',
    '121.4737, 31.2304       # 上海陆家嘴',
    '113.3210, 23.1065       # 广州塔',
    'N 39.9 E 116.4',
    '39500000. 3400000.5     # 高斯(39带) 东 北',
    '50 450000 3400000.5     # UTM 东 北 带号',
  ].join('\n')
  render()
}

function clearAll() {
  inputText.value = ''
  rows.value = []
  statTotal.value = 0
  statOk.value = 0
  statErr.value = 0
  errCount.value = 0
  firstWgs.value = ''
}

renderDist()
</script>
