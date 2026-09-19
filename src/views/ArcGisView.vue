<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">ArcGIS REST 服务探测器</h1>
      <span class="page-subtitle">服务端点 URL 构建 · layers / query / export / legend</span>
    </div>
    <div class="tool-main">
      <section class="panel" style="margin-bottom:1rem">
        <div class="panel-head"><span class="t">服务地址</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom:0.5rem">
            <label class="form-label" style="margin:0;min-width:80px">Base URL</label>
            <input class="form-input" v-model="baseUrl" placeholder="https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer" />
            <span class="tag" v-if="srvcType" :style="{ background: srvcType === 'FeatureServer' ? 'rgba(16,185,129,0.1)' : 'rgba(102,126,234,0.1)', color: srvcType === 'FeatureServer' ? '#10b981' : '#667eea' }">{{ srvcType }}</span>
          </div>
          <div class="action-row" style="margin-bottom:0.5rem">
            <label class="form-label" style="margin:0;min-width:80px">图层 ID</label>
            <input class="form-input" type="number" v-model="layerId" min="0" step="1" style="width:100px" />
          </div>
          <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err', warn: msgType === 'warn' }" v-if="msg">{{ msg }}</div>
        </div>
      </section>
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">查询（query）参数</span></div>
          <div class="panel-body">
            <div class="form-group"><label class="form-label">where 条件</label><input class="form-input" v-model="qWhere" /></div>
            <div class="form-group"><label class="form-label">返回字段</label><input class="form-input" v-model="qFields" /></div>
            <div class="form-group"><label class="form-label">输出格式</label>
              <select class="form-select" v-model="qFormat" style="width:auto">
                <option value="json">f=json</option><option value="pjson">f=pjson</option><option value="geojson">f=geojson</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">空间过滤</label>
              <select class="form-select" v-model="qGeomType" style="width:auto">
                <option value="none">无</option><option value="envelope">矩形范围</option><option value="point">点</option>
              </select>
            </div>
            <template v-if="qGeomType === 'envelope'">
              <div class="action-row" style="margin-bottom:0.5rem">
                <input class="form-input" type="number" v-model.number="qMinx" step="any" style="width:80px" placeholder="minx" />
                <input class="form-input" type="number" v-model.number="qMiny" step="any" style="width:80px" placeholder="miny" />
                <input class="form-input" type="number" v-model.number="qMaxx" step="any" style="width:80px" placeholder="maxx" />
                <input class="form-input" type="number" v-model.number="qMaxy" step="any" style="width:80px" placeholder="maxy" />
              </div>
            </template>
            <template v-if="qGeomType === 'point'">
              <div class="action-row" style="margin-bottom:0.5rem">
                <input class="form-input" type="number" v-model.number="qX" step="any" style="width:100px" placeholder="x" />
                <input class="form-input" type="number" v-model.number="qY" step="any" style="width:100px" placeholder="y" />
                <input class="form-input" type="number" v-model.number="qDist" step="any" style="width:100px" placeholder="距离m" />
              </div>
            </template>
            <div class="form-group"><label class="form-label">记录数限制</label><input class="form-input" type="number" v-model.number="qCount" min="1" style="width:120px" /></div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <label style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:#a0a0a0"><input type="checkbox" v-model="qGeom" /> returnGeometry</label>
              <label style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:#a0a0a0"><input type="checkbox" v-model="qCountOnly" /> 仅统计数</label>
            </div>
            <button class="btn btn-primary btn-small" @click="genQuery">生成 Query URL</button>
            <textarea class="form-textarea" v-model="qOut" readonly style="min-height:60px;margin-top:0.5rem" v-if="qOut"></textarea>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">导出（export）参数</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <input class="form-input" type="number" v-model.number="eMinx" step="any" style="width:80px" placeholder="minx" />
              <input class="form-input" type="number" v-model.number="eMiny" step="any" style="width:80px" placeholder="miny" />
              <input class="form-input" type="number" v-model.number="eMaxx" step="any" style="width:80px" placeholder="maxx" />
              <input class="form-input" type="number" v-model.number="eMaxy" step="any" style="width:80px" placeholder="maxy" />
            </div>
            <div class="form-group"><label class="form-label">范围 SR</label><input class="form-input" v-model="eSr" style="width:100px" /></div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="form-label" style="margin:0;min-width:auto">尺寸</label>
              <input class="form-input" type="number" v-model.number="eW" min="16" style="width:70px" />
              <span>×</span>
              <input class="form-input" type="number" v-model.number="eH" min="16" style="width:70px" />
              <span class="form-hint" style="margin:0">px</span>
            </div>
            <div class="form-group"><label class="form-label">格式</label>
              <select class="form-select" v-model="eFormat" style="width:auto">
                <option>PNG32</option><option>PNG24</option><option>PNG8</option><option>JPG</option><option>GIF</option>
              </select>
            </div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <label style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:#a0a0a0"><input type="checkbox" v-model="eTransparent" /> transparent</label>
              <label class="form-label" style="margin:0;min-width:auto">DPI</label>
              <input class="form-input" type="number" v-model.number="eDpi" min="1" style="width:70px" />
            </div>
            <button class="btn btn-primary btn-small" @click="genExport">生成 Export URL</button>
            <textarea class="form-textarea" v-model="eOut" readonly style="min-height:60px;margin-top:0.5rem" v-if="eOut"></textarea>
          </div>
        </section>
      </div>
      <section class="panel" style="margin-top:1rem">
        <div class="panel-head"><span class="t">基础端点一览</span></div>
        <div class="panel-body">
          <table class="data-table">
            <thead><tr><th>端点</th><th>URL</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="ep in endpoints" :key="ep.label">
                <td>{{ ep.label }}</td>
                <td style="word-break:break-all;font-family:Consolas,monospace;font-size:0.75rem">{{ ep.url }}</td>
                <td><button class="btn btn-secondary btn-small" @click="copyText(ep.url)">复制</button> <a class="btn btn-secondary btn-small" :href="ep.url" target="_blank" style="text-decoration:none">打开</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <div class="tool-footer">ArcGIS REST 服务探测器 · 纯本地 URL 构建 · 不发送任何请求</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { normalizeBaseUrl, serviceType, buildServiceUrl, buildLayersUrl, buildLayerUrl, buildFieldsUrl, buildLegendUrl, buildQueryUrl, buildExportUrl } from '../utils/arcgis-rest'

const router = useRouter()
const goBack = () => router.push('/')

const baseUrl = ref('https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer')
const layerId = ref(0)
const msg = ref('')
const msgType = ref('')

const srvcType = computed(() => serviceType(normalizeBaseUrl(baseUrl.value)))

const endpoints = computed(() => {
  const u = normalizeBaseUrl(baseUrl.value)
  if (!u) return [] as { label: string; url: string }[]
  const lid = layerId.value || 0
  const rows = [
    { label: '服务信息', url: buildServiceUrl(u) },
    { label: '图层列表 layers', url: buildLayersUrl(u) },
    { label: `图层 ${lid} 详情`, url: buildLayerUrl(u, lid) },
    { label: `图层 ${lid} 字段`, url: buildFieldsUrl(u, lid) },
  ]
  if (srvcType.value === 'MapServer' || srvcType.value === 'FeatureServer') {
    rows.push({ label: '图例 legend', url: buildLegendUrl(u) })
  }
  return rows
})

// Query params
const qWhere = ref('1=1')
const qFields = ref('*')
const qFormat = ref<'json' | 'pjson' | 'geojson'>('json')
const qGeomType = ref<'none' | 'envelope' | 'point'>('none')
const qMinx = ref(-180), qMiny = ref(-90), qMaxx = ref(180), qMaxy = ref(90)
const qX = ref(0), qY = ref(0), qDist = ref(1000)
const qCount = ref(200)
const qGeom = ref(true)
const qCountOnly = ref(false)
const qOut = ref('')

// Export params
const eMinx = ref(-180), eMiny = ref(-90), eMaxx = ref(180), eMaxy = ref(90)
const eSr = ref('4326')
const eW = ref(800), eH = ref(600)
const eFormat = ref('PNG32')
const eTransparent = ref(true)
const eDpi = ref(96)
const eOut = ref('')

function genQuery() {
  if (!baseUrl.value.trim()) { msg.value = '请先填写 Base URL'; msgType.value = 'err'; return }
  const opts: Record<string, unknown> = {
    layerId: layerId.value, where: qWhere.value || '1=1', outFields: qFields.value || '*',
    format: qFormat.value, returnGeometry: qGeom.value, countOnly: qCountOnly.value,
    resultRecordCount: qCount.value || 0
  }
  if (qGeomType.value === 'envelope') {
    opts.geometryType = 'envelope'
    opts.geometry = [qMinx.value, qMiny.value, qMaxx.value, qMaxy.value]
    opts.inSR = '4326'
    opts.spatialRel = 'esriSpatialRelIntersects'
  } else if (qGeomType.value === 'point') {
    opts.geometryType = 'point'
    opts.geometry = [qX.value, qY.value]
    opts.inSR = '4326'
    opts.distance = qDist.value
  }
  qOut.value = buildQueryUrl(baseUrl.value, opts as never)
  msg.value = 'Query URL 已生成'; msgType.value = 'ok'
}

function genExport() {
  if (!baseUrl.value.trim()) { msg.value = '请先填写 Base URL'; msgType.value = 'err'; return }
  eOut.value = buildExportUrl(baseUrl.value, {
    bbox: [eMinx.value, eMiny.value, eMaxx.value, eMaxy.value],
    bboxSR: eSr.value, size: [eW.value, eH.value],
    format: eFormat.value, transparent: eTransparent.value, dpi: eDpi.value
  })
  msg.value = 'Export URL 已生成'; msgType.value = 'ok'
}

function copyText(t: string) { navigator.clipboard?.writeText(t) }
</script>
