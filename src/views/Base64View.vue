<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">Base64 编解码工具</h1>
      <span class="page-subtitle">Base64 ↔ 文本 / 文件 · Data URL 识别 · 纯本地</span>
    </div>
    <div class="tool-main">
      <section class="panel" style="margin-bottom:1rem">
        <div class="panel-head"><span class="t">输入</span></div>
        <div class="panel-body">
          <textarea class="form-textarea" v-model="inputVal" placeholder="在此粘贴 Base64 字符串或普通文本…&#10;支持 Data URL 格式：data:image/png;base64,iVBORw0KGgo…"></textarea>
          <div class="action-row" style="margin-top:0.5rem">
            <button class="btn btn-primary btn-small" @click="decodeText">解码为文本</button>
            <button class="btn btn-secondary btn-small" @click="decodeFile">解码为文件</button>
            <button class="btn btn-secondary btn-small" @click="encodeText">文本编码 Base64</button>
            <label class="btn btn-secondary btn-small" style="cursor:pointer">上传文件编码
              <input type="file" style="display:none" @change="encodeFile" />
            </label>
            <button class="btn btn-secondary btn-small" @click="clearAll" style="margin-left:auto">清空</button>
          </div>
          <div class="form-hint" v-if="infoTags.length">
            <span v-for="(t, i) in infoTags" :key="i" class="tag" style="margin-right:4px">{{ t }}</span>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head">
          <span class="t">结果</span>
          <div class="spacer"></div>
          <button class="btn btn-secondary btn-small" @click="copyResult">复制</button>
        </div>
        <div class="panel-body">
          <div class="tabs" style="margin-bottom:0.5rem">
            <button class="tab" :class="{ active: activeTab === 'text' }" @click="activeTab = 'text'">文本</button>
            <button class="tab" :class="{ active: activeTab === 'image' }" @click="activeTab = 'image'">图片</button>
            <button class="tab" :class="{ active: activeTab === 'file' }" @click="activeTab = 'file'">文件</button>
          </div>
          <div v-show="activeTab === 'text'">
            <div v-if="resultText" class="form-textarea" readonly style="white-space:pre-wrap;word-break:break-all;max-height:360px;overflow-y:auto;cursor:default;background:rgba(255,255,255,0.02);color:#a0a0a0;padding:0.625rem 1rem">{{ resultText }}</div>
            <div v-else class="form-hint" style="text-align:center;padding:2rem 0">解码 / 编码结果将显示在此处</div>
          </div>
          <div v-show="activeTab === 'image'">
            <div v-if="resultImageUrl" style="text-align:center;padding:0.5rem">
              <img :src="resultImageUrl" alt="预览" style="max-width:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.1)" />
            </div>
            <div v-else class="form-hint" style="text-align:center;padding:2rem 0">Base64 图片预览将显示在此处</div>
          </div>
          <div v-show="activeTab === 'file'">
            <div v-if="resultBlob" class="action-row" style="padding:0.75rem;background:rgba(255,255,255,0.03);border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
              <span style="font-size:1.5rem">📄</span>
              <div style="flex:1">
                <div style="font-weight:600;font-size:0.8125rem">{{ resultFileName }}</div>
                <div class="form-hint">{{ resultFileMeta }}</div>
              </div>
              <button class="btn btn-primary btn-small" @click="downloadResult">下载</button>
            </div>
            <div v-else class="form-hint" style="text-align:center;padding:2rem 0">文件下载将显示在此处</div>
          </div>
        </div>
      </section>
      <div class="tool-footer">纯本地运行 · 数据不离开浏览器 · 支持 Data URL 自动识别</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseDataUrl, mimeToExt, formatSize, base64ToText, base64ToBytes, textToBase64, fileToBase64 } from '../utils/base64-tool'

const router = useRouter()
const goBack = () => router.push('/')

const inputVal = ref('')
const resultText = ref('')
const resultBlob = ref<Blob | null>(null)
const resultFileName = ref('')
const resultFileMeta = ref('')
const resultImageUrl = ref('')
const activeTab = ref<'text' | 'image' | 'file'>('text')
const infoTags = ref<string[]>([])

function decodeText() {
  const raw = inputVal.value.trim()
  if (!raw) { infoTags.value = ['请先输入内容']; return }
  const parsed = parseDataUrl(raw)
  const clean = parsed.data.replace(/\s/g, '')
  try {
    const decoded = base64ToText(clean)
    resultText.value = decoded
    resultBlob.value = null
    resultImageUrl.value = ''
    activeTab.value = 'text'
    infoTags.value = []
  } catch {
    infoTags.value = ['解码失败：无效的 Base64']
  }
}

function decodeFile() {
  const raw = inputVal.value.trim()
  if (!raw) { infoTags.value = ['请先输入内容']; return }
  const parsed = parseDataUrl(raw)
  const clean = parsed.data.replace(/\s/g, '')
  try {
    const bytes = base64ToBytes(clean)
    const mime = parsed.mime || 'application/octet-stream'
    const ext = mimeToExt(mime)
    const blob = new Blob([bytes], { type: mime })
    resultBlob.value = blob
    resultFileName.value = 'decoded.' + ext
    resultFileMeta.value = formatSize(bytes.length) + ' · ' + mime
    resultText.value = ''
    if (mime.startsWith('image/')) {
      resultImageUrl.value = URL.createObjectURL(blob)
      activeTab.value = 'image'
    } else {
      activeTab.value = 'file'
    }
    infoTags.value = []
  } catch {
    infoTags.value = ['解码失败：无效的 Base64']
  }
}

function encodeText() {
  const raw = inputVal.value
  if (!raw) { infoTags.value = ['请先输入内容']; return }
  const encoded = textToBase64(raw)
  resultText.value = encoded
  resultBlob.value = null
  resultImageUrl.value = ''
  activeTab.value = 'text'
  infoTags.value = [raw.length + ' 字符', encoded.length + ' Base64 字符']
}

async function encodeFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    const dataUrl = await fileToBase64(f)
    resultText.value = dataUrl
    inputVal.value = dataUrl
    if (f.type.startsWith('image/')) {
      resultImageUrl.value = dataUrl
      activeTab.value = 'image'
    } else {
      activeTab.value = 'text'
    }
    infoTags.value = [f.type || '未知', formatSize(f.size), dataUrl.length + ' 字符']
  } catch {
    infoTags.value = ['文件读取失败']
  }
  (e.target as HTMLInputElement).value = ''
}

function downloadResult() {
  if (!resultBlob.value) return
  const url = URL.createObjectURL(resultBlob.value)
  const a = document.createElement('a')
  a.href = url
  a.download = resultFileName.value
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function copyResult() {
  const text = resultText.value || (resultBlob.value ? resultFileName.value : '')
  if (text) navigator.clipboard?.writeText(text)
}

function clearAll() {
  inputVal.value = ''
  resultText.value = ''
  resultBlob.value = null
  resultImageUrl.value = ''
  resultFileName.value = ''
  resultFileMeta.value = ''
  infoTags.value = []
  activeTab.value = 'text'
}
</script>
