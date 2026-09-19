<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">CityGML 解析器</h1>
      <span class="page-subtitle">城市模型 XML 解析 · 版本 / 建筑 / LOD / gml:id</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <section class="panel">
          <div class="panel-head"><span class="t">CityGML 数据输入</span></div>
          <div class="panel-body">
            <div class="action-row" style="margin-bottom:0.5rem">
              <label class="btn btn-secondary btn-small" style="cursor:pointer">选择 .gml/.xml
                <input type="file" accept=".gml,.xml,.citygml" style="display:none" @change="onFile" />
              </label>
              <span class="form-hint" style="margin:0">{{ fileName }}</span>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 CityGML XML 文本"></textarea>
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
          <div class="panel-body" v-if="result && result.ok">
            <div class="result-grid" style="margin-bottom:1rem">
              <div class="result-card"><span class="label">CityGML 版本</span><span class="value">{{ result.version }}</span></div>
              <div class="result-card"><span class="label">Building 数</span><span class="value">{{ result.buildings + result.buildingParts }}</span><span class="sub">含 Part {{ result.buildingParts }}</span></div>
              <div class="result-card"><span class="label">boundedBy</span><span class="value">{{ result.boundedBy }}</span></div>
              <div class="result-card"><span class="label">gml:id 总数</span><span class="value">{{ result.allIdCount }}</span></div>
            </div>
            <div v-if="result.envelope" class="form-group">
              <label class="form-label">空间范围（Envelope）</label>
              <table class="data-table">
                <tbody>
                  <tr><td>坐标系</td><td>{{ result.envelope.srsName || '未声明' }}</td></tr>
                  <tr><td>lowerCorner</td><td>{{ result.envelope.lowerCorner.join(', ') }}</td></tr>
                  <tr><td>upperCorner</td><td>{{ result.envelope.upperCorner.join(', ') }}</td></tr>
                </tbody>
              </table>
            </div>
            <div class="form-group">
              <label class="form-label">LOD 等级分布</label>
              <div v-for="i in 5" :key="i" class="action-row" style="margin-bottom:0.25rem">
                <span class="form-hint" style="margin:0;min-width:50px">LOD{{ i - 1 }}</span>
                <div style="flex:1;height:16px;background:rgba(255,255,255,0.05);border-radius:5px;overflow:hidden">
                  <div :style="{ width: lodWidth(i - 1) + '%', height: '100%', background: 'linear-gradient(90deg,#667eea,#764ba2)' }"></div>
                </div>
                <span class="form-hint" style="margin:0;min-width:40px;text-align:right">{{ result.lods[i - 1] }}</span>
              </div>
            </div>
            <div class="form-group" v-if="Object.keys(result.surfaces).length">
              <label class="form-label">边界面类型</label>
              <table class="data-table">
                <thead><tr><th>表面类型</th><th>数量</th></tr></thead>
                <tbody><tr v-for="(count, type) in sortedSurfaces" :key="type"><td>{{ type }}</td><td>{{ count }}</td></tr></tbody>
              </table>
            </div>
            <div class="form-group" v-if="result.buildingIds.length">
              <label class="form-label">Building gml:id 列表（{{ result.buildingIds.length }} 个）</label>
              <div style="max-height:200px;overflow-y:auto">
                <div v-for="(item, i) in result.buildingIds.slice(0, 100)" :key="i" class="form-hint" style="margin:0;padding:2px 0;border-bottom:1px dashed rgba(255,255,255,0.05)">
                  [{{ i + 1 }}]{{ item.isPart ? ' Part' : '' }} {{ item.id }}
                </div>
              </div>
            </div>
          </div>
          <div class="panel-body" v-else-if="result && !result.ok">
            <div class="msg err">{{ result.errors.join('；') }}</div>
          </div>
          <div class="panel-body" v-else>
            <div class="form-hint" style="text-align:center;padding:3rem 0">粘贴或上传 CityGML 文件后点击「解析」</div>
          </div>
        </section>
      </div>
      <div class="tool-footer">CityGML 解析器 · 纯本地解析 · 适用于 CIM/三维城市底板交付检查</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { parseCityGml, SAMPLE_CITYGML, type CityGmlResult } from '../utils/citygml-parser'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const fileName = ref('未选择文件')
const result = ref<CityGmlResult | null>(null)
const msg = ref('')
const msgType = ref('')

const sortedSurfaces = computed(() => {
  if (!result.value?.surfaces) return {} as Record<string, number>
  return Object.entries(result.value.surfaces).sort((a, b) => b[1] - a[1]).reduce((acc, [k, v]) => { acc[k] = v; return acc }, {} as Record<string, number>)
})

function lodWidth(i: number): number {
  if (!result.value) return 0
  const max = Math.max(1, ...Object.values(result.value.lods))
  return Math.round((result.value.lods[i]! / max) * 100)
}

function doParse() {
  if (!input.value.trim()) { msg.value = '请先粘贴 CityGML XML'; msgType.value = 'err'; return }
  const r = parseCityGml(input.value)
  result.value = r
  if (!r.ok) { msg.value = r.errors.join('；'); msgType.value = 'err' }
  else if (r.errors.length) { msg.value = '解析完成（有提醒）：' + r.errors.join('；'); msgType.value = 'warn' }
  else { msg.value = `解析成功：CityGML ${r.version}，Building ${r.buildings + r.buildingParts} 个`; msgType.value = 'ok' }
}

function loadSample() { input.value = SAMPLE_CITYGML; fileName.value = '示例'; doParse() }
function clearAll() { input.value = ''; fileName.value = '未选择文件'; result.value = null; msg.value = '' }

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
