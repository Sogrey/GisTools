<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">坐标清洗</h1>
      <span class="page-subtitle">精度控制 · 去重 · 越界检测 · 离群点 · 排序</span>
    </div>
    <div class="tool-main">
      <!-- 主标签页 -->
      <div class="tabs" style="margin-bottom: 1rem;">
        <button class="tab" :class="{ active: tab === 'precision' }" @click="tab = 'precision'">精度控制</button>
        <button class="tab" :class="{ active: tab === 'clean' }" @click="tab = 'clean'">去重清洗</button>
      </div>

      <!-- 精度控制 -->
      <div v-if="tab === 'precision'">
        <div class="panel" style="margin-bottom: 1rem;">
          <div class="panel-head"><span class="t">精度控制选项</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom: 0.5rem;">
              <label class="form-label" style="margin: 0;">模式</label>
              <div class="tabs" style="padding: 0;">
                <button class="tab" :class="{ active: pMode === 'truncate' }" @click="pMode = 'truncate'">截断（去尾）</button>
                <button class="tab" :class="{ active: pMode === 'round' }" @click="pMode = 'round'">四舍五入</button>
                <button class="tab" :class="{ active: pMode === 'original' }" @click="pMode = 'original'">保留原值</button>
              </div>
              <label class="form-label" style="margin: 0;">小数位</label>
              <input type="range" v-model.number="pPrecision" min="0" max="10" style="width: 180px; accent-color: #667eea;" :disabled="pMode === 'original'" />
              <span style="font-family: Consolas, monospace; font-size: 0.875rem; font-weight: 700; color: #667eea; min-width: 46px; text-align: center; background: rgba(102,126,234,0.1); border-radius: 6px; padding: 2px 8px;">{{ pPrecision }}</span>
              <label class="form-label" style="margin: 0;">分隔符</label>
              <select class="form-select" v-model="pSep" style="width: 130px;">
                <option value="auto">自动识别</option>
                <option value=",">英文逗号 ,</option>
                <option value=" ">空格</option>
                <option value="\t">Tab</option>
                <option value="，">中文逗号 ，</option>
              </select>
            </div>
            <div class="action-row">
              <button class="btn btn-secondary btn-small" @click="loadPrecisionExample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearPrecision">清空</button>
              <button class="btn btn-primary" @click="runPrecision">处理</button>
            </div>
          </div>
        </div>

        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head"><span class="t">输入坐标</span><div class="spacer"></div><span class="form-hint">{{ pInputLines }} 行</span></div>
            <div class="panel-body">
              <textarea v-model="pInput" class="form-textarea" placeholder="粘贴坐标文本，每行一组 lng,lat 或 lng lat&#10;支持逗号 / 空格 / Tab / 中文逗号分隔"></textarea>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="t">输出结果</span><div class="spacer"></div><span class="form-hint">{{ pStats.groups }} 行</span><button class="btn btn-secondary btn-small" @click="copyPrecision">复制</button></div>
            <div class="panel-body">
              <textarea v-model="pOutput" class="form-textarea" readonly placeholder="点击「处理」按钮生成结果…"></textarea>
            </div>
          </div>
        </div>

        <div class="action-row" style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(102,126,234,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 0.8125rem; color: #a0a0a0;">
          <span>处理坐标组 <b style="color:#667eea; font-size: 1rem; font-family: Consolas,monospace;">{{ pStats.groups }}</b></span>
          <span>总坐标数 <b style="color:#667eea; font-size: 1rem; font-family: Consolas,monospace;">{{ pStats.coords }}</b></span>
          <span>发生变化 <b style="color:#667eea; font-size: 1rem; font-family: Consolas,monospace;">{{ pStats.changed }}</b></span>
          <span style="margin-left: auto; color: #606060;">{{ pModeLabel }}</span>
        </div>
      </div>

      <!-- 去重清洗 -->
      <div v-if="tab === 'clean'">
        <div class="panel" style="margin-bottom: 1rem;">
          <div class="panel-head"><span class="t">清洗选项</span></div>
          <div class="panel-body">
            <!-- 去重 -->
            <div class="form-group">
              <label class="form-label"><input type="checkbox" v-model="cDedup" style="accent-color: #667eea; margin-right: 0.375rem;" />去重</label>
              <div style="margin-left: 1.5rem;">
                <label class="form-label">精度容差: <b style="color: #667eea;">{{ cDedupTolLabel }}</b>°</label>
                <input type="range" v-model.number="cDedupSlider" min="0" max="7" step="1" style="width: 200px; accent-color: #667eea;" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><input type="checkbox" v-model="cAnomaly" style="accent-color: #667eea; margin-right: 0.375rem;" />异常值检测</label>
              <div style="margin-left: 1.5rem;">
                <label class="form-label"><input type="checkbox" v-model="cAnomalyDel" style="accent-color: #667eea; margin-right: 0.375rem;" />删除越界坐标</label>
                <span class="form-hint">经度 [-180,180] / 纬度 [-90,90]</span>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><input type="checkbox" v-model="cOutlier" style="accent-color: #667eea; margin-right: 0.375rem;" />离群点检测</label>
              <div style="margin-left: 1.5rem;">
                <label class="form-label">距离倍数: <b style="color: #667eea;">{{ cOutlierFactor.toFixed(1) }}</b>×</label>
                <input type="range" v-model.number="cOutlierFactor" min="1.5" max="10" step="0.5" style="width: 200px; accent-color: #667eea;" />
                <label class="form-label" style="margin-top: 0.25rem;"><input type="checkbox" v-model="cOutlierDel" style="accent-color: #667eea; margin-right: 0.375rem;" />删除离群点</label>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label"><input type="checkbox" v-model="cSort" style="accent-color: #667eea; margin-right: 0.375rem;" />排序</label>
              <div style="margin-left: 1.5rem;">
                <select class="form-select" v-model="cSortBy" style="width: 160px;">
                  <option value="lng">按经度排序</option>
                  <option value="lat">按纬度排序</option>
                </select>
              </div>
            </div>
            <div class="action-row">
              <button class="btn btn-secondary btn-small" @click="loadCleanExample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearClean">清空</button>
              <button class="btn btn-primary" @click="runClean">执行清洗</button>
            </div>
          </div>
        </div>

        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head"><span class="t">输入坐标 (lng,lat 每行一对)</span></div>
            <div class="panel-body">
              <textarea v-model="cInput" class="form-textarea" placeholder="粘贴坐标文本，每行格式: 经度,纬度"></textarea>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="t">清洗结果</span><div class="spacer"></div><button class="btn btn-secondary btn-small" @click="copyClean">复制</button><button class="btn btn-secondary btn-small" @click="downloadClean">下载</button></div>
            <div class="panel-body">
              <textarea v-model="cOutput" class="form-textarea" readonly placeholder="点击「执行清洗」查看结果..."></textarea>
            </div>
          </div>
        </div>

        <div class="action-row" style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(102,126,234,0.05); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; font-size: 0.8125rem; color: #a0a0a0; flex-wrap: wrap;">
          <span>原始行数 <b style="color:#667eea; font-size: 1rem; font-family: Consolas,monospace;">{{ cStats.original }}</b></span>
          <span>最终行数 <b style="color:#667eea; font-size: 1rem; font-family: Consolas,monospace;">{{ cStats.final }}</b></span>
          <span>去重 <b style="color:#10b981; font-size: 1rem; font-family: Consolas,monospace;">{{ cStats.dedup }}</b></span>
          <span>异常 <b style="color:#ef4444; font-size: 1rem; font-family: Consolas,monospace;">{{ cStats.anomaly }}</b></span>
          <span>离群 <b style="color:#f59e0b; font-size: 1rem; font-family: Consolas,monospace;">{{ cStats.outlier }}</b></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { processPrecision, cleanCoords } from '../utils/coord-clean'
import type { PrecisionMode, PrecisionStats, CleanStats } from '../utils/coord-clean'

const router = useRouter()
const goBack = () => router.push('/')

const tab = ref<'precision' | 'clean'>('precision')

// ---- 精度控制 ----
const pMode = ref<PrecisionMode>('truncate')
const pPrecision = ref(6)
const pSep = ref('auto')
const pInput = ref('')
const pOutput = ref('')
const pStats = ref<PrecisionStats>({ groups: 0, coords: 0, changed: 0 })

const pInputLines = computed(() => pInput.value.split(/\r?\n/).filter((l) => l.trim()).length)
const pModeLabel = computed(() => {
  const labels: Record<PrecisionMode, string> = { truncate: '截断（去尾）', round: '四舍五入', original: '保留原值' }
  if (pMode.value === 'original') return '模式：' + labels[pMode.value] + '（不改变数值）'
  return '模式：' + labels[pMode.value] + ' · 精度：' + pPrecision.value + ' 位小数'
})

function runPrecision() {
  if (!pInput.value.trim()) return
  const result = processPrecision(pInput.value, pMode.value, pPrecision.value, pSep.value)
  pOutput.value = result.output
  pStats.value = result.stats
}

function loadPrecisionExample() {
  pInput.value = [
    '116.407396, 39.904200', '121.473701 31.230416', '113.264353，23.129112',
    '108.939770\t34.341060', '120.155073, 30.274084', '114.057868 22.543099',
    '104.066801, 30.572260', '106.551556 29.563009',
  ].join('\n')
  runPrecision()
}

function clearPrecision() {
  pInput.value = ''; pOutput.value = ''; pStats.value = { groups: 0, coords: 0, changed: 0 }
}

function copyPrecision() {
  if (!pOutput.value) return
  navigator.clipboard.writeText(pOutput.value)
}

// ---- 去重清洗 ----
const cDedup = ref(true)
const cDedupSlider = ref(7)
const cAnomaly = ref(true)
const cAnomalyDel = ref(true)
const cOutlier = ref(false)
const cOutlierFactor = ref(3)
const cOutlierDel = ref(false)
const cSort = ref(false)
const cSortBy = ref<'lng' | 'lat'>('lng')
const cInput = ref('')
const cOutput = ref('')
const cStats = ref<CleanStats>({ final: 0, dedup: 0, anomaly: 0, outlier: 0, parseFail: 0, original: 0 })

const cDedupTolLabel = computed(() => cDedupSlider.value === 0 ? '0(精确)' : '1e-' + cDedupSlider.value)

function runClean() {
  if (!cInput.value.trim()) return
  const result = cleanCoords(cInput.value, {
    dedup: cDedup.value,
    dedupTol: Math.pow(10, -cDedupSlider.value),
    anomaly: cAnomaly.value,
    anomalyDel: cAnomalyDel.value,
    outlier: cOutlier.value,
    outlierFactor: cOutlierFactor.value,
    outlierDel: cOutlierDel.value,
    sort: cSort.value,
    sortBy: cSortBy.value,
  })
  cOutput.value = result.output
  cStats.value = result.stats
}

const CLEAN_EXAMPLE = [
  '116.404,39.915', '121.474,31.230', '113.264,23.129', '120.153,30.267',
  '114.057,22.543', '116.404,39.915', '118.778,32.061', '117.201,39.084',
  '108.940,34.341', '113.264,23.129', '200.123,31.230', '116.404,95.000',
  '123.456,41.835', '126.632,45.748', '125.324,43.886', '101.778,36.623',
  '106.278,38.473', '103.834,36.061', '87.617,43.826', '91.132,29.660',
  '116.4040001,39.9150001', '114.305,30.593', '112.982,28.194',
  '110.331,20.022', '109.512,18.253', '116.404,39.915',
].join('\n')

function loadCleanExample() {
  cInput.value = CLEAN_EXAMPLE
  runClean()
}

function clearClean() {
  cInput.value = ''; cOutput.value = ''
  cStats.value = { final: 0, dedup: 0, anomaly: 0, outlier: 0, parseFail: 0, original: 0 }
}

function copyClean() {
  if (!cOutput.value) return
  navigator.clipboard.writeText(cOutput.value)
}

function downloadClean() {
  if (!cOutput.value) return
  const blob = new Blob([cOutput.value], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'cleaned-coords.csv'
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>
