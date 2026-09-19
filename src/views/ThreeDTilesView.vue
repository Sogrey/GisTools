<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">3D Tiles 检查器</h1>
      <span class="page-subtitle">解析 tileset · 树形浏览 · geometricError / boundingVolume / transform 校验</span>
    </div>
    <div class="tool-main">
      <section class="panel" style="margin-bottom:1rem">
        <div class="panel-head">
          <span class="t">输入 tileset.json</span>
          <div class="spacer"></div>
          <button class="btn btn-primary btn-small" @click="doParse">解析并检查</button>
          <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
          <label class="btn btn-secondary btn-small" style="cursor:pointer">上传文件…
            <input type="file" accept=".json,.tileset,application/json" style="display:none" @change="onFile" />
          </label>
          <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
        </div>
        <div class="panel-body">
          <textarea class="form-textarea" v-model="input" placeholder="粘贴 tileset.json 内容，然后点击「解析并检查」…"></textarea>
        </div>
      </section>
      <template v-if="result">
        <div class="result-grid" style="margin-bottom:1rem">
          <div class="result-card"><span class="label">asset.version</span><span class="value">{{ result.version }}</span></div>
          <div class="result-card"><span class="label">总 Tile 数</span><span class="value">{{ result.nodes.length }}</span></div>
          <div class="result-card"><span class="label">最大深度</span><span class="value">{{ maxDepth + 1 }} 层</span></div>
          <div class="result-card"><span class="label">Content 数</span><span class="value">{{ contentCount }}</span></div>
          <div class="result-card"><span class="label">问题</span><span class="value" :class="{ err: errCount > 0 }">{{ errCount }} 错 / {{ warnCount }} 警 / {{ infoCount }} 讯</span></div>
        </div>
        <section class="panel" style="margin-bottom:1rem">
          <div class="panel-head"><span class="t">校验报告</span><span class="msg" style="margin-left:auto">共 {{ result.issues.length }} 项</span></div>
          <div class="panel-body">
            <div v-if="result.issues.length === 0" class="msg ok">未发现问题</div>
            <div v-for="(issue, i) in result.issues" :key="i" class="action-row" style="margin-bottom:0.25rem">
              <span class="tag" :style="issueTagStyle(issue.level)">{{ issue.level.toUpperCase() }}</span>
              <span class="form-hint" style="margin:0">#{{ issue.path === '0' ? 'root' : issue.path }}</span>
              <span class="msg" :class="{ err: issue.level === 'err', warn: issue.level === 'warn' }" style="margin:0">{{ issue.msg }}</span>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head">
            <span class="t">Tile 树</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="expandAll">展开全部</button>
            <button class="btn btn-secondary btn-small" @click="collapseAll">折叠全部</button>
          </div>
          <div class="panel-body">
            <div v-for="node in result.nodes" :key="node.path" :style="{ marginLeft: node.depth * 18 + 'px', display: nodeVisible(node.path) ? '' : 'none' }" class="action-row" style="margin-bottom:0.125rem;white-space:nowrap">
              <button v-if="node.childCount > 0" class="btn btn-secondary btn-small" style="padding:0 4px;font-size:10px" @click="toggle(node.path)">{{ openMap[node.path] !== false ? '▾' : '▸' }}</button>
              <span v-else style="width:16px;display:inline-block"></span>
              <span class="tag">{{ node.bv?.type || '?' }}</span>
              <span class="form-hint" style="margin:0;color:#667eea" v-if="node.ge != null">GE {{ node.ge }}</span>
              <span class="form-hint" style="margin:0" :title="node.bv?.text">{{ node.bv?.text }}</span>
              <span class="tag" v-if="node.uri" style="max-width:200px;overflow:hidden;text-overflow:ellipsis">{{ node.uri }}</span>
            </div>
          </div>
        </section>
      </template>
      <div class="tool-footer">3D Tiles 1.0 · 纯本地运行</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseTileset, SAMPLE_TILESET, type ParseResult } from '../utils/three-d-tiles'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref(SAMPLE_TILESET)
const result = ref<ParseResult | null>(null)
const openMap = reactive<Record<string, boolean>>({})

const maxDepth = computed(() => result.value ? Math.max(...result.value.nodes.map(n => n.depth)) : 0)
const contentCount = computed(() => result.value ? result.value.nodes.filter(n => n.hasContent).length : 0)
const errCount = computed(() => result.value ? result.value.issues.filter(i => i.level === 'err').length : 0)
const warnCount = computed(() => result.value ? result.value.issues.filter(i => i.level === 'warn').length : 0)
const infoCount = computed(() => result.value ? result.value.issues.filter(i => i.level === 'info').length : 0)

function issueTagStyle(level: string) {
  if (level === 'err') return { background: 'rgba(239,68,68,0.15)', color: '#ef4444' }
  if (level === 'warn') return { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }
  return { background: 'rgba(124,92,255,0.15)', color: '#7c5cff' }
}

function doParse() {
  try {
    result.value = parseTileset(input.value)
    result.value.nodes.forEach(n => {
      openMap[n.path] = n.depth < 2
    })
  } catch (e) {
    alert('JSON 解析失败：' + (e as Error).message)
  }
}

function loadSample() {
  input.value = SAMPLE_TILESET
  doParse()
}

function clearAll() {
  input.value = ''
  result.value = null
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const r = new FileReader()
  r.onload = () => { input.value = r.result as string; doParse() }
  r.readAsText(f, 'utf-8');
  (e.target as HTMLInputElement).value = ''
}

function toggle(path: string) {
  openMap[path] = openMap[path] === false
}

function nodeVisible(path: string): boolean {
  const segs = path.split('.')
  for (let i = 1; i < segs.length; i++) {
    const anc = segs.slice(0, i).join('.')
    if (openMap[anc] === false) return false
  }
  return true
}

function expandAll() {
  if (!result.value) return
  result.value.nodes.forEach(n => { openMap[n.path] = true })
}
function collapseAll() {
  if (!result.value) return
  result.value.nodes.forEach(n => { openMap[n.path] = false })
}

doParse()
</script>
