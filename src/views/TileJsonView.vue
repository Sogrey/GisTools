<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">TileJSON 查看器</h1>
      <span class="page-subtitle">瓦片服务元数据解析 · tiles / bounds / zoom / 校验</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">TileJSON 输入</span></div>
          <div class="panel-body">
            <textarea class="form-textarea" v-model="input" placeholder='粘贴 TileJSON 内容'></textarea>
            <div class="action-row" style="margin-top:0.5rem">
              <button class="btn btn-primary btn-small" @click="doParse">解析</button>
              <button class="btn btn-secondary btn-small" @click="loadRaster">栅格示例</button>
              <button class="btn btn-secondary btn-small" @click="loadVector">矢量示例</button>
              <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            </div>
            <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err', warn: msgType === 'warn' }" v-if="msg">{{ msg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">解析结果</span></div>
          <div class="panel-body" v-if="result">
            <div class="result-grid" style="margin-bottom:1rem">
              <div class="result-card"><span class="label">tilejson 规范</span><span class="value" style="font-size:0.8125rem">{{ result.data.tilejson || '未声明' }}</span></div>
              <div class="result-card"><span class="label">名称 / 格式</span><span class="value" style="font-size:0.8125rem">{{ result.data.name || '-' }}</span><span class="sub">{{ result.isVector ? '矢量 ' + result.format : '栅格 ' + (result.format || '未知') }}</span></div>
              <div class="result-card"><span class="label">缩放级别</span><span class="value">z{{ result.data.minzoom }} ~ z{{ result.data.maxzoom }}</span><span class="sub">scheme: {{ result.data.scheme }}</span></div>
              <div class="result-card"><span class="label">瓦片模板</span><span class="value">{{ result.data.tiles.length }}</span><span class="sub">个 URL</span></div>
            </div>
            <div class="msg err" v-if="result.errors.length" style="margin-bottom:0.5rem">{{ result.errors.join('；') }}</div>
            <div class="msg warn" v-if="result.warnings.length" style="margin-bottom:0.5rem">{{ result.warnings.join('；') }}</div>
            <table class="data-table" style="margin-bottom:1rem">
              <tbody>
                <tr><td>名称</td><td>{{ result.data.name || '-' }}</td></tr>
                <tr><td>描述</td><td>{{ result.data.description || '-' }}</td></tr>
                <tr><td>版本</td><td>{{ result.data.version || '-' }}</td></tr>
                <tr><td>bounds</td><td>{{ result.data.bounds ? result.data.bounds.map(x => x.toFixed(4)).join(', ') : '未声明' }}</td></tr>
                <tr><td>center</td><td>{{ result.data.center ? result.data.center.join(', ') : '未声明' }}</td></tr>
                <tr><td>attribution</td><td>{{ result.data.attribution || '-' }}</td></tr>
              </tbody>
            </table>
            <label class="form-label">tiles URL 模板</label>
            <div class="action-row" style="margin-bottom:0.5rem;flex-wrap:wrap">
              <span v-for="(t, i) in result.data.tiles" :key="i" class="tag" style="word-break:break-all;font-family:Consolas,monospace">{{ t }}</span>
            </div>
            <template v-if="result.data.vectorLayers.length">
              <label class="form-label">矢量图层（{{ result.data.vectorLayers.length }} 个）</label>
              <table class="data-table">
                <thead><tr><th>ID</th><th>描述</th><th>字段数</th></tr></thead>
                <tbody>
                  <tr v-for="(vl, i) in result.data.vectorLayers" :key="i">
                    <td>{{ (vl as Record<string, unknown>).id }}</td>
                    <td>{{ (vl as Record<string, unknown>).description || '-' }}</td>
                    <td>{{ vl && typeof vl === 'object' && 'fields' in vl ? Object.keys((vl as Record<string, Record<string, unknown>>).fields || {}).length : 0 }}</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template v-if="result.data.tiles.length && !result.isVector">
              <label class="form-label">中心瓦片预览（z={{ result.data.minzoom }}）</label>
              <div style="text-align:center;padding:0.5rem;border:1px solid rgba(255,255,255,0.1);border-radius:8px">
                <img :src="previewUrl" alt="预览瓦片" style="max-width:360px;border-radius:6px" @error="onImgError" />
              </div>
              <div class="action-row" style="margin-top:0.5rem">
                <input class="form-input" :value="previewUrl" readonly style="font-size:0.75rem" />
                <button class="btn btn-secondary btn-small" @click="copyPreview">复制</button>
              </div>
            </template>
          </div>
          <div class="panel-body" v-else>
            <div class="form-hint" style="text-align:center;padding:3rem 0">粘贴 TileJSON 后点击「解析」</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">TileJSON 查看器 · 纯本地解析 · 适用于底图服务对接检查</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseTileJson, previewTileUrl, SAMPLE_RASTER, SAMPLE_VECTOR, type TileJsonResult } from '../utils/tilejson'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const result = ref<TileJsonResult | null>(null)
const msg = ref('')
const msgType = ref('')
const imgError = ref(false)

const previewUrl = computed(() => {
  if (!result.value || !result.value.data.tiles.length || result.value.isVector) return ''
  const d = result.value.data
  const lon = d.center ? d.center[0] : d.bounds ? (d.bounds[0]! + d.bounds[2]!) / 2 : 0
  const lat = d.center ? d.center[1] : d.bounds ? (d.bounds[1]! + d.bounds[3]!) / 2 : 0
  return previewTileUrl(d.tiles[0]!, { lon, lat, z: d.minzoom, scheme: d.scheme }).url
})

function doParse() {
  if (!input.value.trim()) { msg.value = '请先粘贴 TileJSON'; msgType.value = 'err'; return }
  const r = parseTileJson(input.value)
  result.value = r
  imgError.value = false
  if (!r.ok) { msg.value = `解析完成，${r.errors.length} 个错误`; msgType.value = 'err' }
  else if (r.warnings.length) { msg.value = `校验通过（${r.warnings.length} 个提醒）`; msgType.value = 'warn' }
  else { msg.value = '校验通过'; msgType.value = 'ok' }
}

function loadRaster() { input.value = SAMPLE_RASTER; doParse() }
function loadVector() { input.value = SAMPLE_VECTOR; doParse() }
function clearAll() { input.value = ''; result.value = null; msg.value = '' }
function onImgError() { imgError.value = true }
function copyPreview() { if (previewUrl.value) navigator.clipboard?.writeText(previewUrl.value) }
</script>
