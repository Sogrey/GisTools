<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">表格转换工具</h1>
      <span class="page-subtitle">CSV / Excel / GeoJSON 双向转换 · 纯前端</span>
    </div>

    <!-- 主内容 -->
    <div class="tool-main">
      <!-- 标签页 -->
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 't2g' }"
          @click="activeTab = 't2g'"
        >
          表 → GeoJSON
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'g2t' }"
          @click="activeTab = 'g2t'"
        >
          GeoJSON → CSV
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'e2j' }"
          @click="activeTab = 'e2j'"
        >
          Excel → JSON
        </button>
      </div>

      <!-- ========== 标签页 1：表 → GeoJSON ========== -->
      <div v-show="activeTab === 't2g'" class="tab-panel">
        <div class="tool-grid">
          <section class="panel">
            <div class="panel-head">
              <span class="t">输入点表（粘贴）</span>
              <span class="spacer"></span>
              <button class="btn btn-secondary btn-small" @click="loadSampleT2G">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearT2G">清空</button>
            </div>
            <div class="panel-body">
              <textarea
                class="form-textarea"
                v-model="t2gInput"
                placeholder="粘贴 CSV/Excel 复制的点表：&#10;&#10;名称,经度,纬度,备注&#10;天安门,116.391428,39.907547,北京&#10;东方明珠,121.499797,31.239677,上海&#10;&#10;支持逗号/Tab/分号分隔；首行可作表头；字段名可含：name/名称/lng/经度/lat/纬度/x/y/easting/northing"
              ></textarea>
              <div class="action-row">
                <span class="field-label">经度列</span>
                <select class="form-select select-sm" v-model="t2gColLng">
                  <option value="auto">自动识别</option>
                  <option value="0">第 1 列</option>
                  <option value="1">第 2 列</option>
                  <option value="2">第 3 列</option>
                  <option value="3">第 4 列</option>
                </select>
                <span class="field-label">纬度列</span>
                <select class="form-select select-sm" v-model="t2gColLat">
                  <option value="auto">自动识别</option>
                  <option value="0">第 1 列</option>
                  <option value="1">第 2 列</option>
                  <option value="2">第 3 列</option>
                  <option value="3">第 4 列</option>
                </select>
                <span class="field-label">名称列</span>
                <select class="form-select select-sm" v-model="t2gColName">
                  <option value="auto">自动识别</option>
                  <option value="0">第 1 列</option>
                  <option value="1">第 2 列</option>
                  <option value="2">第 3 列</option>
                  <option value="3">第 4 列</option>
                </select>
              </div>
              <div class="action-row">
                <label class="check-label">
                  <input type="checkbox" v-model="t2gHasHeader" />首行为表头
                </label>
                <label class="check-label">
                  <input type="checkbox" v-model="t2gLatLngOrder" />列顺序为 纬度,经度
                </label>
                <button class="btn btn-primary" @click="runT2G">转换</button>
                <span class="msg" :class="t2gMsgType">{{ t2gMsg }}</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <span class="t">输出 GeoJSON</span>
              <span class="spacer"></span>
              <button class="btn btn-secondary btn-small" @click="copyT2G">复制</button>
              <button class="btn btn-secondary btn-small" @click="downloadT2G">下载 .geojson</button>
            </div>
            <div class="panel-body">
              <div class="result-grid" v-if="t2gStats">
                <div class="result-card">
                  <span class="label">要素</span>
                  <span class="value">{{ t2gStats.features }}</span>
                </div>
                <div class="result-card">
                  <span class="label">属性字段</span>
                  <span class="value">{{ t2gStats.props }}</span>
                </div>
                <div class="result-card">
                  <span class="label">体积</span>
                  <span class="value">{{ t2gStats.size }}</span>
                </div>
              </div>
              <textarea
                class="form-textarea"
                v-model="t2gOutput"
                readonly
                placeholder="转换结果将显示在这里"
              ></textarea>
            </div>
          </section>
        </div>
      </div>

      <!-- ========== 标签页 2：GeoJSON → CSV ========== -->
      <div v-show="activeTab === 'g2t'" class="tab-panel">
        <div class="tool-grid">
          <section class="panel">
            <div class="panel-head">
              <span class="t">输入 GeoJSON</span>
              <span class="spacer"></span>
              <button class="btn btn-secondary btn-small" @click="loadSampleG2T">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearG2T">清空</button>
            </div>
            <div class="panel-body">
              <textarea
                class="form-textarea"
                v-model="g2tInput"
                placeholder="粘贴 GeoJSON FeatureCollection 文本...（Ctrl+Enter 快捷导出）"
                @keydown.ctrl.enter.prevent="runG2T"
                @keydown.meta.enter.prevent="runG2T"
              ></textarea>
              <div class="action-row">
                <span class="field-label">几何列</span>
                <select class="form-select select-sm" v-model="g2tGeomMode" @change="rerunG2T">
                  <option value="wkt">WKT 格式</option>
                  <option value="lonlat">经纬度分列 (lon/lat)</option>
                  <option value="none">不含几何</option>
                </select>
                <label class="check-label">
                  <input type="checkbox" v-model="g2tAddBom" @change="rerunG2T" />
                  添加 UTF-8 BOM（Excel 中文不乱码）
                </label>
                <button class="btn btn-primary" @click="runG2T">导出 CSV</button>
                <span class="msg" :class="g2tMsgType">{{ g2tMsg }}</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <span class="t">输出 CSV</span>
              <span class="spacer"></span>
              <button class="btn btn-secondary btn-small" @click="copyG2T">复制</button>
              <button class="btn btn-secondary btn-small" @click="downloadG2T">下载 .csv</button>
            </div>
            <div class="panel-body">
              <div class="result-grid" v-if="g2tStats">
                <div class="result-card">
                  <span class="label">要素</span>
                  <span class="value">{{ g2tStats.features }}</span>
                </div>
                <div class="result-card">
                  <span class="label">字段</span>
                  <span class="value">{{ g2tStats.fields }}</span>
                </div>
                <div class="result-card">
                  <span class="label">行</span>
                  <span class="value">{{ g2tStats.rows }}</span>
                </div>
                <div class="result-card">
                  <span class="label">大小</span>
                  <span class="value">{{ g2tStats.size }}</span>
                </div>
              </div>
              <textarea
                class="form-textarea"
                v-model="g2tOutput"
                readonly
                placeholder="点击「导出 CSV」生成结果..."
              ></textarea>
            </div>
          </section>
        </div>
      </div>

      <!-- ========== 标签页 3：Excel → JSON ========== -->
      <div v-show="activeTab === 'e2j'" class="tab-panel">
        <div class="tool-grid">
          <section class="panel">
            <div class="panel-head">
              <span class="t">输入表格</span>
              <span class="spacer"></span>
              <button class="btn btn-secondary btn-small" @click="loadSampleE2J">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearE2J">清空</button>
            </div>
            <div class="panel-body">
              <textarea
                class="form-textarea"
                v-model="e2jInput"
                placeholder="在此粘贴 Excel / 表格文本…&#10;&#10;示例：&#10;姓名&lt;Tab&gt;年龄&lt;Tab&gt;城市&lt;Tab&gt;在职&#10;张三&lt;Tab&gt;28&lt;Tab&gt;北京&lt;Tab&gt;true&#10;李四&lt;Tab&gt;35&lt;Tab&gt;上海&lt;Tab&gt;true"
              ></textarea>
              <div class="action-row options-row">
                <span class="field-label">分隔符</span>
                <select class="form-select select-sm" v-model="e2jDelimiter">
                  <option value="auto">自动检测</option>
                  <option value="\t">Tab</option>
                  <option value=",">逗号 ,</option>
                  <option value=";">分号 ;</option>
                  <option value="，">中文逗号 ，</option>
                  <option value="|">竖线 |</option>
                </select>
                <label class="check-label">
                  <input type="checkbox" v-model="e2jHasHeader" />首行表头
                </label>
                <label class="check-label">
                  <input type="checkbox" v-model="e2jInferTypes" />类型推断
                </label>
                <span class="field-label">输出模式</span>
                <select class="form-select select-sm" v-model="e2jOutputMode">
                  <option value="array">JSON 数组 [{...}]</option>
                  <option value="object">JSON 对象 {key: value}</option>
                </select>
                <span v-show="e2jOutputMode === 'object'" class="field-label">键列</span>
                <select
                  v-show="e2jOutputMode === 'object'"
                  class="form-select select-sm"
                  v-model="e2jKeyColumn"
                >
                  <option
                    v-for="opt in e2jColOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </option>
                </select>
                <span class="field-label">缩进</span>
                <select class="form-select select-sm" v-model="e2jIndent">
                  <option value="2">2 空格</option>
                  <option value="4">4 空格</option>
                  <option value="0">压缩</option>
                </select>
              </div>
              <div class="action-row">
                <button class="btn btn-primary" @click="runE2J">转换 →</button>
                <span class="msg" :class="e2jMsgType">{{ e2jMsg }}</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <span class="t">输出 JSON</span>
              <span class="spacer"></span>
              <button class="btn btn-secondary btn-small" @click="copyE2J">复制</button>
              <button class="btn btn-secondary btn-small" @click="downloadE2J">下载 .json</button>
            </div>
            <div class="panel-body">
              <div class="result-grid" v-if="e2jStats">
                <div class="result-card">
                  <span class="label">维度</span>
                  <span class="value">{{ e2jStats.dimensions }}</span>
                </div>
                <div class="result-card">
                  <span class="label">记录</span>
                  <span class="value">{{ e2jStats.records }}</span>
                </div>
              </div>
              <textarea
                class="form-textarea"
                v-model="e2jOutput"
                readonly
                placeholder="转换结果将显示在此处..."
              ></textarea>
            </div>
          </section>
        </div>
      </div>

      <!-- 底部说明 -->
      <div class="tool-footer">
        自动识别表头名称（name/名称、lng/经度、lat/纬度 等）；坐标列支持度分秒 · CSV 遵循 RFC 4180 转义规范 · 所有处理在浏览器本地完成
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  tableToGeoJson,
  geojsonToCsv,
  autoDetectDelimiter,
  getDelimiter,
  parseTable,
  convertToJSON,
  fmtSize,
  type NumberOrAuto,
  type GeomMode,
} from '@/utils/table-convert'

const router = useRouter()
const goBack = () => router.push('/')

/* ---- 标签页状态 ---- */
const activeTab = ref<'t2g' | 'g2t' | 'e2j'>('t2g')

/* ============================================================
 * 标签页 1：表 → GeoJSON
 * ============================================================ */

const t2gInput = ref('')
const t2gOutput = ref('')
const t2gColLng = ref('auto')
const t2gColLat = ref('auto')
const t2gColName = ref('auto')
const t2gHasHeader = ref(true)
const t2gLatLngOrder = ref(false)
const t2gMsg = ref('')
const t2gMsgType = ref<'' | 'ok' | 'err'>('')
const t2gStats = ref<{ features: number; props: number; size: string } | null>(null)

const T2G_SAMPLE = `名称,经度,纬度,备注
天安门,116.391428,39.907547,北京
东方明珠,121.499797,31.239677,上海
广州塔,113.324521,23.106529,广州
大雁塔,108.964238,34.222755,西安`

function runT2G() {
  if (!t2gInput.value.trim()) {
    t2gMsg.value = '请粘贴点表数据'
    t2gMsgType.value = 'err'
    return
  }
  try {
    const res = tableToGeoJson(t2gInput.value, {
      hasHeader: t2gHasHeader.value,
      lngIdx: (t2gColLng.value === 'auto' ? 'auto' : parseInt(t2gColLng.value, 10)) as NumberOrAuto,
      latIdx: (t2gColLat.value === 'auto' ? 'auto' : parseInt(t2gColLat.value, 10)) as NumberOrAuto,
      nameIdx: (t2gColName.value === 'auto' ? 'auto' : parseInt(t2gColName.value, 10)) as NumberOrAuto,
      latLngOrder: t2gLatLngOrder.value,
    })
    if ('error' in res) {
      t2gMsg.value = res.error
      t2gMsgType.value = 'err'
      return
    }
    t2gOutput.value = JSON.stringify(res, null, 2)
    const propsCount = res.features.length > 0 ? Object.keys(res.features[0]!.properties).length : 0
    t2gStats.value = {
      features: res.features.length,
      props: propsCount,
      size: fmtSize(t2gOutput.value.length),
    }
    t2gMsg.value = `已生成 ${res.features.length} 个点要素`
    t2gMsgType.value = 'ok'
  } catch (e) {
    t2gMsg.value = '解析失败: ' + (e instanceof Error ? e.message : String(e))
    t2gMsgType.value = 'err'
  }
}

function loadSampleT2G() {
  t2gInput.value = T2G_SAMPLE
  t2gHasHeader.value = true
  t2gColLng.value = 'auto'
  t2gColLat.value = 'auto'
  t2gColName.value = 'auto'
  runT2G()
}

function clearT2G() {
  t2gInput.value = ''
  t2gOutput.value = ''
  t2gMsg.value = ''
  t2gMsgType.value = ''
  t2gStats.value = null
}

function copyT2G() {
  copyToClipboard(t2gOutput.value, t2gMsg, t2gMsgType)
}

function downloadT2G() {
  if (!t2gOutput.value) return
  downloadFile(t2gOutput.value, 'points.geojson', 'application/geo+json;charset=utf-8')
}

/* ============================================================
 * 标签页 2：GeoJSON → CSV
 * ============================================================ */

const g2tInput = ref('')
const g2tOutput = ref('')
const g2tGeomMode = ref<GeomMode>('wkt')
const g2tAddBom = ref(false)
const g2tMsg = ref('')
const g2tMsgType = ref<'' | 'ok' | 'err'>('')
const g2tStats = ref<{ features: number; fields: number; rows: number; size: string } | null>(null)
let g2tParsed: unknown = null
let g2tHasResult = false

const G2T_SAMPLE = JSON.stringify(
  {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '天安门', category: '地标', id: 1, rating: 4.8 },
        geometry: { type: 'Point', coordinates: [116.397128, 39.916527] },
      },
      {
        type: 'Feature',
        properties: {
          name: '故宫博物院',
          category: '地标',
          id: 2,
          rating: 4.9,
          visitors: 19000000,
          note: '世界文化遗产,含珍宝馆',
        },
        geometry: { type: 'Point', coordinates: [116.403747, 39.915399] },
      },
      {
        type: 'Feature',
        properties: { name: '二环路', category: '道路', id: 3, length_km: 32.8, note: '城市环路\n含辅路' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [116.35, 39.95],
            [116.4, 39.92],
            [116.45, 39.9],
          ],
        },
      },
    ],
  },
  null,
  2,
)

function runG2T() {
  g2tMsg.value = ''
  g2tMsgType.value = ''
  const text = g2tInput.value.trim()
  if (!text) {
    g2tMsg.value = '请先输入 GeoJSON 文本'
    g2tMsgType.value = 'err'
    return
  }
  try {
    g2tParsed = JSON.parse(text)
  } catch (e) {
    g2tMsg.value = 'JSON 解析失败: ' + (e instanceof Error ? e.message : String(e))
    g2tMsgType.value = 'err'
    return
  }
  doG2TExport()
}

function doG2TExport() {
  if (g2tParsed === null) return
  try {
    const result = geojsonToCsv(g2tParsed, {
      geomMode: g2tGeomMode.value,
      addBom: g2tAddBom.value,
    })
    g2tOutput.value = result.csv
    g2tHasResult = true
    g2tStats.value = {
      features: result.featureCount,
      fields: result.fieldCount,
      rows: result.rowCount,
      size: fmtSize(result.byteSize),
    }
    g2tMsg.value = `导出成功：${result.featureCount} 个要素，${result.fieldCount} 个字段，${result.rowCount} 行`
    g2tMsgType.value = 'ok'
  } catch (e) {
    g2tMsg.value = '转换失败: ' + (e instanceof Error ? e.message : String(e))
    g2tMsgType.value = 'err'
  }
}

function rerunG2T() {
  if (g2tHasResult) doG2TExport()
}

function loadSampleG2T() {
  g2tInput.value = G2T_SAMPLE
  runG2T()
}

function clearG2T() {
  g2tInput.value = ''
  g2tOutput.value = ''
  g2tMsg.value = ''
  g2tMsgType.value = ''
  g2tStats.value = null
  g2tParsed = null
  g2tHasResult = false
}

function copyG2T() {
  copyToClipboard(g2tOutput.value, g2tMsg, g2tMsgType)
}

function downloadG2T() {
  if (!g2tHasResult || !g2tOutput.value) {
    g2tMsg.value = '请先导出 CSV'
    g2tMsgType.value = 'err'
    return
  }
  downloadFile(g2tOutput.value, 'geojson-export.csv', 'text/csv;charset=utf-8')
}

/* ============================================================
 * 标签页 3：Excel → JSON
 * ============================================================ */

const e2jInput = ref('')
const e2jOutput = ref('')
const e2jDelimiter = ref('auto')
const e2jHasHeader = ref(true)
const e2jInferTypes = ref(true)
const e2jOutputMode = ref<'array' | 'object'>('array')
const e2jKeyColumn = ref('0')
const e2jIndent = ref('2')
const e2jMsg = ref('')
const e2jMsgType = ref<'' | 'ok' | 'err'>('')
const e2jStats = ref<{ dimensions: string; records: string } | null>(null)

let e2jTimer: ReturnType<typeof setTimeout> | null = null

const E2J_SAMPLE =
  '姓名\t年龄\t城市\t在职\t薪资\n' +
  '张三\t28\t北京\ttrue\t15000\n' +
  '李四\t35\t上海\ttrue\t22000\n' +
  '王五\t42\t\tfalse\t\n' +
  '赵六\t26\t广州\ttrue\t18000.5'

/** 计算键列下拉选项 */
const e2jColOptions = computed(() => {
  if (!e2jInput.value.trim()) return [{ value: '0', label: '第 1 列' }]
  const delim =
    e2jDelimiter.value === 'auto'
      ? autoDetectDelimiter(e2jInput.value)
      : getDelimiter(e2jDelimiter.value)
  const rows = parseTable(e2jInput.value, delim)
  if (rows.length === 0) return [{ value: '0', label: '第 1 列' }]
  return rows[0]!.map((cell, i) => ({
    value: String(i),
    label: cell !== '' ? cell : `第 ${i + 1} 列`,
  }))
})

/** 键列越界时自动回退到第一列 */
watch(e2jColOptions, (options) => {
  const exists = options.some((o) => o.value === e2jKeyColumn.value)
  if (!exists && options.length > 0) {
    e2jKeyColumn.value = options[0]!.value
  }
})

/** 自动转换（防抖 200ms） */
function scheduleE2J() {
  if (e2jTimer) clearTimeout(e2jTimer)
  e2jTimer = setTimeout(() => runE2J(), 200)
}

watch(
  [e2jInput, e2jDelimiter, e2jHasHeader, e2jInferTypes, e2jOutputMode, e2jKeyColumn, e2jIndent],
  () => scheduleE2J(),
)

onBeforeUnmount(() => {
  if (e2jTimer) clearTimeout(e2jTimer)
})

function runE2J() {
  if (!e2jInput.value.trim()) {
    e2jOutput.value = ''
    e2jMsg.value = ''
    e2jMsgType.value = ''
    e2jStats.value = null
    return
  }

  const delim =
    e2jDelimiter.value === 'auto'
      ? autoDetectDelimiter(e2jInput.value)
      : getDelimiter(e2jDelimiter.value)

  const rows = parseTable(e2jInput.value, delim)
  if (rows.length === 0) {
    e2jOutput.value = '[]'
    e2jMsg.value = '无有效数据'
    e2jMsgType.value = 'err'
    return
  }

  try {
    const converted = convertToJSON(rows, {
      hasHeader: e2jHasHeader.value,
      inferTypes: e2jInferTypes.value,
      mode: e2jOutputMode.value,
      keyCol: parseInt(e2jKeyColumn.value, 10) || 0,
    })
    const indent = parseInt(e2jIndent.value, 10)
    e2jOutput.value = JSON.stringify(converted.result, null, indent === 0 ? 0 : indent)
    e2jStats.value = {
      dimensions: `${rows.length} 行 × ${rows[0]?.length ?? 0} 列`,
      records: converted.info,
    }
    e2jMsg.value = `✓ 转换完成（分隔符: ${delim === '\t' ? 'Tab' : delim}）`
    e2jMsgType.value = 'ok'
  } catch (e) {
    e2jMsg.value = '转换失败: ' + (e instanceof Error ? e.message : String(e))
    e2jMsgType.value = 'err'
  }
}

function loadSampleE2J() {
  e2jInput.value = E2J_SAMPLE
  runE2J()
}

function clearE2J() {
  e2jInput.value = ''
  e2jOutput.value = ''
  e2jMsg.value = ''
  e2jMsgType.value = ''
  e2jStats.value = null
}

function copyE2J() {
  copyToClipboard(e2jOutput.value, e2jMsg, e2jMsgType)
}

function downloadE2J() {
  if (!e2jOutput.value) return
  downloadFile(e2jOutput.value, 'converted.json', 'application/json;charset=utf-8')
}

/* ============================================================
 * 通用工具函数
 * ============================================================ */

function copyToClipboard(
  text: string,
  msgRef: { value: string },
  msgTypeRef: { value: '' | 'ok' | 'err' },
) {
  if (!text) {
    msgRef.value = '没有可复制的结果'
    msgTypeRef.value = 'err'
    return
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        msgRef.value = '已复制到剪贴板'
        msgTypeRef.value = 'ok'
      })
      .catch(() => execCommandCopy(text, msgRef, msgTypeRef))
  } else {
    execCommandCopy(text, msgRef, msgTypeRef)
  }
}

function execCommandCopy(
  text: string,
  msgRef: { value: string },
  msgTypeRef: { value: '' | 'ok' | 'err' },
) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  ta.style.top = '0'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  try {
    document.execCommand('copy')
    msgRef.value = '已复制到剪贴板'
    msgTypeRef.value = 'ok'
  } catch {
    msgRef.value = '复制失败，请手动选择复制'
    msgTypeRef.value = 'err'
  }
  document.body.removeChild(ta)
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.tab-panel {
  margin-top: 0.5rem;
}

/* select 在操作行中自适应宽度 */
.select-sm {
  width: auto !important;
  min-width: 90px;
  padding: 0.375rem 0.625rem !important;
  font-size: 0.8125rem !important;
}

.field-label {
  font-size: 0.8125rem;
  color: #a0a0a0;
  white-space: nowrap;
}

.check-label {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  font-size: 0.8125rem;
  color: #a0a0a0;
  cursor: pointer;
  white-space: nowrap;
}

.check-label input[type='checkbox'] {
  accent-color: #667eea;
  cursor: pointer;
  width: 14px;
  height: 14px;
}

/* 选项行允许换行 */
.options-row {
  gap: 0.625rem;
}
</style>
