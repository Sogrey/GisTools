<template>
  <div class="tool-container">
    <!-- 头部 -->
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">WKT / WKB 工具箱</h1>
      <span class="page-subtitle">WKT ↔ GeoJSON · WKB/EWKB ↔ GeoJSON · 纯本地</span>
    </div>

    <!-- 标签页 -->
    <div class="tool-main">
      <div class="tabs">
        <button class="tab" :class="{ active: activeTab === 'wkt' }" @click="activeTab = 'wkt'">WKT 模式</button>
        <button class="tab" :class="{ active: activeTab === 'wkb' }" @click="activeTab = 'wkb'">WKB 模式</button>
      </div>

      <!-- ==================== WKT 模式 ==================== -->
      <div v-show="activeTab === 'wkt'" class="tool-grid">
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadWktSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearWkt">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="wktInput"
              class="form-textarea"
              placeholder="粘贴 WKT 或 GeoJSON 几何：&#10;&#10;POLYGON ((116.30 39.80, 116.50 39.80, 116.50 40.00, 116.30 39.80))&#10;&#10;自动识别方向"
            ></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runWkt">转换</button>
              <span class="msg" :class="wktMsgClass">{{ wktInMsg }}</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="t">输出</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyWktOutput">复制</button>
            <button class="btn btn-secondary btn-small" @click="downloadWktOutput">下载</button>
          </div>
          <div class="panel-body">
            <div class="stat-bar">
              <span>类型 <b>{{ wktStType }}</b></span>
              <span>顶点 <b>{{ wktStPts }}</b></span>
              <span style="flex:1"></span>
              <span class="msg" :class="{ ok: wktOutMsgType === 'ok' }">{{ wktOutMsg }}</span>
            </div>
            <textarea v-model="wktOutput" class="form-textarea" readonly placeholder="转换结果将显示在这里"></textarea>
          </div>
        </div>
      </div>

      <!-- ==================== WKB 模式 ==================== -->
      <div v-show="activeTab === 'wkb'" class="tool-grid">
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadWkbSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clearWkb">清空</button>
          </div>
          <div class="panel-body">
            <textarea
              v-model="wkbInput"
              class="form-textarea"
              placeholder="粘贴 WKB hex 或 GeoJSON 几何对象：&#10;&#10;WKB:   010100000000000000000024400000000000003440&#10;GeoJSON: {&quot;type&quot;:&quot;Point&quot;,&quot;coordinates&quot;:[10,20]}&#10;&#10;自动识别方向"
              @input="updateWkbDir"
            ></textarea>
            <div class="action-row">
              <button class="btn btn-primary" @click="runWkb">转换</button>
              <span class="dir-tag" :class="{ unknown: wkbDir === 'unknown' }">{{ wkbDirLabel }}</span>
              <span class="msg" :class="wkbMsgClass">{{ wkbInMsg }}</span>
            </div>
            <div class="action-row">
              <label class="wkb-label">WKB 输出:</label>
              <select v-model="wkbEndian" class="form-select" style="width:auto">
                <option value="1">小端 (LE)</option>
                <option value="0">大端 (BE)</option>
              </select>
              <label class="wkb-checkbox">
                <input type="checkbox" v-model="wkbIncludeSRID" /> 含 SRID (EWKB)
              </label>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span class="t">输出</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="copyWkbOutput">复制结果</button>
            <button class="btn btn-secondary btn-small" @click="copyWkbWkt">复制 WKT</button>
            <button class="btn btn-secondary btn-small" @click="downloadWkbOutput">下载</button>
          </div>
          <div class="panel-body">
            <div class="stat-bar">
              <span>类型 <b>{{ wkbStType }}</b></span>
              <span>SRID <b>{{ wkbStSRID }}</b></span>
              <span>字节序 <b>{{ wkbStEndian }}</b></span>
              <span>字节 <b>{{ wkbStBytes }}</b></span>
              <span style="flex:1"></span>
              <span class="msg" :class="{ ok: wkbOutMsgType === 'ok' }">{{ wkbOutMsg }}</span>
            </div>
            <label class="wkb-mini-label">转换结果</label>
            <textarea v-model="wkbOutput" class="form-textarea" style="min-height:120px" readonly placeholder="转换结果将显示在这里"></textarea>
            <label class="wkb-mini-label">WKT 对照</label>
            <textarea v-model="wkbWkt" class="form-textarea" style="min-height:60px;max-height:100px" readonly placeholder="WKT 文本将显示在这里"></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  wktToGeoJson, geoJsonToWkt,
  wkbToGeoJSON, geoJSONToWKB, geoJSONToWKT,
  wkbDetectDirection, countPts, cleanGeom,
} from '../utils/wkt-wkb'

const router = useRouter()
const goBack = () => router.push('/')

const activeTab = ref<'wkt' | 'wkb'>('wkt')

/* ---- WKT 模式状态 ---- */
const wktInput = ref('')
const wktOutput = ref('')
const wktInMsg = ref('')
const wktOutMsg = ref('')
const wktMsgClass = ref('')
const wktOutMsgType = ref('')
const wktStType = ref('—')
const wktStPts = ref(0)

/* ---- WKB 模式状态 ---- */
const wkbInput = ref('')
const wkbOutput = ref('')
const wkbWkt = ref('')
const wkbInMsg = ref('')
const wkbOutMsg = ref('')
const wkbMsgClass = ref('')
const wkbOutMsgType = ref('')
const wkbDir = ref<'geojson' | 'wkb' | 'unknown'>('unknown')
const wkbStType = ref('—')
const wkbStSRID = ref('—')
const wkbStEndian = ref('—')
const wkbStBytes = ref(0)
const wkbEndian = ref('1')
const wkbIncludeSRID = ref(false)

const wkbDirLabel = computed(() => {
  if (wkbDir.value === 'wkb') return 'WKB → GeoJSON'
  if (wkbDir.value === 'geojson') return 'GeoJSON → WKB'
  return '—'
})

/* ---- WKT 操作 ---- */

function runWkt() {
  const text = wktInput.value.trim()
  wktInMsg.value = ''
  wktOutMsg.value = ''
  wktMsgClass.value = ''
  wktOutMsgType.value = ''

  if (!text) {
    wktInMsg.value = '请输入内容'
    wktMsgClass.value = 'err'
    return
  }

  try {
    const isWkt = /^[A-Za-z]+\s*\(/.test(text)
    let res: string
    if (isWkt) {
      const gj = wktToGeoJson(text)
      res = JSON.stringify(gj, null, 2)
      wktStType.value = gj.type
      wktStPts.value = countPts(gj)
      wktInMsg.value = 'WKT → GeoJSON 成功'
    } else {
      const gj2 = JSON.parse(text)
      if (gj2.type === 'FeatureCollection' || gj2.type === 'Feature') {
        wktInMsg.value = '请粘贴单个几何对象（非 Feature/FeatureCollection）'
        wktMsgClass.value = 'err'
        return
      }
      res = geoJsonToWkt(gj2)
      wktStType.value = gj2.type
      wktStPts.value = countPts(gj2)
      wktInMsg.value = 'GeoJSON → WKT 成功'
    }
    wktMsgClass.value = 'ok'
    wktOutput.value = res
    wktOutMsg.value = '体积 ' + res.length + ' 字符'
    wktOutMsgType.value = 'ok'
  } catch (e) {
    wktInMsg.value = '解析失败: ' + (e as Error).message
    wktMsgClass.value = 'err'
  }
}

function loadWktSample() {
  wktInput.value = 'POLYGON ((116.30 39.80, 116.50 39.80, 116.50 40.00, 116.30 40.00, 116.30 39.80))'
  runWkt()
}

function clearWkt() {
  wktInput.value = ''
  wktOutput.value = ''
  wktInMsg.value = ''
  wktOutMsg.value = ''
  wktStType.value = '—'
  wktStPts.value = 0
}

function copyWktOutput() {
  if (!wktOutput.value) return
  navigator.clipboard.writeText(wktOutput.value).then(() => {
    wktOutMsg.value = '已复制'
    wktOutMsgType.value = 'ok'
    setTimeout(() => { wktOutMsg.value = '' }, 900)
  })
}

function downloadWktOutput() {
  if (!wktOutput.value) return
  const isJson = wktOutput.value.trim().startsWith('{')
  const blob = new Blob([wktOutput.value], { type: isJson ? 'application/json' : 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = isJson ? 'converted.geojson' : 'converted.wkt'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
}

/* ---- WKB 操作 ---- */

const wkbSamples = [
  '010100000000000000000024400000000000003440',
  '{"type":"Point","coordinates":[10,20]}',
  '0101000020e610000000000000000024400000000000003440',
  '{"type":"Polygon","coordinates":[[[0,0],[0,10],[10,10],[10,0],[0,0]]]}',
  '{"type":"MultiLineString","coordinates":[[[0,0],[1,1]],[[2,2],[3,3]]]}',
]
let wkbSampleIdx = 0

function updateWkbDir() {
  wkbDir.value = wkbDetectDirection(wkbInput.value)
}

function runWkb() {
  const text = wkbInput.value.trim()
  wkbInMsg.value = ''
  wkbOutMsg.value = ''
  wkbMsgClass.value = ''
  wkbOutMsgType.value = ''

  if (!text) {
    wkbInMsg.value = '请输入内容'
    wkbMsgClass.value = 'err'
    return
  }

  const dir = wkbDetectDirection(text)
  wkbDir.value = dir

  if (dir === 'unknown') {
    wkbInMsg.value = '无法识别（需 WKB hex 或 GeoJSON）'
    wkbMsgClass.value = 'err'
    return
  }

  try {
    if (dir === 'wkb') {
      const result = wkbToGeoJSON(text)
      const geom = result.geometry
      const info = result.wkbInfo
      wkbOutput.value = JSON.stringify(cleanGeom(geom), null, 2)
      wkbWkt.value = geoJSONToWKT(geom)
      wkbStType.value = geom.type
      wkbStSRID.value = info.srid != null ? String(info.srid) : '—'
      wkbStEndian.value = info.endian === 1 ? 'LE' : 'BE'
      wkbStBytes.value = result.totalBytes
      wkbInMsg.value = `WKB → GeoJSON (${result.bytesRead}/${result.totalBytes} bytes)`
      wkbMsgClass.value = 'ok'
      wkbOutMsg.value = '顶点 ' + countPts(geom)
      wkbOutMsgType.value = 'ok'
    } else {
      const gj = JSON.parse(text)
      if (gj.type === 'FeatureCollection' || gj.type === 'Feature') {
        wkbInMsg.value = '请粘贴单个几何对象（非 Feature/FeatureCollection）'
        wkbMsgClass.value = 'err'
        return
      }
      const le = wkbEndian.value === '1'
      const includeSRID = wkbIncludeSRID.value
      const hex = geoJSONToWKB(gj, le, includeSRID)
      wkbOutput.value = hex
      wkbWkt.value = geoJSONToWKT(gj)
      wkbStType.value = gj.type
      wkbStSRID.value = gj.srid != null ? String(gj.srid) : (includeSRID ? '—' : '无')
      wkbStEndian.value = le ? 'LE' : 'BE'
      wkbStBytes.value = hex.length / 2
      wkbInMsg.value = 'GeoJSON → WKB'
      wkbMsgClass.value = 'ok'
      wkbOutMsg.value = '顶点 ' + countPts(gj)
      wkbOutMsgType.value = 'ok'
    }
  } catch (e) {
    wkbInMsg.value = '解析失败: ' + (e as Error).message
    wkbMsgClass.value = 'err'
  }
}

function loadWkbSample() {
  wkbInput.value = wkbSamples[wkbSampleIdx % wkbSamples.length]!
  wkbSampleIdx++
  updateWkbDir()
  runWkb()
}

function clearWkb() {
  wkbInput.value = ''
  wkbOutput.value = ''
  wkbWkt.value = ''
  wkbInMsg.value = ''
  wkbOutMsg.value = ''
  wkbDir.value = 'unknown'
  wkbStType.value = '—'
  wkbStSRID.value = '—'
  wkbStEndian.value = '—'
  wkbStBytes.value = 0
}

function copyWkbOutput() {
  if (!wkbOutput.value) return
  navigator.clipboard.writeText(wkbOutput.value).then(() => {
    wkbOutMsg.value = '已复制'
    wkbOutMsgType.value = 'ok'
    setTimeout(() => { wkbOutMsg.value = '' }, 900)
  })
}

function copyWkbWkt() {
  if (!wkbWkt.value) return
  navigator.clipboard.writeText(wkbWkt.value).then(() => {
    wkbOutMsg.value = 'WKT 已复制'
    wkbOutMsgType.value = 'ok'
    setTimeout(() => { wkbOutMsg.value = '' }, 900)
  })
}

function downloadWkbOutput() {
  if (!wkbOutput.value) return
  const isHex = /^[0-9a-fA-F]+$/.test(wkbOutput.value.trim())
  const blob = new Blob([wkbOutput.value], { type: isHex ? 'application/octet-stream' : 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = isHex ? 'converted.wkb' : 'converted.geojson'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href) }, 500)
}
</script>

<style scoped>
.stat-bar {
  display: flex;
  gap: 0.875rem;
  align-items: center;
  padding: 0.5rem 0.75rem;
  background: rgba(102, 126, 234, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #a0a0a0;
  font-size: 0.8125rem;
  flex-wrap: wrap;
}

.stat-bar b {
  color: #ffffff;
}

.dir-tag {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 6px;
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.dir-tag.unknown {
  background: rgba(255, 255, 255, 0.03);
  color: #606060;
  border-color: rgba(255, 255, 255, 0.08);
}

.wkb-label {
  font-size: 0.8125rem;
  color: #a0a0a0;
}

.wkb-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  font-size: 0.8125rem;
  color: #a0a0a0;
  cursor: pointer;
}

.wkb-checkbox input {
  cursor: pointer;
}

.wkb-mini-label {
  font-size: 0.6875rem;
  color: #606060;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
