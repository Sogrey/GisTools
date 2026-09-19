<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">glTF / GLB 元信息提取器</h1>
      <span class="page-subtitle">解析二进制结构 · 输出模型元数据统计</span>
    </div>
    <div class="tool-main">
      <section class="panel" style="margin-bottom:1rem">
        <div class="panel-head">
          <span class="t">输入</span>
          <div class="spacer"></div>
          <label class="btn btn-secondary btn-small" style="cursor:pointer">上传 .glb/.gltf
            <input type="file" accept=".glb,.gltf" style="display:none" @change="onFile" />
          </label>
        </div>
        <div class="panel-body">
          <textarea class="form-textarea" v-model="jsonInput" placeholder="或直接粘贴 .gltf JSON 文本（Ctrl+Enter 解析）" @keydown.ctrl.enter.prevent="parsePasted" @keydown.meta.enter.prevent="parsePasted"></textarea>
          <div class="action-row" style="margin-top:0.5rem">
            <button class="btn btn-primary btn-small" @click="parsePasted">解析粘贴内容</button>
            <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
          </div>
          <div class="msg err" v-if="errMsg">{{ errMsg }}</div>
          <div class="msg warn" v-if="warnMsg">{{ warnMsg }}</div>
        </div>
      </section>
      <template v-if="analysis">
        <div class="result-grid" style="margin-bottom:1rem">
          <div class="result-card"><span class="label">glTF 版本</span><span class="value">{{ (analysis.asset.version as string) || '—' }}</span><span class="sub">{{ meta?.container }}</span></div>
          <div class="result-card"><span class="label">网格数</span><span class="value">{{ analysis.meshRows.length }}</span></div>
          <div class="result-card"><span class="label">顶点数</span><span class="value">{{ fmtNum(analysis.totals.verts) }}</span></div>
          <div class="result-card"><span class="label">三角面</span><span class="value">{{ fmtNum(analysis.totals.tris) }}</span><span class="sub">{{ analysis.totals.est ? '含估算' : '精确' }}</span></div>
        </div>
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head"><span class="t">网格统计</span></div>
          <div class="panel-body">
            <table class="data-table">
              <thead><tr><th>网格</th><th>Primitive</th><th>顶点数</th><th>三角面</th><th>索引</th><th>图元模式</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in analysis.meshRows" :key="i">
                  <td>{{ r.name }}</td><td>{{ r.prims }}</td><td>{{ fmtNum(r.verts) }}</td>
                  <td>{{ r.est > 0 ? '~' + fmtNum(r.tris) : fmtNum(r.tris) }}</td>
                  <td>{{ r.hasIdx ? '有' : '无(估算)' }}</td><td>{{ r.modes }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head"><span class="t">材质列表</span></div>
          <div class="panel-body">
            <table class="data-table" v-if="analysis.matRows.length">
              <thead><tr><th>材质</th><th>引用</th><th>BaseColor</th><th>金属度</th><th>粗糙度</th><th>双面</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in analysis.matRows" :key="i">
                  <td>{{ r.name }}</td><td>{{ r.used }}</td><td>{{ r.base }}</td>
                  <td>{{ r.metallic ?? '—' }}</td><td>{{ r.roughness ?? '—' }}</td>
                  <td>{{ r.doubleSided ? '是' : '否' }}</td>
                </tr>
              </tbody>
            </table>
            <div class="form-hint" v-else>无材质</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">资源概览</span></div>
          <div class="panel-body">
            <table class="data-table">
              <thead><tr><th>资源</th><th>数量</th><th>说明</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in analysis.overview" :key="i"><td>{{ r[0] }}</td><td>{{ r[1] }}</td><td>{{ r[2] }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
      <div class="tool-footer">glTF/GLB 元信息提取器 · 纯本地运行 · 支持 glTF 2.0</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseGLB, parseGltfText, analyzeGltf, fmtBytes, fmtNum, type GlbMeta, type GlbAnalysis } from '../utils/gltf-info'

const router = useRouter()
const goBack = () => router.push('/')

const jsonInput = ref('')
const meta = ref<GlbMeta | null>(null)
const analysis = ref<GlbAnalysis | null>(null)
const errMsg = ref('')
const warnMsg = ref('')

function showResult(m: GlbMeta, fileName: string) {
  meta.value = m
  analysis.value = analyzeGltf(m.gltf)
  warnMsg.value = m.warnings.length ? m.warnings.join('；') : ''
  errMsg.value = ''
}

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const name = f.name.toLowerCase()
  const ext = name.split('.').pop()
  try {
    if (ext === 'glb') {
      const buf = await f.arrayBuffer()
      showResult(parseGLB(buf), f.name)
    } else if (ext === 'gltf') {
      const text = await f.text()
      showResult(parseGltfText(text), f.name)
    } else {
      throw new Error(`不支持的文件类型 "${ext}"`)
    }
  } catch (e) {
    errMsg.value = '解析失败：' + (e as Error).message
    analysis.value = null
  }
  (e.target as HTMLInputElement).value = ''
}

function parsePasted() {
  const t = jsonInput.value.trim()
  if (!t) { errMsg.value = '请先粘贴 .gltf JSON 文本'; return }
  try {
    showResult(parseGltfText(t), '粘贴的 glTF JSON')
  } catch (e) {
    errMsg.value = '解析失败：' + (e as Error).message
    analysis.value = null
  }
}

function clearAll() {
  jsonInput.value = ''
  meta.value = null
  analysis.value = null
  errMsg.value = ''
  warnMsg.value = ''
}
</script>
