<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">WMS/WMTS URL 构建器</h1>
      <span class="page-subtitle">填表生成 OGC WMS GetMap / WMTS GetTile URL</span>
    </div>
    <div class="tool-main">
      <div class="tabs" style="margin-bottom:1rem">
        <button class="tab" :class="{ active: mode === 'wms' }" @click="mode = 'wms'">WMS GetMap</button>
        <button class="tab" :class="{ active: mode === 'wmts' }" @click="mode = 'wmts'">WMTS GetTile</button>
      </div>
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">参数填写</span></div>
          <div class="panel-body">
            <template v-if="mode === 'wms'">
              <div class="form-group"><label class="form-label">服务地址</label><input class="form-input" v-model="wmsUrl" placeholder="https://example.com/wms" /></div>
              <div class="form-group"><label class="form-label">图层</label><input class="form-input" v-model="wmsLayers" placeholder="layer1,layer2" /></div>
              <div class="form-group"><label class="form-label">样式</label><input class="form-input" v-model="wmsStyles" placeholder="（默认空）" /></div>
              <div class="form-group"><label class="form-label">Bbox</label><input class="form-input" v-model="wmsBbox" placeholder="minX,minY,maxX,maxY" /></div>
              <div class="action-row" style="margin-bottom:0.5rem">
                <label class="form-label" style="margin:0;min-width:auto">CRS</label>
                <select class="form-select" v-model="wmsCrs" style="width:auto">
                  <option value="EPSG:4326">EPSG:4326</option><option value="EPSG:3857">EPSG:3857</option>
                </select>
                <label class="form-label" style="margin:0;min-width:auto">版本</label>
                <select class="form-select" v-model="wmsVersion" style="width:auto">
                  <option value="1.3.0">1.3.0</option><option value="1.1.1">1.1.1</option>
                </select>
              </div>
              <div class="action-row" style="margin-bottom:0.5rem">
                <label class="form-label" style="margin:0;min-width:auto">宽×高</label>
                <input class="form-input" type="number" v-model.number="wmsWidth" min="1" style="width:80px" />
                <span>×</span>
                <input class="form-input" type="number" v-model.number="wmsHeight" min="1" style="width:80px" />
              </div>
              <div class="action-row" style="margin-bottom:0.5rem">
                <label class="form-label" style="margin:0;min-width:auto">格式</label>
                <select class="form-select" v-model="wmsFormat" style="width:auto">
                  <option value="image/png">image/png</option><option value="image/jpeg">image/jpeg</option><option value="image/gif">image/gif</option>
                </select>
                <label style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:#a0a0a0"><input type="checkbox" v-model="wmsTransparent" /> 透明</label>
              </div>
            </template>
            <template v-else>
              <div class="form-group"><label class="form-label">服务地址</label><input class="form-input" v-model="wmtsUrl" placeholder="https://example.com/wmts" /></div>
              <div class="form-group"><label class="form-label">图层</label><input class="form-input" v-model="wmtsLayer" /></div>
              <div class="form-group"><label class="form-label">样式</label><input class="form-input" v-model="wmtsStyle" /></div>
              <div class="form-group"><label class="form-label">TileMatrixSet</label><input class="form-input" v-model="wmtsTMS" /></div>
              <div class="action-row" style="margin-bottom:0.5rem">
                <label class="form-label" style="margin:0;min-width:auto">层级</label>
                <input class="form-input" type="number" v-model.number="wmtsZ" min="0" style="width:70px" />
                <label class="form-label" style="margin:0;min-width:auto">行</label>
                <input class="form-input" type="number" v-model.number="wmtsRow" min="0" style="width:80px" />
                <label class="form-label" style="margin:0;min-width:auto">列</label>
                <input class="form-input" type="number" v-model.number="wmtsCol" min="0" style="width:80px" />
              </div>
              <div class="action-row">
                <label class="form-label" style="margin:0;min-width:auto">格式</label>
                <select class="form-select" v-model="wmtsFormat" style="width:auto">
                  <option value="image/png">image/png</option><option value="image/jpeg">image/jpeg</option>
                </select>
              </div>
            </template>
            <div class="action-row" style="margin-top:0.5rem">
              <button class="btn btn-primary btn-small" @click="generate">生成 URL</button>
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            </div>
            <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err' }" v-if="msg">{{ msg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">URL 输出</span></div>
          <div class="panel-body">
            <div v-for="item in urlList" :key="item.label" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:0.625rem 0.75rem;margin-bottom:0.5rem">
              <div style="font-size:0.75rem;color:#667eea;font-weight:600;margin-bottom:0.25rem">{{ item.label }}</div>
              <div style="font-family:Consolas,monospace;font-size:0.6875rem;color:#a0a0a0;word-break:break-all;background:rgba(255,255,255,0.02);border-radius:6px;padding:4px 6px;line-height:1.5">{{ item.url }}</div>
              <div class="action-row" style="margin-top:0.25rem">
                <button class="btn btn-secondary btn-small" @click="copyText(item.url)">复制</button>
                <button class="btn btn-secondary btn-small" @click="openUrl(item.url)">打开</button>
              </div>
            </div>
            <div v-if="!urlList.length" class="form-hint" style="text-align:center;padding:2rem 0">点击「生成 URL」后在此显示</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">OGC WMS 1.1.1/1.3.0 · WMTS 1.0.0 · URL 参数自动编码 · 纯本地构建</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { buildWmsGetMap, buildCapabilitiesUrl, buildWmtsGetTile, buildWmtsRestUrl, SAMPLES } from '../utils/wms-url'

const router = useRouter()
const goBack = () => router.push('/')

const mode = ref<'wms' | 'wmts'>('wms')
const msg = ref('')
const msgType = ref('')
const urlList = ref<{ label: string; url: string }[]>([])

// WMS params
const wmsUrl = ref(SAMPLES.wms.url || '')
const wmsLayers = ref(SAMPLES.wms.layers || '')
const wmsStyles = ref(SAMPLES.wms.styles || '')
const wmsBbox = ref(SAMPLES.wms.bbox || '')
const wmsCrs = ref(SAMPLES.wms.crs || 'EPSG:4326')
const wmsVersion = ref(SAMPLES.wms.version || '1.3.0')
const wmsWidth = ref(SAMPLES.wms.width || 768)
const wmsHeight = ref(SAMPLES.wms.height || 512)
const wmsFormat = ref(SAMPLES.wms.format || 'image/png')
const wmsTransparent = ref(SAMPLES.wms.transparent ?? true)

// WMTS params
const wmtsUrl = ref(SAMPLES.wmts.url || '')
const wmtsLayer = ref(SAMPLES.wmts.layer || '')
const wmtsStyle = ref(SAMPLES.wmts.style || 'default')
const wmtsTMS = ref(SAMPLES.wmts.tileMatrixSet || '')
const wmtsZ = ref(SAMPLES.wmts.z || 12)
const wmtsRow = ref(SAMPLES.wmts.row || 2206)
const wmtsCol = ref(SAMPLES.wmts.col || 1380)
const wmtsFormat = ref(SAMPLES.wmts.format || 'image/png')

function generate() {
  urlList.value = []
  if (mode.value === 'wms') {
    if (!wmsUrl.value.trim()) { msg.value = '请填写服务地址'; msgType.value = 'err'; return }
    const getMapUrl = buildWmsGetMap({
      url: wmsUrl.value, layers: wmsLayers.value, styles: wmsStyles.value, bbox: wmsBbox.value,
      crs: wmsCrs.value, version: wmsVersion.value, width: wmsWidth.value, height: wmsHeight.value,
      format: wmsFormat.value, transparent: wmsTransparent.value
    })
    urlList.value.push({ label: 'GetMap URL', url: getMapUrl })
    urlList.value.push({ label: 'GetCapabilities URL', url: buildCapabilitiesUrl(wmsUrl.value, 'WMS', wmsVersion.value) })
    msg.value = '已生成 WMS URL'; msgType.value = 'ok'
  } else {
    if (!wmtsUrl.value.trim()) { msg.value = '请填写服务地址'; msgType.value = 'err'; return }
    const p = {
      url: wmtsUrl.value, layer: wmtsLayer.value, style: wmtsStyle.value, format: wmtsFormat.value,
      tileMatrixSet: wmtsTMS.value, z: wmtsZ.value, row: wmtsRow.value, col: wmtsCol.value
    }
    urlList.value.push({ label: 'GetTile URL (KVP)', url: buildWmtsGetTile(p) })
    urlList.value.push({ label: 'GetTile URL (RESTful)', url: buildWmtsRestUrl(p) })
    urlList.value.push({ label: 'GetCapabilities URL', url: buildCapabilitiesUrl(wmtsUrl.value, 'WMTS', '1.0.0') })
    msg.value = '已生成 WMTS URL'; msgType.value = 'ok'
  }
}

function loadSample() {
  if (mode.value === 'wms') {
    const s = SAMPLES.wms
    wmsUrl.value = s.url; wmsLayers.value = s.layers; wmsStyles.value = s.styles || ''
    wmsBbox.value = s.bbox; wmsCrs.value = s.crs || 'EPSG:4326'; wmsVersion.value = s.version || '1.3.0'
    wmsWidth.value = s.width || 768; wmsHeight.value = s.height || 512
    wmsFormat.value = s.format || 'image/png'; wmsTransparent.value = s.transparent ?? true
  } else {
    const w = SAMPLES.wmts
    wmtsUrl.value = w.url; wmtsLayer.value = w.layer; wmtsStyle.value = w.style || 'default'
    wmtsTMS.value = w.tileMatrixSet || ''; wmtsZ.value = w.z || 12
    wmtsRow.value = w.row || 0; wmtsCol.value = w.col || 0; wmtsFormat.value = w.format || 'image/png'
  }
  msg.value = '已载入示例参数'; msgType.value = 'ok'
}

function copyText(t: string) { navigator.clipboard?.writeText(t) }
function openUrl(t: string) { window.open(t, '_blank') }

generate()
</script>
