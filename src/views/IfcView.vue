<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">IFC 元信息解析器</h1>
      <span class="page-subtitle">STEP 物理文件解析 · IFC 版本 / 文件头 / 实体统计 / 属性集</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">IFC 数据输入</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="btn btn-secondary btn-small" style="cursor:pointer">选择 .ifc 文件
                <input type="file" accept=".ifc,.txt" style="display:none" @change="onFile" />
              </label>
              <span class="form-hint" style="margin:0">{{ fileName }}</span>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 IFC（STEP / ISO-10303-21）文本"></textarea>
            <div class="action-row" style="margin-top:0.5rem">
              <button class="btn btn-primary btn-small" @click="doParse">解析</button>
              <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
              <button class="btn btn-secondary btn-small" @click="clearAll">清空</button>
            </div>
            <div class="msg" :class="{ ok: msgType === 'ok', err: msgType === 'err', warn: msgType === 'warn' }" v-if="msg">{{ msg }}</div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="t">解析结果</span></div>
          <div class="panel-body" v-if="result">
            <div class="result-grid" style="margin-bottom:1rem">
              <div class="result-card"><span class="label">IFC 版本</span><span class="value" style="font-size:0.8125rem">{{ result.versionName }}</span></div>
              <div class="result-card"><span class="label">IFC 实体总数</span><span class="value">{{ result.totalIfc }}</span></div>
              <div class="result-card"><span class="label">实体类型</span><span class="value">{{ Object.keys(result.counts).length }}</span></div>
              <div class="result-card"><span class="label">属性集/值</span><span class="value">{{ result.stats.propertySets }}/{{ result.stats.propertyValues }}</span></div>
            </div>
            <div class="form-group">
              <label class="form-label">文件头信息（HEADER）</label>
              <table class="data-table">
                <tbody>
                  <tr><td>IFC 版本</td><td>{{ result.versionName }}</td></tr>
                  <tr><td>模式</td><td>{{ result.header.schema || '未找到' }}</td></tr>
                  <tr><td>STEP 签名</td><td>{{ result.header.isStep ? '有效' : '缺失' }}</td></tr>
                  <tr><td>文件名</td><td>{{ result.header.name || '-' }}</td></tr>
                  <tr><td>时间戳</td><td>{{ result.header.timeStamp || '-' }}</td></tr>
                  <tr><td>作者</td><td>{{ result.header.authors.join('、') || '-' }}</td></tr>
                  <tr><td>机构</td><td>{{ result.header.organizations.join('、') || '-' }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="form-group">
              <label class="form-label">重点构件统计</label>
              <div class="result-grid">
                <div class="result-card"><span class="label">墙</span><span class="value">{{ result.stats.walls }}</span></div>
                <div class="result-card"><span class="label">楼板</span><span class="value">{{ result.stats.slabs }}</span></div>
                <div class="result-card"><span class="label">柱</span><span class="value">{{ result.stats.columns }}</span></div>
                <div class="result-card"><span class="label">梁</span><span class="value">{{ result.stats.beams }}</span></div>
                <div class="result-card"><span class="label">门</span><span class="value">{{ result.stats.doors }}</span></div>
                <div class="result-card"><span class="label">窗</span><span class="value">{{ result.stats.windows }}</span></div>
                <div class="result-card"><span class="label">楼层</span><span class="value">{{ result.stats.storeys }}</span></div>
                <div class="result-card"><span class="label">材料</span><span class="value">{{ result.stats.materials }}</span></div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">实体类型统计</label>
              <input class="form-input" v-model="filter" placeholder="筛选实体类型，如 WALL / DOOR" style="margin-bottom:0.5rem" />
              <table class="data-table">
                <thead><tr><th>实体类型</th><th>分类</th><th>数量</th><th>占比</th></tr></thead>
                <tbody>
                  <tr v-for="[type, count] in filteredCounts" :key="type">
                    <td>{{ type }}</td><td>{{ entityCategory(type) }}</td><td>{{ count }}</td><td>{{ (count / result.totalIfc * 100).toFixed(2) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="panel-body" v-else>
            <div class="form-hint" style="text-align:center;padding:3rem 0">粘贴或上传 IFC 文件后点击「解析」</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">IFC 元信息解析器 · 纯本地解析 · 数据不离开浏览器</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseIfc, entityCategory, SAMPLE_IFC, type IfcParseResult } from '../utils/ifc-parser'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const fileName = ref('未选择文件')
const result = ref<IfcParseResult | null>(null)
const msg = ref('')
const msgType = ref('')
const filter = ref('')

const filteredCounts = computed(() => {
  if (!result.value) return [] as [string, number][]
  const arr = Object.entries(result.value.counts).sort((a, b) => b[1] - a[1])
  if (!filter.value) return arr.slice(0, 100)
  const f = filter.value.toLowerCase()
  return arr.filter(([type]) => type.toLowerCase().includes(f)).slice(0, 100)
})

function doParse() {
  if (!input.value.trim()) { msg.value = '请先粘贴 IFC 文本'; msgType.value = 'err'; return }
  const r = parseIfc(input.value)
  result.value = r
  if (r.errors.length) { msg.value = '解析完成（有问题）：' + r.errors.join('；'); msgType.value = 'err' }
  else if (r.warnings.length) { msg.value = '解析完成（有提醒）：' + r.warnings.join('；'); msgType.value = 'warn' }
  else { msg.value = `解析成功：${r.versionName}，共 ${r.totalIfc} 个 IFC 实体`; msgType.value = 'ok' }
}

function loadSample() {
  input.value = SAMPLE_IFC
  fileName.value = '示例：demo-house.ifc'
  doParse()
}

function clearAll() {
  input.value = ''; fileName.value = '未选择文件'; result.value = null; msg.value = ''
}

function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  fileName.value = `${f.name}（${(f.size / 1024 / 1024).toFixed(2)} MB）`
  const r = new FileReader()
  r.onload = () => { input.value = r.result as string; doParse() }
  r.readAsText(f, 'utf-8');
  (e.target as HTMLInputElement).value = ''
}
</script>
