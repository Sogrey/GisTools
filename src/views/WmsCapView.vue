<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">WMS Capabilities 解析器</h1>
      <span class="page-subtitle">OGC WMS 能力文档解析 · 服务 / 图层 / CRS / 格式 / GetMap URL</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">能力文档输入</span></div>
          <div class="panel-body">
            <div class="form-group">
              <label class="form-label">服务 URL（需 CORS）</label>
              <input class="form-input" v-model="wmsUrl" placeholder="https://example.gov/geoserver/wms?service=WMS&request=GetCapabilities" />
            </div>
            <div class="action-row" style="margin-bottom:0.5rem">
              <button class="btn btn-primary btn-small" @click="fetchUrl">尝试拉取</button>
            </div>
            <div class="form-group">
              <label class="form-label">或粘贴 XML</label>
              <textarea class="form-textarea" v-model="input" placeholder="粘贴 GetCapabilities 响应 XML"></textarea>
            </div>
            <div class="action-row">
              <button class="btn btn-primary btn-small" @click="doParse">解析</button>
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            </div>
            <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err' }" v-if="msg">{{ msg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">解析结果</span></div>
          <div class="panel-body" v-if="result && result.ok">
            <div class="result-grid" style="margin-bottom:1rem">
              <div class="result-card"><span class="label">WMS 版本</span><span class="value">{{ result.version }}</span></div>
              <div class="result-card"><span class="label">服务标题</span><span class="value" style="font-size:0.8125rem">{{ result.service.title || result.service.name || '-' }}</span></div>
              <div class="result-card"><span class="label">图层数</span><span class="value">{{ result.layerCount }}</span></div>
              <div class="result-card"><span class="label">GetMap 格式</span><span class="value">{{ result.formats.formats.length }}</span><span class="sub">种</span></div>
            </div>
            <table class="data-table" style="margin-bottom:1rem">
              <tbody>
                <tr><td>名称</td><td>{{ result.service.name || '-' }}</td></tr>
                <tr><td>标题</td><td>{{ result.service.title || '-' }}</td></tr>
                <tr><td>摘要</td><td>{{ result.service.abstract || '-' }}</td></tr>
                <tr><td>GetMap 格式</td><td>{{ result.formats.formats.join('、') || '-' }}</td></tr>
              </tbody>
            </table>
            <label class="form-label">图层列表（点击行 → 生成 GetMap URL）</label>
            <table class="data-table">
              <thead><tr><th>名称</th><th>标题</th><th>可查询</th><th>CRS数</th></tr></thead>
              <tbody>
                <tr v-for="(lyr, i) in result.layers" :key="i" style="cursor:pointer" @click="fillGetmap(lyr)">
                  <td :style="{ paddingLeft: lyr.depth * 12 + 'px' }">{{ lyr.name || '(分组层)' }}</td>
                  <td>{{ lyr.title || '-' }}</td>
                  <td>{{ lyr.queryable ? '是' : '否' }}</td>
                  <td>{{ lyr.crs.length + lyr.srs.length }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="panel-body" v-else-if="result && !result.ok">
            <div class="msg err">{{ result.errors.join('；') }}</div>
          </div>
          <div class="panel-body" v-else>
            <div class="form-hint" style="text-align:center;padding:3rem 0">粘贴 GetCapabilities XML 后点击「解析」</div>
          </div>
        </section>
      </div>
      <section class="panel" v-if="showGetmap" style="margin-top:1rem">
        <div class="panel-head"><span class="t">GetMap URL 生成器</span></div>
        <div class="panel-body">
          <div class="tool-grid">
            <div>
              <div class="form-group"><label class="form-label">Base URL</label><input class="form-input" v-model="gmBase" /></div>
              <div class="form-group"><label class="form-label">图层 LAYERS</label><input class="form-input" v-model="gmLayers" /></div>
              <div class="form-group"><label class="form-label">样式 STYLES</label><input class="form-input" v-model="gmStyles" placeholder="留空默认" /></div>
              <div class="form-group"><label class="form-label">版本</label>
                <select class="form-select" v-model="gmVersion" style="width:auto">
                  <option>1.3.0</option><option>1.1.1</option><option>1.1.0</option>
                </select>
              </div>
            </div>
            <div>
              <div class="form-group"><label class="form-label">CRS/SRS</label><input class="form-input" v-model="gmCrs" /></div>
              <div class="form-group"><label class="form-label">BBOX（西,南,东,北）</label>
                <div class="action-row">
                  <input class="form-input" type="number" v-model.number="gmBbox.west" step="any" style="width:80px" placeholder="西" />
                  <input class="form-input" type="number" v-model.number="gmBbox.south" step="any" style="width:80px" placeholder="南" />
                  <input class="form-input" type="number" v-model.number="gmBbox.east" step="any" style="width:80px" placeholder="东" />
                  <input class="form-input" type="number" v-model.number="gmBbox.north" step="any" style="width:80px" placeholder="北" />
                </div>
              </div>
              <div class="action-row" style="margin-bottom:0.5rem">
                <label class="form-label" style="margin:0;min-width:auto">尺寸</label>
                <input class="form-input" type="number" v-model.number="gmWidth" min="1" style="width:70px" />
                <span>×</span>
                <input class="form-input" type="number" v-model.number="gmHeight" min="1" style="width:70px" />
                <span class="form-hint" style="margin:0">px</span>
              </div>
              <div class="action-row">
                <label class="form-label" style="margin:0;min-width:auto">格式</label>
                <select class="form-select" v-model="gmFormat" style="width:auto">
                  <option>image/png</option><option>image/jpeg</option>
                </select>
                <label style="display:flex;align-items:center;gap:4px;font-size:0.75rem;color:#a0a0a0"><input type="checkbox" v-model="gmTransparent" /> TRANSPARENT</label>
              </div>
            </div>
          </div>
          <div class="action-row" style="margin-top:0.5rem">
            <button class="btn btn-primary btn-small" @click="genGetMap">生成 GetMap URL</button>
            <button class="btn btn-secondary btn-small" @click="copyGmUrl" v-if="gmUrl">复制 URL</button>
          </div>
          <textarea class="form-textarea" :value="gmUrl" readonly style="min-height:60px" v-if="gmUrl"></textarea>
        </div>
      </section>
      <div class="tool-footer">WMS Capabilities 解析器 · 纯本地解析 · 支持版本 1.1.1 / 1.3.0</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseCapabilities, buildGetMapUrl, SAMPLE_WMS, type WmsResult, type WmsLayer } from '../utils/wms-capabilities'

const router = useRouter()
const goBack = () => router.push('/')

const wmsUrl = ref('')
const input = ref('')
const result = ref<WmsResult | null>(null)
const msg = ref('')
const msgType = ref('')

const showGetmap = ref(false)
const gmBase = ref('')
const gmLayers = ref('')
const gmStyles = ref('')
const gmVersion = ref('1.3.0')
const gmCrs = ref('EPSG:4326')
const gmBbox = ref({ west: 0, south: 0, east: 0, north: 0 })
const gmWidth = ref(512)
const gmHeight = ref(512)
const gmFormat = ref('image/png')
const gmTransparent = ref(true)
const gmUrl = ref('')

function doParse() {
  const text = input.value.trim()
  if (!text) { msg.value = '请先粘贴 XML 或填写 URL'; msgType.value = 'err'; return }
  const r = parseCapabilities(text)
  result.value = r
  if (!r.ok) { msg.value = r.errors.join('；'); msgType.value = 'err' }
  else { msg.value = `解析成功：WMS ${r.version}，${r.layerCount} 个图层`; msgType.value = 'ok' }
}

function loadSample() { input.value = SAMPLE_WMS; doParse() }
function clearAll() { input.value = ''; result.value = null; msg.value = ''; showGetmap.value = false }

async function fetchUrl() {
  const url = wmsUrl.value.trim()
  if (!url) { msg.value = '请先填写 URL'; msgType.value = 'err'; return }
  const full = url.indexOf('GetCapabilities') >= 0 ? url : url + (url.indexOf('?') >= 0 ? '&' : '?') + 'service=WMS&version=1.3.0&request=GetCapabilities'
  msg.value = '正在拉取（需 CORS）…'; msgType.value = ''
  try {
    const res = await fetch(full)
    if (!res.ok) throw new Error('HTTP ' + res.status)
    const text = await res.text()
    input.value = text.slice(0, 500000)
    doParse()
  } catch (e) {
    msg.value = '拉取失败：' + (e as Error).message + '。推荐：浏览器直接打开地址，复制 XML 粘贴'; msgType.value = 'err'
  }
}

function fillGetmap(lyr: WmsLayer) {
  showGetmap.value = true
  const ops = result.value?.formats.operations
  const getMapUrl = ops?.GetMap?.urls?.[0]?.url || result.value?.service.onlineResource || ''
  gmBase.value = getMapUrl
  gmLayers.value = lyr.name || ''
  gmVersion.value = /^1\.1/.test(result.value?.version || '') ? '1.1.1' : '1.3.0'
  if (lyr.bbox) {
    gmCrs.value = 'EPSG:4326'
    gmBbox.value = { west: lyr.bbox.west, south: lyr.bbox.south, east: lyr.bbox.east, north: lyr.bbox.north }
  } else if (lyr.bboxes.length) {
    const b = lyr.bboxes[0]!
    gmCrs.value = b.crs || 'EPSG:4326'
    gmBbox.value = { west: parseFloat(b.minx), south: parseFloat(b.miny), east: parseFloat(b.maxx), north: parseFloat(b.maxy) }
  }
}

function genGetMap() {
  gmUrl.value = buildGetMapUrl({
    baseUrl: gmBase.value, version: gmVersion.value, layers: gmLayers.value, styles: gmStyles.value,
    crs: gmCrs.value, bbox: gmBbox.value, width: gmWidth.value, height: gmHeight.value,
    format: gmFormat.value, transparent: gmTransparent.value
  })
}

function copyGmUrl() { navigator.clipboard?.writeText(gmUrl.value) }
</script>
