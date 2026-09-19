<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">EPSG 坐标系速查</h1>
      <span class="page-subtitle">56 条常用 EPSG · WKT 定义 · 参数详情</span>
    </div>
    <div class="tool-main">
      <!-- 搜索过滤 -->
      <div class="panel" style="margin-bottom: 1rem">
        <div class="panel-head">
          <span class="t">搜索与过滤</span>
          <div class="spacer"></div>
          <span class="form-hint">共 <b style="color: #fff">{{ EPSG_DATA.length }}</b> 条记录</span>
        </div>
        <div class="panel-body">
          <div class="action-row">
            <input class="form-input" style="flex: 1; min-width: 200px;" v-model="search" placeholder="按 EPSG 代码、名称、区域搜索…  例: 4326 / WGS / CGCS / UTM 50 / 法国" />
            <select class="form-select" v-model="typeFilter" style="width: 160px;">
              <option value="">全部类型</option>
              <option value="Geographic 2D">Geographic 2D</option>
              <option value="Projected">Projected</option>
              <option value="Geocentric">Geocentric</option>
              <option value="Geographic 3D">Geographic 3D</option>
            </select>
            <button class="btn btn-secondary btn-small" @click="clearFilter">清除</button>
          </div>
          <div class="msg" style="margin-top: 0.5rem;">
            筛选结果 <b style="color: #fff">{{ filtered.length }}</b> · 点击行展开 WKT 参数详情 · 点击「复制」获取完整 WKT
          </div>
        </div>
      </div>

      <!-- 对照表 -->
      <div class="panel">
        <div class="panel-head">
          <span class="t">坐标系对照表</span>
        </div>
        <div class="panel-body" style="overflow: auto; max-height: 560px; padding: 0;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 70px">EPSG</th>
                <th style="width: 200px">名称</th>
                <th style="width: 70px">类型</th>
                <th style="width: 130px">椭球</th>
                <th style="width: 120px">适用区域</th>
                <th>WKT 片段</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="d in filtered" :key="d.code">
                <tr class="data-row" :class="{ expanded: expandedCode === d.code }" @click="toggleRow(d.code)">
                  <td class="code-cell">{{ d.code }}</td>
                  <td class="name-cell">{{ d.name }}</td>
                  <td><span class="tag" :class="tagClass(d.type)">{{ tagShort(d.type) }}</span></td>
                  <td style="font-size: 0.75rem; color: #a0a0a0">{{ d.ellipsoid }}<br><span style="color: #606060; font-family: Consolas, monospace;">{{ d.semiMajor }} / {{ d.invFlat }}</span></td>
                  <td>{{ d.area }}</td>
                  <td style="font-family: Consolas, monospace; font-size: 0.6875rem; color: #606060; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ wktPreview(d.wkt) }}</td>
                </tr>
                <tr v-if="expandedCode === d.code" class="detail-row">
                  <td colspan="6" style="padding: 0; background: rgba(255,255,255,0.02);">
                    <div style="padding: 0.75rem 1rem;">
                      <div style="font-size: 0.75rem; color: #a0a0a0; margin-bottom: 0.5rem; font-weight: 600;">投影参数详情</div>
                      <div class="result-grid" style="margin-bottom: 0.75rem;">
                        <div class="result-card" v-for="p in d.projParams" :key="p.k">
                          <span class="label">{{ p.k }}</span>
                          <span class="value" style="font-size: 0.8125rem;">{{ p.v }}</span>
                        </div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <span style="font-size: 0.75rem; color: #a0a0a0; font-weight: 600;">WKT 完整定义</span>
                        <button class="btn btn-secondary btn-small" @click.stop="copyWkt(d.wkt)">复制 WKT</button>
                        <span class="msg ok" v-if="copiedCode === d.code">已复制</span>
                      </div>
                      <pre class="wkt-box">{{ d.wkt }}</pre>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="filtered.length === 0">
                <td colspan="6" style="text-align: center; padding: 1.25rem; color: #606060;">未找到匹配的 EPSG 坐标系，请尝试其他关键词</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="tool-footer">
        数据来源 EPSG Geodetic Parameter Registry · 全部内嵌离线 · WKT 基于 EPSG 定义简化呈现
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { EPSG_DATA, tagShort, tagClass, wktPreview } from '../utils/epsg-lookup'
import type { EpsgEntry } from '../utils/epsg-lookup'

const router = useRouter()
const goBack = () => router.push('/')

const search = ref('')
const typeFilter = ref('')
const expandedCode = ref<number | null>(null)
const copiedCode = ref<number | null>(null)

const filtered = computed<EpsgEntry[]>(() => {
  const kw = search.value.trim().toLowerCase()
  const tf = typeFilter.value
  return EPSG_DATA.filter((d) => {
    if (tf && d.type !== tf) return false
    if (kw) {
      const hay = (d.code + ' ' + d.name + ' ' + d.area + ' ' + d.datum + ' ' + d.ellipsoid).toLowerCase()
      if (hay.indexOf(kw) < 0) return false
    }
    return true
  })
})

function toggleRow(code: number) {
  expandedCode.value = expandedCode.value === code ? null : code
}

function copyWkt(text: string) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      const code = expandedCode.value
      if (code) {
        copiedCode.value = code
        setTimeout(() => { copiedCode.value = null }, 1500)
      }
    }).catch(() => fallbackCopy(text))
  } else {
    fallbackCopy(text)
  }
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try { document.execCommand('copy') } catch (e) { /* ignore */ }
  document.body.removeChild(ta)
}

function clearFilter() {
  search.value = ''
  typeFilter.value = ''
}
</script>

<style scoped>
.code-cell {
  font-family: Consolas, monospace;
  font-weight: 700;
  color: #667eea;
}
.name-cell {
  font-weight: 600;
  color: #fff;
}
.data-row {
  cursor: pointer;
  transition: background 0.1s;
}
.data-row:hover td {
  background: rgba(255, 255, 255, 0.03);
}
.data-row.expanded td {
  background: rgba(102, 126, 234, 0.08);
}
.tag-geo { background: rgba(22, 163, 74, 0.15); color: #4ade80; }
.tag-proj { background: rgba(102, 126, 234, 0.15); color: #667eea; }
.tag-geoc { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.detail-row td {
  background: rgba(255, 255, 255, 0.02);
}
.wkt-box {
  background: #1a1a2e;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 0.625rem 0.75rem;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 0.6875rem;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
  margin: 0;
}
</style>
