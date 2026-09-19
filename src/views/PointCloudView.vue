<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">点云元信息查看器</h1>
      <span class="page-subtitle">LAS/LAZ 二进制头部解析 · 签名 / 版本 / 点数 / 点格式 / BBOX</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">点云文件输入</span></div>
          <div class="panel-body">
            <div class="upload-zone" @click="fileInput?.click()" @dragover.prevent @drop.prevent="onDrop">
              <div style="font-size:2rem;opacity:0.6">📁</div>
              <div style="margin-top:0.5rem">点击或拖拽上传 .las / .laz 文件</div>
              <div class="form-hint">仅解析头部与 VLR，文件不离开本机</div>
            </div>
            <input type="file" ref="fileInput" accept=".las,.laz" style="display:none" @change="onFile" />
            <div class="action-row" style="margin-top:0.5rem">
              <button class="btn btn-secondary btn-small" @click="loadDemo">载入演示 LAS</button>
            </div>
            <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err', warn: msgType === 'warn' }" v-if="msg">{{ msg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">解析结果</span></div>
          <div class="panel-body" v-if="result && result.ok">
            <div class="result-grid" style="margin-bottom:1rem">
              <div class="result-card"><span class="label">LAS 版本</span><span class="value">{{ result.versionText }}</span><span class="sub">{{ result.isCompressed ? 'LAZ 压缩' : '未压缩' }}</span></div>
              <div class="result-card"><span class="label">点数</span><span class="value">{{ result.numPoints.toLocaleString() }}</span></div>
              <div class="result-card"><span class="label">点格式</span><span class="value">{{ result.pointFormat }}</span><span class="sub">{{ result.pointFormatName }}</span></div>
              <div class="result-card"><span class="label">记录长度/文件大小</span><span class="value" style="font-size:0.75rem">{{ result.pointRecordLength }} B / {{ fmtSize(result.fileLength) }}</span></div>
            </div>
            <div class="msg warn" v-if="result.warnings.length" style="margin-bottom:0.5rem">{{ result.warnings.join('；') }}</div>
            <div class="form-group">
              <label class="form-label">缩放与偏移</label>
              <table class="data-table">
                <tbody>
                  <tr><td>X/Y/Z 缩放因子</td><td>{{ result.scale.x }} / {{ result.scale.y }} / {{ result.scale.z }}</td></tr>
                  <tr><td>X/Y/Z 偏移量</td><td>{{ result.offset.x }} / {{ result.offset.y }} / {{ result.offset.z }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="form-group">
              <label class="form-label">包围盒（BBOX）</label>
              <table class="data-table">
                <tbody>
                  <tr><td>X 范围</td><td>{{ result.bbox.minX }} ~ {{ result.bbox.maxX }}</td></tr>
                  <tr><td>Y 范围</td><td>{{ result.bbox.minY }} ~ {{ result.bbox.maxY }}</td></tr>
                  <tr><td>Z 范围</td><td>{{ result.bbox.minZ }} ~ {{ result.bbox.maxZ }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="form-group">
              <label class="form-label">文件基础信息</label>
              <table class="data-table">
                <tbody>
                  <tr><td>签名</td><td>{{ result.signature }}</td></tr>
                  <tr><td>系统标识</td><td>{{ result.systemIdentifier || '-' }}</td></tr>
                  <tr><td>生成软件</td><td>{{ result.generatingSoftware || '-' }}</td></tr>
                  <tr><td>建档时间</td><td>{{ result.creationDate || '未记录' }}</td></tr>
                  <tr><td>GUID</td><td>{{ result.guid }}</td></tr>
                  <tr><td>VLR 数量</td><td>{{ result.vlrCount }}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="panel-body" v-else-if="result && !result.ok">
            <div class="msg err">{{ result.errors.join('；') }}</div>
          </div>
          <div class="panel-body" v-else>
            <div class="form-hint" style="text-align:center;padding:3rem 0">上传 .las/.laz 文件或点击「载入演示 LAS」</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">点云元信息查看器 · 纯本地二进制解析 · LAS 1.0-1.4 / LAZ 头部</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseLasHeader, makeDemoLas, type LasResult } from '../utils/pointcloud'

const router = useRouter()
const goBack = () => router.push('/')

const fileInput = ref<HTMLInputElement | null>(null)
const result = ref<LasResult | null>(null)
const msg = ref('')
const msgType = ref('')

function fmtSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

function handleBuffer(name: string, buf: ArrayBuffer) {
  const r = parseLasHeader(buf)
  result.value = r
  if (!r.ok) { msg.value = `${name}：${r.errors.join('；')}`; msgType.value = 'err' }
  else { msg.value = `解析成功：LAS ${r.versionText}，${r.numPoints.toLocaleString()} 个点`; msgType.value = r.warnings.length ? 'warn' : 'ok' }
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  if (f.size < 227) { msg.value = '文件过小，不是有效 LAS 文件'; msgType.value = 'err'; return }
  const r = new FileReader()
  r.onload = () => handleBuffer(f.name, r.result as ArrayBuffer)
  r.readAsArrayBuffer(f)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  const f = e.dataTransfer?.files?.[0]
  if (!f) return
  if (f.size < 227) { msg.value = '文件过小'; msgType.value = 'err'; return }
  const r = new FileReader()
  r.onload = () => handleBuffer(f.name, r.result as ArrayBuffer)
  r.readAsArrayBuffer(f)
}

function loadDemo() {
  handleBuffer('demo.las', makeDemoLas())
}
</script>
