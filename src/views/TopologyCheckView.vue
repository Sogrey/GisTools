<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">拓扑检查</h1>
      <span class="page-subtitle">自相交 · 缝隙 · 重叠 · 环方向</span>
    </div>
    <div class="tool-main">
      <div class="tool-grid">
        <!-- 输入面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">输入 GeoJSON</span>
            <div class="spacer"></div>
            <button class="btn btn-secondary btn-small" @click="loadSample">载入示例</button>
            <button class="btn btn-secondary btn-small" @click="clear">清空</button>
          </div>
          <div class="panel-body">
            <div class="action-row">
              <label class="form-label" style="margin:0;">容差 (°)</label>
              <input class="form-input" type="number" v-model.number="tol" min="0" step="0.00001" style="width:110px;" />
              <button class="btn btn-primary" @click="run">检查</button>
            </div>
            <textarea class="form-textarea" v-model="input" placeholder="粘贴 GeoJSON FeatureCollection（Polygon / MultiPolygon）..."></textarea>
            <span class="msg" :class="inMsgClass">{{ inMsg }}</span>
            <span class="form-hint">自相交：外环每对不相邻边检查线段交叉。缝隙：相邻多边形边界间距在容差内但存在间隙。重叠：bbox 交叉 + 采样点检测。环方向：外环 CCW、内环 CW（RFC 7946）。</span>
          </div>
        </div>
        <!-- 输出面板 -->
        <div class="panel">
          <div class="panel-head">
            <span class="t">检查结果</span>
            <div class="spacer"></div>
            <span class="msg" :class="outMsgClass">{{ outMsg }}</span>
          </div>
          <div class="panel-body">
            <div class="result-grid">
              <div class="result-card"><span class="label">要素总数</span><span class="value">{{ counts.total }}</span></div>
              <div class="result-card"><span class="label">问题数</span><span class="value">{{ issues.length }}</span></div>
              <div class="result-card"><span class="label">自相交</span><span class="value">{{ counts.self }}</span></div>
              <div class="result-card"><span class="label">缝隙</span><span class="value">{{ counts.gap }}</span></div>
              <div class="result-card"><span class="label">重叠</span><span class="value">{{ counts.overlap }}</span></div>
              <div class="result-card"><span class="label">环方向</span><span class="value">{{ counts.orient }}</span></div>
            </div>
            <div v-if="issues.length === 0" class="msg" style="text-align:center;padding:2rem 0;color:#606060;">
              {{ outMsg ? '✓ 未发现拓扑问题' : '输入 GeoJSON 后点击「检查」查看结果' }}
            </div>
            <table v-else class="data-table">
              <thead>
                <tr><th>#</th><th>类型</th><th>要素</th><th>描述</th><th>坐标位置</th></tr>
              </thead>
              <tbody>
                <tr v-for="(iss, i) in issues" :key="i">
                  <td>{{ i + 1 }}</td>
                  <td><span class="tag" :class="tagClass(iss.type)">{{ iss.tag }}</span></td>
                  <td>#{{ iss.feat }}</td>
                  <td>{{ iss.desc }}</td>
                  <td style="font-family:Consolas,monospace;font-size:0.75rem;white-space:nowrap;">{{ iss.coord ? fmtCoord(iss.coord) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { runCheck, fmtCoord } from '../utils/topology-check'
import type { TopoIssue, IssueType } from '../utils/topology-check'

const router = useRouter()
const goBack = () => router.push('/')

const input = ref('')
const tol = ref(0.0001)

const inMsg = ref('')
const inMsgClass = ref('')
const outMsg = ref('')
const outMsgClass = ref('')
const issues = ref<TopoIssue[]>([])
const counts = ref({ total: '—', self: '—', gap: '—', overlap: '—', orient: '—' })

function tagClass(type: IssueType): string {
  const map: Record<IssueType, string> = {
    self: 'tag-self',
    gap: 'tag-gap',
    overlap: 'tag-overlap',
    orient: 'tag-orient',
  }
  return map[type]
}

function run() {
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  const raw = input.value.trim()
  if (!raw) {
    inMsg.value = '请输入 GeoJSON'
    inMsgClass.value = 'err'
    return
  }
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(raw)
  } catch (e) {
    inMsg.value = 'JSON 解析失败: ' + (e as Error).message
    inMsgClass.value = 'err'
    return
  }
  if (!(tol.value >= 0)) {
    inMsg.value = '容差需 >= 0'
    inMsgClass.value = 'err'
    return
  }
  try {
    const res = runCheck(obj, tol.value)
    issues.value = res.issues
    const c = res.counts
    counts.value = {
      total: String(res.total),
      self: String(c.self),
      gap: String(c.gap),
      overlap: String(c.overlap),
      orient: String(c.orient),
    }
    if (res.issues.length === 0) {
      outMsg.value = '检查通过'
      outMsgClass.value = 'ok'
    } else {
      outMsg.value = '发现 ' + res.issues.length + ' 个问题'
      outMsgClass.value = 'err'
    }
    inMsg.value = '已检查 ' + res.total + ' 个多边形要素'
    inMsgClass.value = 'ok'
  } catch (e) {
    inMsg.value = '检查失败: ' + (e as Error).message
    inMsgClass.value = 'err'
  }
}

function loadSample() {
  const sample = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: '自相交蝴蝶形' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[116.38, 39.9], [116.42, 39.94], [116.38, 39.94], [116.42, 39.9], [116.38, 39.9]]],
        },
      },
      {
        type: 'Feature',
        properties: { name: '正常矩形' },
        geometry: {
          type: 'Polygon',
          coordinates: [[[116.44, 39.9], [116.48, 39.9], [116.48, 39.94], [116.44, 39.94], [116.44, 39.9]]],
        },
      },
    ],
  }
  input.value = JSON.stringify(sample, null, 2)
  run()
}

function clear() {
  input.value = ''
  inMsg.value = ''
  inMsgClass.value = ''
  outMsg.value = ''
  outMsgClass.value = ''
  issues.value = []
  counts.value = { total: '—', self: '—', gap: '—', overlap: '—', orient: '—' }
}
</script>

<style scoped>
.tag-self {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}
.tag-gap {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.3);
}
.tag-overlap {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}
.tag-orient {
  background: rgba(102, 126, 234, 0.15);
  color: #667eea;
  border-color: rgba(102, 126, 234, 0.3);
}
</style>
