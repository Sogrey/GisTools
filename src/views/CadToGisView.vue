<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">CAD → GIS</h1>
      <span class="page-subtitle">DXF → 分层 GeoJSON · Rust WASM · 数据不出浏览器</span>
    </div>

    <div class="tool-main">
      <div class="panel" style="margin-bottom: 1rem">
        <div class="panel-head">
          <span class="t">输入 DXF</span>
          <div class="spacer"></div>
          <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
          <label class="btn btn-secondary btn-small" style="cursor: pointer">
            选择文件
            <input type="file" accept=".dxf,text/plain" hidden @change="onFile" />
          </label>
        </div>
        <div class="panel-body">
          <p class="hint">
            支持 ASCII DXF。真 DWG 请先用 CAD / ODA 另存为 DXF。转换在本地 WASM 完成：样式继承（BYLAYER/BYBLOCK）、块展开、曲线离散、点/线/面/标注四层输出。
          </p>
          <div class="opts">
            <label>弦高 sagitta
              <input v-model.number="opts.sagitta" type="number" min="0.0001" step="0.01" class="form-input" />
            </label>
            <label>块最大深度
              <input v-model.number="opts.max_depth" type="number" min="1" max="16" class="form-input" />
            </label>
            <label class="chk"><input v-model="opts.explode_blocks" type="checkbox" /> 展开块</label>
            <label class="chk"><input v-model="opts.closed_polyline_as_polygon" type="checkbox" /> 闭合多段线→面</label>
          </div>
          <div class="action-row">
            <button class="btn btn-primary" :disabled="running || !dxfText" @click="runConvert">
              {{ running ? '转换中…' : '开始转换' }}
            </button>
            <button class="btn btn-secondary" :disabled="!result" @click="downloadAll">下载全部 GeoJSON</button>
            <button class="btn btn-secondary" :disabled="!result" @click="downloadMerged">下载合并 GeoJSON</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            <span class="msg" :class="{ ok: msgOk, err: !msgOk && !!msg }">{{ msg }}</span>
          </div>
          <details class="src-box">
            <summary>DXF 文本预览（{{ dxfText.length.toLocaleString() }} 字符）</summary>
            <textarea v-model="dxfText" class="form-textarea" rows="8" placeholder="粘贴 DXF 或选择文件…" />
          </details>
        </div>
      </div>

      <div v-if="result" class="stats-row">
        <span>输入实体 <b>{{ result.stats.entities_in }}</b></span>
        <span>输出要素 <b>{{ result.stats.features_out }}</b></span>
        <span>点 {{ result.stats.points }}</span>
        <span>线 {{ result.stats.lines }}</span>
        <span>面 {{ result.stats.polygons }}</span>
        <span>标注 {{ result.stats.annotations }}</span>
        <span>炸块 {{ result.stats.blocks_expanded }}</span>
        <span>跳过 {{ result.stats.skipped }}</span>
      </div>

      <div v-if="result?.warnings?.length" class="warn-box">
        <div v-for="(w, i) in result.warnings.slice(0, 12)" :key="i">⚠ {{ w }}</div>
        <div v-if="result.warnings.length > 12">…另有 {{ result.warnings.length - 12 }} 条</div>
      </div>

      <div v-if="result" class="tool-grid" style="margin-top: 1rem">
        <div class="panel">
          <div class="panel-head">
            <span class="t">预览</span>
            <div class="spacer"></div>
            <button
              v-for="tab in layerTabs"
              :key="tab.key"
              class="btn btn-secondary btn-small"
              :class="{ active: previewTab === tab.key }"
              @click="setPreview(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>
          <div class="panel-body preview-wrap" v-html="svgHtml"></div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="t">分层下载</span>
            <div class="spacer"></div>
          </div>
          <div class="panel-body">
            <div v-for="tab in layerTabs.filter((t) => t.key !== 'all')" :key="tab.key" class="layer-row">
              <div>
                <b>{{ tab.label }}</b>
                <span class="muted"> · {{ layerCount(tab.key) }} 要素</span>
              </div>
              <button class="btn btn-secondary btn-small" :disabled="!result" @click="downloadLayer(tab.key)">
                下载 .geojson
              </button>
            </div>
            <div class="hint" style="margin-top: 1rem">
              属性含 color_hex / line_mm / linetype / cad_layer / block_path / handle；标注另有 text、text_h、text_rot。
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  SAMPLE_DXF,
  convertDxfToGis,
  downloadText,
  featuresToSvg,
  layerFilename,
  mergeLayers,
  type CadToGisOptions,
  type CadToGisResult,
  type GisFeatureCollection,
} from '../utils/cad-to-gis'

const router = useRouter()
const goBack = () => router.push('/')

const dxfText = ref('')
const fileBase = ref('sample')
const running = ref(false)
const msg = ref('')
const msgOk = ref(false)
const result = ref<CadToGisResult | null>(null)
const previewTab = ref<'all' | 'points' | 'lines' | 'polygons' | 'annotations'>('all')
const mergedCache = ref<GisFeatureCollection | null>(null)

const opts = ref<CadToGisOptions>({
  sagitta: 0.01,
  max_depth: 4,
  explode_blocks: true,
  closed_polyline_as_polygon: true,
  model_space_only: true,
})

const layerTabs = [
  { key: 'all' as const, label: '全部' },
  { key: 'points' as const, label: '点' },
  { key: 'lines' as const, label: '线' },
  { key: 'polygons' as const, label: '面' },
  { key: 'annotations' as const, label: '标注' },
]

function layerCount(key: string) {
  if (!result.value) return 0
  if (key === 'all') return result.value.stats.features_out
  return result.value.layers[key as keyof typeof result.value.layers]?.features.length ?? 0
}

const svgHtml = computed(() => {
  if (!result.value) return ''
  let fc: GisFeatureCollection
  if (previewTab.value === 'all') {
    fc = mergedCache.value || { type: 'FeatureCollection', features: [] }
  } else {
    fc = result.value.layers[previewTab.value]
  }
  return featuresToSvg(fc)
})

function setPreview(key: typeof previewTab.value) {
  previewTab.value = key
}

function loadSample() {
  dxfText.value = SAMPLE_DXF
  fileBase.value = 'sample'
  msg.value = '已载入示例 DXF'
  msgOk.value = true
}

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileBase.value = file.name
  dxfText.value = await file.text()
  msg.value = `已读取 ${file.name}（${dxfText.value.length.toLocaleString()} 字符）`
  msgOk.value = true
  input.value = ''
}

async function runConvert() {
  if (!dxfText.value.trim()) {
    msg.value = '请先选择或粘贴 DXF'
    msgOk.value = false
    return
  }
  running.value = true
  msg.value = 'WASM 转换中…'
  msgOk.value = true
  result.value = null
  mergedCache.value = null
  try {
    const t0 = performance.now()
    const res = await convertDxfToGis(dxfText.value, opts.value)
    mergedCache.value = await mergeLayers(res)
    result.value = res
    previewTab.value = 'all'
    const ms = Math.round(performance.now() - t0)
    msg.value = `完成：${res.stats.features_out} 要素，${ms} ms`
    msgOk.value = true
  } catch (e) {
    msg.value = `失败：${(e as Error).message || e}`
    msgOk.value = false
  } finally {
    running.value = false
  }
}

function downloadLayer(key: string) {
  if (!result.value || key === 'all') return
  const layer = result.value.layers[key as keyof typeof result.value.layers]
  downloadText(layerFilename(fileBase.value, key), JSON.stringify(layer, null, 2))
}

function downloadAll() {
  if (!result.value) return
  for (const key of ['points', 'lines', 'polygons', 'annotations'] as const) {
    downloadLayer(key)
  }
}

function downloadMerged() {
  if (!mergedCache.value) return
  downloadText(layerFilename(fileBase.value, 'merged'), JSON.stringify(mergedCache.value, null, 2))
}

function clearAll() {
  dxfText.value = ''
  result.value = null
  mergedCache.value = null
  msg.value = ''
}
</script>

<style scoped>
.hint {
  color: #a0a0a0;
  font-size: 0.85rem;
  line-height: 1.5;
  margin: 0 0 1rem;
}
.opts {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: end;
}
.opts label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: #a0a0a0;
}
.opts .form-input {
  width: 7rem;
  padding: 0.4rem 0.6rem;
}
.chk {
  flex-direction: row !important;
  align-items: center;
  gap: 0.4rem !important;
  margin-bottom: 0.2rem;
}
.src-box {
  margin-top: 1rem;
  color: #a0a0a0;
}
.src-box textarea {
  margin-top: 0.5rem;
  min-height: 140px;
}
.stats-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  padding: 0.75rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  font-size: 0.85rem;
  color: #c0c0c0;
}
.stats-row b {
  color: #fff;
}
.warn-box {
  margin-top: 0.75rem;
  padding: 0.75rem 1rem;
  background: rgba(234, 179, 8, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.25);
  border-radius: 8px;
  color: #eab308;
  font-size: 0.8rem;
}
.preview-wrap {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
}
.preview-wrap :deep(svg) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
.layer-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.muted {
  margin-left: 0.5rem;
  color: #808080;
  font-size: 0.8rem;
}
.btn.active {
  border-color: rgba(102, 126, 234, 0.6);
  color: #fff;
}
</style>
