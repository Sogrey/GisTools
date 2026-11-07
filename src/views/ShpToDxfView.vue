<template>
  <div class="tool-container">
    <header class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">多 SHP → 单 DXF</h1>
      <span class="page-subtitle">批量合并 · 一层一 shp · 纯前端</span>
    </header>

    <main class="tool-main compact-page">
      <div class="info-box" style="margin-bottom: 0.75rem">
        <span>
          目录 / ZIP → <strong style="color:#c0c0c0">单个 DXF</strong>（非真 DWG），一层一 shp + 图层对照 CSV。
          坐标为常用投影 / 四七参数，<strong style="color:#c0c0c0">不含完整 PROJ</strong>。
        </span>
      </div>

      <!-- 上传 -->
      <div class="panel compact-panel" style="margin-bottom: 0.75rem">
        <div class="panel-head">
          <span class="t">源数据</span>
          <span class="spacer"></span>
          <span v-if="groups.length" class="msg ok">已识别 {{ groups.length }} 个 SHP</span>
          <button class="btn btn-primary btn-small" @click="folderInput?.click()">选择文件夹</button>
          <button class="btn btn-secondary btn-small" @click="fileInput?.click()">选择文件 / ZIP</button>
          <button class="btn btn-secondary btn-small" :disabled="!groups.length" @click="resetAll">重置</button>
        </div>
        <div class="panel-body">
          <div
            class="upload-zone compact-upload"
            :class="{ dragging: isDragging, 'has-file': groups.length > 0 }"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="onDrop"
            @click="!groups.length && fileInput?.click()"
          >
            <template v-if="!groups.length">
              <p style="margin: 0">📁 拖放 .zip / .shp 到此处，或点上方按钮选文件夹</p>
            </template>
            <template v-else>
              <div class="file-status">
                <span class="msg ok">✅ {{ groups.length }} 个图层候选</span>
                <span class="msg" style="font-size: 0.75rem">无 .prj：{{ missingPrj }} · 无 .dbf：{{ missingDbf }}</span>
              </div>
            </template>
          </div>
          <input
            ref="folderInput"
            type="file"
            style="display: none"
            webkitdirectory
            multiple
            @change="onFolderPick"
          />
          <input
            ref="fileInput"
            type="file"
            style="display: none"
            accept=".shp,.dbf,.prj,.cpg,.zip,.shx"
            multiple
            @change="onFilePick"
          />
          <div v-if="loadMsg" class="msg" :class="loadMsgType">{{ loadMsg }}</div>
        </div>
      </div>

      <!-- 选项 + CRS -->
      <div class="tool-grid compact-grid" style="margin-bottom: 0.75rem">
        <div class="panel compact-panel">
          <div class="panel-head"><span class="t">转换选项</span></div>
          <div class="panel-body">
            <div class="form-group tight">
              <label class="form-label">DBF 编码</label>
              <select v-model="encoding" class="form-select">
                <option value="">自动（.cpg / UTF-8）</option>
                <option value="utf-8">UTF-8</option>
                <option value="gbk">GBK</option>
                <option value="gb2312">GB2312</option>
                <option value="big5">Big5</option>
              </select>
            </div>
            <div class="form-group tight">
              <label class="form-label">注记 / 高程点字高</label>
              <input v-model.number="textHeight" type="number" min="0.1" step="0.5" class="form-input" />
            </div>
            <div class="form-group tight" style="margin-bottom: 0">
              <label class="form-label" style="display: flex; align-items: center; gap: 0.5rem; margin: 0">
                <input v-model="writeAnno" type="checkbox" />
                点要素属性写 TEXT（NAME/注记/高程）
              </label>
            </div>
          </div>
        </div>

        <div class="panel compact-panel">
          <div class="panel-head">
            <span class="t">可选坐标变换</span>
            <span class="spacer"></span>
            <router-link class="btn btn-secondary btn-small" to="/tools/seven-param">七参数</router-link>
            <router-link class="btn btn-secondary btn-small" to="/tools/band-lookup">投影带</router-link>
          </div>
          <div class="panel-body">
            <div class="form-group tight" :style="{ marginBottom: crsMode === 'none' ? 0 : undefined }">
              <label class="form-label">模式（非全量 PROJ）</label>
              <select v-model="crsMode" class="form-select">
                <option value="none">不转换（保持源坐标）</option>
                <option value="reproject">常用投影 / 纠偏</option>
                <option value="seven">七参数 Bursa-Wolf</option>
                <option value="four">四参数</option>
              </select>
            </div>

            <template v-if="crsMode === 'reproject'">
              <div class="action-row" style="flex-wrap: wrap">
                <select v-model="srcCrs" class="form-select" style="width: 140px">
                  <option value="EPSG:4326">WGS84</option>
                  <option value="EPSG:3857">Web 墨卡托</option>
                  <option value="EPSG:4490">CGCS2000</option>
                  <option value="GCJ02">GCJ02</option>
                  <option value="BD09">BD09</option>
                </select>
                <span style="color: #606060">→</span>
                <select v-model="dstCrs" class="form-select" style="width: 140px">
                  <option value="EPSG:3857">Web 墨卡托</option>
                  <option value="EPSG:4326">WGS84</option>
                  <option value="EPSG:4490">CGCS2000</option>
                  <option value="GCJ02">GCJ02</option>
                  <option value="BD09">BD09</option>
                </select>
              </div>
            </template>

            <template v-if="crsMode === 'seven'">
              <div class="param-grid">
                <label>dx<input v-model.number="sp.dx" type="number" step="any" class="form-input" /></label>
                <label>dy<input v-model.number="sp.dy" type="number" step="any" class="form-input" /></label>
                <label>dz<input v-model.number="sp.dz" type="number" step="any" class="form-input" /></label>
                <label>rx″<input v-model.number="sp.rx" type="number" step="any" class="form-input" /></label>
                <label>ry″<input v-model.number="sp.ry" type="number" step="any" class="form-input" /></label>
                <label>rz″<input v-model.number="sp.rz" type="number" step="any" class="form-input" /></label>
                <label>k ppm<input v-model.number="sp.ppm" type="number" step="any" class="form-input" /></label>
              </div>
              <p class="hint">作用在坐标数值上；转换前请试算。</p>
            </template>

            <template v-if="crsMode === 'four'">
              <div class="param-grid">
                <label>dx<input v-model.number="fp.dx" type="number" step="any" class="form-input" /></label>
                <label>dy<input v-model.number="fp.dy" type="number" step="any" class="form-input" /></label>
                <label>旋转°<input v-model.number="fp.rotD" type="number" step="any" class="form-input" /></label>
                <label>尺度 k<input v-model.number="fp.k" type="number" step="any" class="form-input" /></label>
              </div>
            </template>

            <div class="action-row" v-if="crsMode !== 'none' && groups.length">
              <button class="btn btn-secondary btn-small" @click="runTrial">试算预览</button>
            </div>
            <pre v-if="trialText" class="trial-box">{{ trialText }}</pre>
          </div>
        </div>
      </div>

      <!-- 操作 -->
      <div class="action-row" style="margin-bottom: 0.75rem">
        <button class="btn btn-primary" :disabled="!groups.length || running" @click="runConvert">
          {{ running ? `转换中… ${progress}%` : '开始转换 → DXF' }}
        </button>
        <button class="btn btn-secondary" :disabled="!dxfOut" @click="downloadDxf">下载 .dxf</button>
        <button class="btn btn-secondary" :disabled="!csvOut" @click="downloadCsv">下载图层对照 .csv</button>
        <span class="msg" :class="runMsgType">{{ runMsg }}</span>
      </div>

      <div v-if="running || progressMsg" class="progress-bar" style="margin-bottom: 0.5rem">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <div v-if="progressMsg" class="msg" style="margin-bottom: 0.75rem; font-size: 0.75rem">{{ progressMsg }}</div>

      <!-- 对照表预览 -->
      <div class="panel compact-panel" v-if="reports.length" style="margin-bottom: 0.75rem">
        <div class="panel-head">
          <span class="t">图层对照</span>
          <span class="spacer"></span>
          <span class="msg ok">实体 {{ entityCount }} · 图层 {{ layerCount }} · 要素 {{ totalFeatures }}</span>
        </div>
        <div class="panel-body" style="overflow-x: auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>图层名</th>
                <th>源路径</th>
                <th>要素数</th>
                <th>几何</th>
                <th>源 CRS</th>
                <th>变换</th>
                <th>错误</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in reports" :key="i">
                <td>{{ r.layerName }}</td>
                <td style="font-size: 0.75rem; max-width: 220px; word-break: break-all">{{ r.sourcePath }}</td>
                <td>{{ r.featureCount }}</td>
                <td>{{ r.shapeType }}</td>
                <td style="font-size: 0.75rem">{{ r.sourceCrs }}</td>
                <td style="font-size: 0.75rem">{{ r.transform }}</td>
                <td class="msg err" style="font-size: 0.75rem">{{ r.error || '' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="tool-footer">
        DXF（AC1009）；真 DWG 请 CAD 另存。&gt;10 万要素卡顿可再评估 WASM；全量 EPSG / DWG 留给后端。数据仅本地处理。
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import {
  filesToNamedBuffers,
  pairShpGroups,
  convertShpBatchToDxf,
  trialTransformSample,
  type ShpGroup,
  type LayerReport,
  type CrsTransformOptions,
} from '../utils/shp-to-dxf'

const router = useRouter()
const goBack = () => router.push('/')

const folderInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const groups = ref<ShpGroup[]>([])
const loadMsg = ref('')
const loadMsgType = ref('')

const encoding = ref('')
const textHeight = ref(2.5)
const writeAnno = ref(true)

const crsMode = ref<'none' | 'reproject' | 'seven' | 'four'>('none')
const srcCrs = ref('EPSG:4326')
const dstCrs = ref('EPSG:3857')
const sp = reactive({ dx: 0, dy: 0, dz: 0, rx: 0, ry: 0, rz: 0, ppm: 0 })
const fp = reactive({ dx: 0, dy: 0, rotD: 0, k: 1 })
const trialText = ref('')

const running = ref(false)
const progress = ref(0)
const progressMsg = ref('')
const runMsg = ref('')
const runMsgType = ref('')

const dxfOut = ref('')
const csvOut = ref('')
const reports = ref<LayerReport[]>([])
const entityCount = ref(0)
const layerCount = ref(0)
const totalFeatures = ref(0)

const missingPrj = computed(() => groups.value.filter((g) => !g.prj).length)
const missingDbf = computed(() => groups.value.filter((g) => !g.dbf).length)

function buildCrs(): CrsTransformOptions {
  if (crsMode.value === 'reproject') {
    return { mode: 'reproject', srcCrs: srcCrs.value, dstCrs: dstCrs.value }
  }
  if (crsMode.value === 'seven') {
    return {
      mode: 'seven',
      dx: sp.dx,
      dy: sp.dy,
      dz: sp.dz,
      rx: sp.rx,
      ry: sp.ry,
      rz: sp.rz,
      ppm: sp.ppm,
    }
  }
  if (crsMode.value === 'four') {
    return { mode: 'four', dx: fp.dx, dy: fp.dy, rotD: fp.rotD, k: fp.k }
  }
  return { mode: 'none' }
}

async function ingestFiles(list: FileList | File[]) {
  loadMsg.value = '读取文件…'
  loadMsgType.value = ''
  try {
    const buffers = await filesToNamedBuffers(list)
    const paired = pairShpGroups(buffers)
    groups.value = paired
    dxfOut.value = ''
    csvOut.value = ''
    reports.value = []
    trialText.value = ''
    if (!paired.length) {
      loadMsg.value = '未找到 .shp 文件，请确认目录或 ZIP 内容'
      loadMsgType.value = 'err'
    } else {
      loadMsg.value = `已配对 ${paired.length} 个 SHP`
      loadMsgType.value = 'ok'
    }
  } catch (e) {
    loadMsg.value = e instanceof Error ? e.message : String(e)
    loadMsgType.value = 'err'
  }
}

function onFolderPick(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files?.length) void ingestFiles(input.files)
  input.value = ''
}

function onFilePick(ev: Event) {
  const input = ev.target as HTMLInputElement
  if (input.files?.length) void ingestFiles(input.files)
  input.value = ''
}

function onDrop(ev: DragEvent) {
  isDragging.value = false
  const dt = ev.dataTransfer
  if (!dt?.files?.length) return
  void ingestFiles(dt.files)
}

function resetAll() {
  groups.value = []
  dxfOut.value = ''
  csvOut.value = ''
  reports.value = []
  loadMsg.value = ''
  runMsg.value = ''
  trialText.value = ''
  progress.value = 0
  progressMsg.value = ''
}

function runTrial() {
  if (!groups.value.length) return
  try {
    const crs = buildCrs()
    const sample = trialTransformSample(groups.value[0]!, crs, 3)
    const lines = [`试算（图层样本: ${groups.value[0]!.baseName}）`, `变换: ${sample.crsLabel}`, '']
    for (let i = 0; i < sample.before.length; i++) {
      const b = sample.before[i]!
      const a = sample.after[i]!
      lines.push(
        `#${i + 1}  ${b.map((v) => v.toFixed(4)).join(', ')}  →  ${a.map((v) => v.toFixed(4)).join(', ')}`,
      )
    }
    if (!sample.before.length) lines.push('（该图层无可用坐标点）')
    trialText.value = lines.join('\n')
  } catch (e) {
    trialText.value = e instanceof Error ? e.message : String(e)
  }
}

async function runConvert() {
  if (!groups.value.length || running.value) return
  running.value = true
  progress.value = 0
  progressMsg.value = ''
  runMsg.value = ''
  runMsgType.value = ''
  try {
    const result = await convertShpBatchToDxf(groups.value, {
      encoding: encoding.value || undefined,
      textHeight: textHeight.value,
      writeAnnotationText: writeAnno.value,
      crs: buildCrs(),
      onProgress: (p, msg) => {
        progress.value = p
        progressMsg.value = msg
      },
    })
    dxfOut.value = result.dxf
    csvOut.value = result.csv
    reports.value = result.reports
    entityCount.value = result.entityCount
    layerCount.value = result.layerCount
    totalFeatures.value = result.totalFeatures
    const errs = result.reports.filter((r) => r.error).length
    runMsg.value = errs
      ? `完成（${errs} 个图层有错误，见对照表）`
      : `完成：${result.layerCount} 图层 / ${result.totalFeatures} 要素 / ${result.entityCount} 实体`
    runMsgType.value = errs ? 'err' : 'ok'
  } catch (e) {
    runMsg.value = e instanceof Error ? e.message : String(e)
    runMsgType.value = 'err'
  } finally {
    running.value = false
  }
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadDxf() {
  if (!dxfOut.value) return
  const name = groups.value[0]?.baseName || 'merged'
  downloadBlob(dxfOut.value, `${name}_merged.dxf`, 'application/dxf')
}

function downloadCsv() {
  if (!csvOut.value) return
  const name = groups.value[0]?.baseName || 'merged'
  downloadBlob(csvOut.value, `${name}_图层对照表.csv`, 'text/csv;charset=utf-8')
}
</script>

<style scoped>
/* 覆盖 tool-common 的 panel min-height:400px，避免大片空白 */
.compact-panel.panel {
  min-height: 0;
}
.compact-panel :deep(.panel-body),
.compact-panel .panel-body {
  flex: none;
  padding: 0.75rem 1rem;
  gap: 0.5rem;
}
.compact-panel :deep(.panel-head),
.compact-panel .panel-head {
  padding: 0.625rem 1rem;
}
.compact-upload.upload-zone {
  padding: 1.75rem 1rem;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.compact-upload .upload-icon {
  font-size: 1.5rem;
}
.form-group.tight {
  margin-bottom: 0.5rem;
}
.compact-grid.tool-grid {
  align-items: start;
}
.hint {
  font-size: 0.75rem;
  color: #606060;
  margin: 0.35rem 0 0;
  line-height: 1.4;
}
.param-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 0.4rem;
}
.param-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  font-size: 0.75rem;
  color: #a0a0a0;
}
.trial-box {
  margin: 0.35rem 0 0;
  padding: 0.5rem 0.75rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  font-size: 0.75rem;
  color: #c0c0c0;
  white-space: pre-wrap;
  max-height: 140px;
  overflow: auto;
  font-family: 'Cascadia Code', Consolas, monospace;
}
a.btn {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
}
</style>
