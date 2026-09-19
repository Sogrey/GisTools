<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  validateGeoJson,
  prettyPrint,
  minify,
  analyzeGeoJson,
  fmtSize,
  fmtNum,
  fmtBbox,
  type ValidationError,
  type GeoJsonMeta,
} from '../utils/geojson-utils'

const router = useRouter()

/* ---- 标签页 ---- */
type TabId = 'validate' | 'format' | 'convert' | 'meta'
const activeTab = ref<TabId>('validate')
const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: 'validate', label: '校验', icon: '✓' },
  { id: 'format', label: '美化/压缩', icon: '≡' },
  { id: 'convert', label: '坐标纠偏', icon: '⊕' },
  { id: 'meta', label: '元数据', icon: 'i' },
]

/* ---- 通用输入 ---- */
const inputText = ref('')
const outputText = ref('')
const msgText = ref('')
const msgType = ref<'ok' | 'err' | 'warn' | ''>('')

function setMsg(text: string, type: 'ok' | 'err' | 'warn' | '' = '') {
  msgText.value = text
  msgType.value = type
}

/* ---- 示例数据 ---- */
const SAMPLE = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: '天安门', cat: '景点' }, geometry: { type: 'Point', coordinates: [116.391428, 39.907547] } },
    {
      type: 'Feature',
      properties: { name: '故宫城墙示意' },
      geometry: { type: 'LineString', coordinates: [[116.397, 39.918], [116.398, 39.916], [116.398, 39.912], [116.397, 39.912]] },
    },
    {
      type: 'Feature',
      properties: { name: '奥林匹克公园' },
      geometry: { type: 'Polygon', coordinates: [[[116.385, 40.002], [116.396, 40.002], [116.396, 39.994], [116.385, 39.994], [116.385, 40.002]]] },
    },
  ],
}, null, 2)

const SAMPLE_INVALID = `{
  "type": "FeatureCollection",
  "bbox": [1, 2, 3],
  "features": [
    {
      "type": "Feature",
      "properties": {},
      "geometry": { "type": "Point", "coordinates": [116.4] }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[[0,0],[0,1],[1,1],[1,0]]] }
    },
    {
      "type": "Feature",
      "properties": {},
      "geometry": { "type": "Line", "coordinates": [[0,0],[1,1]] }
    }
  ]
}`

function loadSample(type: 'valid' | 'invalid' = 'valid') {
  inputText.value = type === 'invalid' ? SAMPLE_INVALID : SAMPLE
  if (activeTab.value === 'validate') doValidate()
  else if (activeTab.value === 'format') doPretty()
  else if (activeTab.value === 'convert') goReproject()
  else doAnalyze()
}

function loadSampleForTab() {
  loadSample(activeTab.value === 'validate' ? 'valid' : 'valid')
}

function clearAll() {
  inputText.value = ''
  outputText.value = ''
  setMsg('')
  validateErrors.value = []
  syntaxError.value = null
  metaResult.value = null
}

async function copyOutput() {
  if (!outputText.value) {
    setMsg('无内容可复制', 'err')
    return
  }
  try {
    await navigator.clipboard.writeText(outputText.value)
    setMsg('已复制', 'ok')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = outputText.value
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch { /* ignore */ }
    document.body.removeChild(ta)
    setMsg('已复制', 'ok')
  }
}

/* ============================================================
 * Tab 1: 校验
 * ============================================================ */
const validateErrors = ref<ValidationError[]>([])
const syntaxError = ref<{ message: string; line: number | null; col: number | null } | null>(null)

function doValidate() {
  syntaxError.value = null
  validateErrors.value = []
  const result = validateGeoJson(inputText.value)
  if (result.syntaxError) {
    syntaxError.value = result.syntaxError
    outputText.value = ''
    setMsg('JSON 语法错误', 'err')
    return
  }
  if (!inputText.value.trim()) {
    setMsg('请先输入 GeoJSON', 'err')
    return
  }
  validateErrors.value = result.errors
  if (result.ok) {
    outputText.value = inputText.value
    setMsg('校验通过', 'ok')
  } else {
    outputText.value = ''
    setMsg(`共发现 ${result.errors.length} 个问题`, 'err')
  }
}

/* ============================================================
 * Tab 2: 美化/压缩
 * ============================================================ */
type FormatMode = 'pretty' | 'minify'
const formatMode = ref<FormatMode>('pretty')
const indentSize = ref(2)

function doPretty() {
  const result = prettyPrint(inputText.value, indentSize.value)
  if (result.error) {
    outputText.value = ''
    setMsg(result.error, 'err')
  } else {
    outputText.value = result.output
    setMsg(`已格式化（${indentSize.value} 空格缩进）`, 'ok')
  }
}

function doMinify() {
  const result = minify(inputText.value)
  if (result.error) {
    outputText.value = ''
    setMsg(result.error, 'err')
  } else {
    outputText.value = result.output
    setMsg(`已压缩：${inputText.value.trim().length} → ${result.output.length} 字符`, 'ok')
  }
}

function doFormat() {
  if (formatMode.value === 'pretty') doPretty()
  else doMinify()
}

/* ============================================================
 * Tab 3: 坐标纠偏（已整合至批量投影变换）
 * ============================================================ */
function goReproject() {
  router.push('/tools/reproject')
}

/* ============================================================
 * Tab 4: 元数据
 * ============================================================ */
const metaResult = ref<GeoJsonMeta | null>(null)
const metaError = ref('')

const geomTypeList = computed(() => {
  if (!metaResult.value) return []
  const entries = Object.entries(metaResult.value.geomTypes)
  const total = entries.reduce((s, [, v]) => s + v, 0)
  return entries
    .map(([type, count]) => ({ type, count, pct: total > 0 ? (count / total * 100).toFixed(1) : '0.0' }))
    .sort((a, b) => b.count - a.count)
})

const fieldList = computed(() => {
  if (!metaResult.value) return []
  return Object.values(metaResult.value.fieldStats)
    .map(fs => ({
      name: fs.name,
      typeOrder: fs.typeOrder,
      nonNullRate: fs.total > 0 ? Math.round((fs.nonNull / fs.total) * 100) : 0,
      uniqueCount: Object.keys(fs.unique).length,
    }))
    .sort((a, b) => b.uniqueCount - a.uniqueCount)
})

const dimText = computed(() => {
  if (!metaResult.value) return '—'
  const { has3D, has2D } = metaResult.value
  if (has3D && has2D) return '2D+3D'
  if (has3D) return '3D'
  if (has2D) return '2D'
  return '—'
})

function doAnalyze() {
  metaError.value = ''
  const result = analyzeGeoJson(inputText.value)
  if (result.error) {
    metaResult.value = null
    metaError.value = result.error
    outputText.value = ''
    setMsg(result.error, 'err')
  } else if (result.meta) {
    metaResult.value = result.meta
    outputText.value = JSON.stringify(JSON.parse(inputText.value), null, 2)
    setMsg('分析完成', 'ok')
  }
}

/* ---- 执行入口 ---- */
function runAction() {
  switch (activeTab.value) {
    case 'validate': doValidate(); break
    case 'format': doFormat(); break
    case 'convert': goReproject(); break
    case 'meta': doAnalyze(); break
  }
}

function goBack() {
  router.push('/')
}
</script>

<template>
  <div class="tool-container">
    <!-- 头部 -->
    <header class="tool-header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M4.16699 10H15.8337M15.8337 10L9.16699 3.33333M15.8337 10L9.16699 16.6667"
            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(180 10 10)" />
        </svg>
        返回首页
      </button>
      <h1 class="page-title">GeoJSON 工具箱</h1>
      <span class="page-subtitle">校验 · 美化 · 纠偏 · 元数据 — 纯前端</span>
    </header>

    <!-- 主内容 -->
    <main class="tool-main">
      <!-- 标签页 -->
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          <span class="tab-icon">{{ tab.icon }}</span>
          {{ tab.label }}
        </button>
      </div>

      <!-- 双栏布局 -->
      <div class="tool-grid">
        <!-- 输入面板 -->
        <section class="panel">
          <div class="panel-head">
            <span class="t">输入 GeoJSON</span>
            <div class="spacer" />
            <button class="btn btn-secondary btn-small" @click="loadSampleForTab">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="inputText"
              class="form-textarea"
              placeholder='粘贴 GeoJSON 文本，例如：&#10;{"type":"FeatureCollection","features":[...]}'
              spellcheck="false"
            />

            <!-- 坐标纠偏：已迁移提示 -->
            <div v-if="activeTab === 'convert'" class="action-row migrate-tip" style="margin-top: 0.5rem">
              <span class="migrate-text">坐标纠偏功能已整合至「批量投影变换」工具</span>
              <button class="btn btn-primary btn-small" @click="goReproject">前往批量投影变换 →</button>
            </div>

            <!-- 美化/压缩参数 -->
            <div v-if="activeTab === 'format'" class="action-row" style="margin-top: 0.5rem">
              <select v-model="formatMode" class="form-select" style="width: auto">
                <option value="pretty">格式化（美化缩进）</option>
                <option value="minify">压缩（去除空白）</option>
              </select>
              <select v-if="formatMode === 'pretty'" v-model.number="indentSize" class="form-select" style="width: auto">
                <option :value="2">2 空格缩进</option>
                <option :value="4">4 空格缩进</option>
                <option :value="1">1 空格缩进</option>
              </select>
            </div>

            <!-- 校验参数 -->
            <div v-if="activeTab === 'validate'" class="action-row" style="margin-top: 0.5rem">
              <button class="btn btn-secondary btn-small" @click="loadSample('invalid')">载入错误示例</button>
            </div>

            <div class="action-row" style="margin-top: 0.25rem">
              <button class="btn btn-primary" @click="runAction">
                {{ activeTab === 'validate' ? '校验' : activeTab === 'format' ? '执行' : activeTab === 'convert' ? '前往批量投影变换' : '分析' }}
              </button>
              <div class="spacer" />
              <span :class="['msg', msgType]">{{ msgText }}</span>
            </div>
          </div>
        </section>

        <!-- 输出面板 -->
        <section class="panel">
          <div class="panel-head">
            <span class="t">
              {{ activeTab === 'validate' ? '校验结果' : activeTab === 'format' ? '格式化输出' : activeTab === 'convert' ? '功能已迁移' : '元数据报告' }}
            </span>
            <div class="spacer" />
            <button class="btn btn-secondary btn-small" @click="copyOutput" v-if="outputText">复制</button>
          </div>
          <div class="panel-body">
            <!-- ===== 校验结果 ===== -->
            <template v-if="activeTab === 'validate'">
              <!-- 语法错误 -->
              <div v-if="syntaxError" class="error-item">
                <div class="error-head">
                  <span class="error-tag">SYNTAX_ERROR</span>
                  <span v-if="syntaxError.line" class="error-line">
                    第 {{ syntaxError.line }} 行{{ syntaxError.col ? '，' + syntaxError.col + ' 列' : '' }}
                  </span>
                </div>
                <div class="error-msg">{{ syntaxError.message }}</div>
                <div class="error-fix">修复 JSON 语法错误后再校验</div>
              </div>
              <!-- 校验通过 -->
              <div v-else-if="validateErrors.length === 0 && inputText.trim() && msgType === 'ok'" class="success-box">
                <span class="check-icon">✓</span> 校验通过
              </div>
              <!-- 错误列表 -->
              <div v-if="validateErrors.length > 0" class="error-list">
                <div class="error-stats">共发现 {{ validateErrors.length }} 个问题</div>
                <div v-for="(er, idx) in validateErrors" :key="idx" class="error-item">
                  <div class="error-head">
                    <span class="error-tag">{{ er.type }}</span>
                    <span class="error-path">{{ er.path }}</span>
                    <span v-if="er.line" class="error-line">第 {{ er.line }} 行</span>
                  </div>
                  <div class="error-msg">{{ er.message }}</div>
                  <div class="error-fix">{{ er.suggestion }}</div>
                </div>
              </div>
              <!-- 空状态 -->
              <div v-if="!syntaxError && validateErrors.length === 0 && !inputText.trim()" class="placeholder">
                输入 GeoJSON 后点击「校验」查看结果
              </div>
            </template>

            <!-- ===== 美化/压缩输出 ===== -->
            <template v-else-if="activeTab === 'format'">
              <textarea v-model="outputText" class="form-textarea" readonly placeholder="格式化结果将显示在这里" />
            </template>

            <!-- ===== 坐标纠偏：迁移提示 ===== -->
            <template v-else-if="activeTab === 'convert'">
              <div class="migrate-box">
                <div class="migrate-icon">⊕</div>
                <div class="migrate-title">坐标纠偏功能已整合至「批量投影变换」工具</div>
                <div class="migrate-desc">批量投影变换支持 WGS84 / GCJ02 / BD09 / Web 墨卡托 互转，覆盖原纠偏能力。</div>
                <button class="btn btn-primary" @click="goReproject">前往批量投影变换 →</button>
              </div>
            </template>

            <!-- ===== 元数据报告 ===== -->
            <template v-else-if="activeTab === 'meta'">
              <div v-if="metaError" class="error-item">
                <div class="error-head"><span class="error-tag">ERROR</span></div>
                <div class="error-msg">{{ metaError }}</div>
              </div>

              <div v-if="metaResult" class="meta-report">
                <!-- 统计卡片 -->
                <div class="result-grid">
                  <div class="result-card">
                    <span class="label">顶层类型</span>
                    <span class="value small">{{ metaResult.topLevelType }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">要素总数</span>
                    <span class="value">{{ metaResult.featureCount }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">坐标点总数</span>
                    <span class="value">{{ metaResult.coordCount }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">坐标维度</span>
                    <span class="value small">{{ dimText }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">字符数</span>
                    <span class="value">{{ metaResult.dataSize.chars }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">数据体积</span>
                    <span class="value small">{{ fmtSize(metaResult.dataSize.bytes) }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">几何类型数</span>
                    <span class="value">{{ Object.keys(metaResult.geomTypes).length }}</span>
                  </div>
                  <div class="result-card">
                    <span class="label">属性字段数</span>
                    <span class="value">{{ Object.keys(metaResult.fieldStats).length }}</span>
                  </div>
                </div>

                <!-- 边界范围 -->
                <div class="meta-section">
                  <div class="meta-section-head">
                    <span class="t">边界范围 BBox</span>
                    <span v-if="metaResult.hasBboxField" class="meta-cnt">含原始 bbox 字段</span>
                  </div>
                  <div class="meta-section-body">
                    <div v-if="metaResult.bbox" class="info-row">
                      <div class="info-item"><span class="k">范围:</span> <span class="v">{{ fmtBbox(metaResult.bbox) }}</span></div>
                      <div class="info-item"><span class="k">minX:</span> <span class="v">{{ fmtNum(metaResult.bbox.minX, 6) }}</span></div>
                      <div class="info-item"><span class="k">minY:</span> <span class="v">{{ fmtNum(metaResult.bbox.minY, 6) }}</span></div>
                      <div class="info-item"><span class="k">maxX:</span> <span class="v">{{ fmtNum(metaResult.bbox.maxX, 6) }}</span></div>
                      <div class="info-item"><span class="k">maxY:</span> <span class="v">{{ fmtNum(metaResult.bbox.maxY, 6) }}</span></div>
                      <template v-if="metaResult.bbox.minZ !== undefined">
                        <div class="info-item"><span class="k">minZ:</span> <span class="v">{{ fmtNum(metaResult.bbox.minZ, 3) }}</span></div>
                        <div class="info-item"><span class="k">maxZ:</span> <span class="v">{{ fmtNum(metaResult.bbox.maxZ, 3) }}</span></div>
                      </template>
                      <div class="info-item"><span class="k">宽度°:</span> <span class="v">{{ fmtNum(metaResult.bbox.maxX - metaResult.bbox.minX, 6) }}</span></div>
                      <div class="info-item"><span class="k">高度°:</span> <span class="v">{{ fmtNum(metaResult.bbox.maxY - metaResult.bbox.minY, 6) }}</span></div>
                    </div>
                    <div v-else class="info-row"><span style="color: #606060">未检测到有效坐标</span></div>
                    <div v-if="metaResult.hasBboxField" style="padding: 0 14px 10px">
                      <div style="font-size: 11.5px; color: #606060; margin-bottom: 4px">原始 bbox 字段（来自数据）：</div>
                      <code class="bbox-code">{{ JSON.stringify(metaResult.bboxField) }}</code>
                    </div>
                  </div>
                </div>

                <!-- 几何类型统计 -->
                <div v-if="geomTypeList.length > 0" class="meta-section">
                  <div class="meta-section-head">
                    <span class="t">几何类型统计</span>
                    <span class="meta-cnt">{{ geomTypeList.length }} 种</span>
                  </div>
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>几何类型</th>
                        <th style="width: 80px; text-align: right">数量</th>
                        <th style="width: 100px; text-align: right">占比</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="item in geomTypeList" :key="item.type">
                        <td><span class="geom-tag" :class="geomTagClass(item.type)">{{ item.type }}</span></td>
                        <td style="text-align: right; font-family: monospace">{{ item.count }}</td>
                        <td style="text-align: right; font-family: monospace">{{ item.pct }}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- 属性字段列表 -->
                <div class="meta-section">
                  <div class="meta-section-head">
                    <span class="t">属性字段列表</span>
                    <span class="meta-cnt">{{ fieldList.length }} 个字段</span>
                  </div>
                  <table v-if="fieldList.length > 0" class="data-table">
                    <thead>
                      <tr>
                        <th>字段名</th>
                        <th>类型</th>
                        <th style="width: 110px">非空率</th>
                        <th style="width: 70px; text-align: right">唯一值</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="field in fieldList" :key="field.name">
                        <td style="font-family: monospace">{{ field.name }}</td>
                        <td>
                          <span v-for="t in field.typeOrder" :key="t" class="type-tag" :class="typeTagClass(t)">{{ t }}</span>
                        </td>
                        <td>
                          <div class="bar-wrap">
                            <div class="bar-fill" :class="barClass(field.nonNullRate)" :style="{ width: field.nonNullRate + '%' }" />
                          </div>
                          <span class="bar-text">{{ field.nonNullRate }}%</span>
                        </td>
                        <td style="text-align: right; font-family: monospace">{{ field.uniqueCount }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div v-else class="info-row"><span style="color: #606060">无属性字段（可能是纯几何体或 properties 为空）</span></div>
                </div>

                <!-- CRS 信息 -->
                <div v-if="metaResult.hasCrs" class="meta-section">
                  <div class="meta-section-head">
                    <span class="t">CRS 信息</span>
                    <span class="meta-cnt">已废弃字段</span>
                  </div>
                  <div class="meta-section-body">
                    <div style="font-size: 11.5px; color: #606060; margin-bottom: 6px">
                      注意：crs 字段在 RFC 7946 中已废弃，建议改用数据外部的坐标系元信息
                    </div>
                    <code class="bbox-code">{{ metaResult.crsInfo }}</code>
                  </div>
                </div>
              </div>

              <div v-if="!metaResult && !metaError" class="placeholder">
                粘贴 GeoJSON 后点击「分析」查看元数据报告
              </div>
            </template>
          </div>
        </section>
      </div>

      <footer class="tool-footer">
        支持 FeatureCollection / Feature / Geometry 单对象；坐标纠偏只修改 [lng, lat] 前两值（保留高程）；所有几何类型坐标递归处理 — 纯前端，数据不出本机
      </footer>
    </main>
  </div>
</template>

<script lang="ts">
function geomTagClass(type: string): string {
  if (type === 'Point' || type === 'MultiPoint') return 'point'
  if (type === 'LineString' || type === 'MultiLineString') return 'line'
  if (type === 'Polygon' || type === 'MultiPolygon') return 'poly'
  if (type === 'GeometryCollection') return 'coll'
  return ''
}
function typeTagClass(t: string): string {
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  if (t === 'null') return 'null'
  return 'object'
}
function barClass(pct: number): string {
  if (pct === 0) return 'zero'
  if (pct < 50) return 'low'
  return ''
}
export default { name: 'GeoJsonToolView' }
</script>

<style scoped>
/* 标签图标 */
.tab-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
}

.tab.active .tab-icon {
  background: rgba(255, 255, 255, 0.15);
}

/* 占位 */
.placeholder {
  text-align: center;
  color: #606060;
  font-size: 0.8125rem;
  padding: 3rem 1rem;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 校验结果样式 */
.success-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #10b981;
  font-weight: 600;
  font-size: 1rem;
  padding: 1rem;
}

.check-icon {
  font-size: 1.5rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: rgba(16, 185, 129, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  max-height: 500px;
}

.error-stats {
  font-size: 0.75rem;
  color: #a0a0a0;
  margin-bottom: 0.25rem;
}

.error-item {
  background: rgba(239, 68, 68, 0.08);
  border-left: 3px solid #ef4444;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
}

.error-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.error-tag {
  font-weight: 600;
  color: #ef4444;
  font-size: 0.6875rem;
  background: rgba(239, 68, 68, 0.12);
  padding: 0.0625rem 0.375rem;
  border-radius: 3px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.error-path {
  color: #a0a0a0;
  font-family: Consolas, monospace;
  font-size: 0.75rem;
  word-break: break-all;
}

.error-line {
  color: #667eea;
  font-size: 0.6875rem;
  font-family: Consolas, monospace;
}

.error-msg {
  color: #ffffff;
  font-size: 0.8125rem;
  margin-top: 0.1875rem;
}

.error-fix {
  color: #667eea;
  font-size: 0.75rem;
  margin-top: 0.125rem;
}

.error-fix::before {
  content: "建议: ";
}

/* 元数据报告 */
.meta-report {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 560px;
}

.meta-section {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  overflow: hidden;
}

.meta-section-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(102, 126, 234, 0.05);
}

.meta-section-head .t {
  font-weight: 700;
  font-size: 0.8125rem;
  color: #ffffff;
}

.meta-cnt {
  margin-left: auto;
  font-size: 0.6875rem;
  color: #606060;
  font-family: Consolas, monospace;
}

.meta-section-body {
  padding: 0.75rem;
}

.info-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 0.875rem;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.info-item .k {
  color: #606060;
  font-size: 0.75rem;
}

.info-item .v {
  color: #ffffff;
  font-weight: 600;
  font-size: 0.8125rem;
  font-family: Consolas, monospace;
}

.bbox-code {
  font-family: Consolas, monospace;
  font-size: 0.75rem;
  color: #a0a0a0;
  display: block;
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  word-break: break-all;
}

/* 几何类型标签 */
.geom-tag {
  display: inline-block;
  padding: 0.0625rem 0.4375rem;
  border-radius: 5px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.geom-tag.point { background: rgba(25, 118, 210, 0.15); color: #5aa0f5; }
.geom-tag.line { background: rgba(46, 125, 50, 0.15); color: #4caf50; }
.geom-tag.poly { background: rgba(230, 81, 0, 0.15); color: #ff9800; }
.geom-tag.multi { background: rgba(123, 31, 162, 0.15); color: #ce93d8; }
.geom-tag.coll { background: rgba(93, 64, 55, 0.15); color: #bcaaa4; }

/* 属性类型标签 */
.type-tag {
  display: inline-block;
  padding: 0.0625rem 0.4375rem;
  border-radius: 5px;
  font-size: 0.6875rem;
  font-weight: 600;
  margin-right: 0.1875rem;
}

.type-tag.string { background: rgba(102, 126, 234, 0.12); color: #667eea; }
.type-tag.number { background: rgba(46, 125, 50, 0.12); color: #4caf50; }
.type-tag.boolean { background: rgba(230, 81, 0, 0.12); color: #ff9800; }
.type-tag.null { background: rgba(150, 150, 150, 0.12); color: #999; }
.type-tag.object { background: rgba(198, 40, 40, 0.12); color: #ef5350; }

/* 非空率进度条 */
.bar-wrap {
  position: relative;
  width: 60px;
  height: 14px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  display: inline-block;
  vertical-align: middle;
}

.bar-fill {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: #667eea;
  border-radius: 3px;
}

.bar-fill.low { background: #f59e0b; }
.bar-fill.zero { background: #ef4444; }

.bar-text {
  font-size: 0.6875rem;
  font-family: Consolas, monospace;
  margin-left: 5px;
  vertical-align: middle;
  color: #a0a0a0;
}

/* 结果卡片值小字 */
.result-card .value.small {
  font-size: 0.8125rem;
}

/* 表格 */
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
}

.data-table th {
  background: rgba(102, 126, 234, 0.08);
  color: #667eea;
  font-weight: 600;
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.data-table td {
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.04);
  color: #a0a0a0;
}

.data-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

/* 纠偏迁移提示 */
.migrate-tip {
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.migrate-text {
  font-size: 0.8125rem;
  color: #a0a0a0;
}
.migrate-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  text-align: center;
}
.migrate-icon {
  font-size: 2rem;
  color: #667eea;
}
.migrate-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #ffffff;
}
.migrate-desc {
  font-size: 0.8125rem;
  color: #a0a0a0;
  max-width: 360px;
  line-height: 1.5;
}

/* 响应式 */
@media (max-width: 880px) {
  .tool-container {
    padding: 1rem;
  }
}
</style>
