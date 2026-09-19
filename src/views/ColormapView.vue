<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">色带生成器</h1>
      <span class="page-subtitle">13 种预设色带 · 锚点插值 2-256 级 · HEX/RGBA/Cesium 代码</span>
    </div>
    <div class="tool-main">
      <!-- 参数控制 -->
      <div class="panel" style="margin-bottom:1rem">
        <div class="panel-head"><span class="t">参数控制</span></div>
        <div class="panel-body">
          <div class="form-group">
            <label class="form-label">色带</label>
            <select class="form-select" v-model="palette">
              <optgroup v-for="g in paletteGroups" :key="g.label" :label="g.label">
                <option v-for="p in g.items" :key="p" :value="p">{{ PALETTE_NAMES[p] }}</option>
              </optgroup>
            </select>
          </div>
          <div class="action-row" style="gap:1rem;margin-bottom:0.875rem">
            <label class="chk-box"><input type="checkbox" v-model="reversed" /> 反转方向</label>
            <label class="chk-box"><input type="checkbox" v-model="withAlpha" /> 带 Alpha 通道</label>
          </div>
          <div class="form-group">
            <label class="form-label">采样数 {{ n }}</label>
            <div class="action-row">
              <input type="range" v-model.number="n" min="2" max="256" step="1" class="range-input" />
              <input class="form-input" type="number" v-model.number="n" min="2" max="256" step="1" style="width:68px" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">输出格式</label>
            <div class="tabs" style="padding-bottom:0">
              <button class="tab" :class="{ active: fmt === 'hex' }" @click="fmt = 'hex'">HEX 数组</button>
              <button class="tab" :class="{ active: fmt === 'rgba' }" @click="fmt = 'rgba'">RGBA 数组</button>
              <button class="tab" :class="{ active: fmt === 'cesium' }" @click="fmt = 'cesium'">Cesium 代码</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 色带预览 -->
      <div class="panel" style="margin-bottom:1rem">
        <div class="panel-head"><span class="t">色带预览</span></div>
        <div class="panel-body">
          <div class="grad-bar" :style="{ background: `linear-gradient(90deg,${hexColors.join(',')})` }"></div>
          <div class="grad-scale"><span>0</span><span>{{ n }} 段 · {{ palette }}{{ reversed ? '（反转）' : '' }}</span></div>
          <div class="anchors-row">
            <span class="anchor-label">锚点色</span>
            <span v-for="h in anchorHexes" :key="h" class="anchor-chip" :title="h">
              <i :style="{ background: h }"></i>{{ h }}
            </span>
          </div>
          <div class="swatches">
            <div v-for="(h, i) in hexColors" :key="i" class="swatch" :title="'点击复制 ' + h" @click="copyHex(h)">
              <i :style="{ background: h }"></i><span>{{ h }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输出结果 -->
      <div class="panel">
        <div class="panel-head">
          <span class="t">输出结果</span>
          <span class="spacer"></span>
          <span class="form-hint">{{ n }} 个颜色 · {{ outBytes }} 字节 · {{ fmt.toUpperCase() }}</span>
          <button class="btn btn-secondary btn-small" @click="copyOut">{{ copyLabel }}</button>
          <button class="btn btn-primary btn-small" @click="downloadJson">下载 .json</button>
        </div>
        <div class="panel-body">
          <textarea class="form-textarea" :value="outputText" readonly spellcheck="false"></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { PRESETS, PALETTE_NAMES, sampleColors, rgbToHex, fmtHexArr, fmtRgbaArr, fmtCesium } from '../utils/colormap'
import type { OutFmt } from '../utils/colormap'

const router = useRouter()
const goBack = () => router.push('/')

const paletteGroups = [
  { label: '科学色带', items: ['viridis', 'inferno', 'magma'] },
  { label: '顺序色带', items: ['blues', 'greens', 'reds', 'ylorrd'] },
  { label: '分歧色带', items: ['rdylgn', 'rdbu'] },
  { label: '地形 / 海洋 / 其他', items: ['terrain', 'ocean', 'gray', 'rainbow'] },
]

const palette = ref('viridis')
const reversed = ref(false)
const withAlpha = ref(true)
const n = ref(16)
const fmt = ref<OutFmt>('hex')
const copyLabel = ref('复制')

const colors = computed(() => sampleColors(PRESETS[palette.value]!, n.value, reversed.value))
const hexColors = computed(() => colors.value.map(rgbToHex))
const anchorHexes = computed(() => {
  let pts = PRESETS[palette.value]!.slice()
  if (reversed.value) pts = pts.slice().reverse()
  return pts
})

const outputText = computed(() => {
  if (fmt.value === 'hex') return fmtHexArr(colors.value)
  if (fmt.value === 'rgba') return fmtRgbaArr(colors.value, withAlpha.value)
  return fmtCesium(colors.value, { name: palette.value, count: n.value, reversed: reversed.value })
})

const outBytes = computed(() => new Blob([outputText.value]).size)

function copyHex(h: string) {
  navigator.clipboard?.writeText(h)
}

async function copyOut() {
  try { await navigator.clipboard.writeText(outputText.value) } catch {
    const ta = document.createElement('textarea')
    ta.value = outputText.value; document.body.appendChild(ta); ta.select()
    document.execCommand('copy'); ta.remove()
  }
  copyLabel.value = '已复制 ✓'
  setTimeout(() => { copyLabel.value = '复制' }, 1200)
}

function downloadJson() {
  const data = {
    name: palette.value, count: n.value, reversed: reversed.value,
    anchors: PRESETS[palette.value],
    hex: hexColors.value,
    rgba: colors.value.map((c) => [c[0], c[1], c[2], 255]),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `colormap_${palette.value}${reversed.value ? '_rev' : ''}_${n.value}.json`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
</script>

<style scoped>
.chk-box {
  display: inline-flex; align-items: center; gap: 0.3125rem; cursor: pointer; user-select: none;
  color: #a0a0a0; font-size: 0.8125rem; background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.3125rem 0.625rem;
}
.chk-box input { accent-color: #667eea; cursor: pointer; }
.range-input { flex: 1; accent-color: #667eea; }
.grad-bar { height: 42px; border-radius: 9px; border: 1px solid rgba(255,255,255,0.1); }
.grad-scale { display: flex; justify-content: space-between; color: #606060; font-size: 0.75rem; margin: 3px 2px 0; }
.anchors-row { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.625rem; flex-wrap: wrap; }
.anchor-label { color: #606060; font-size: 0.75rem; }
.anchor-chip {
  display: inline-flex; align-items: center; gap: 0.3125rem;
  border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 2px 7px;
  font-size: 0.6875rem; color: #a0a0a0; font-family: Consolas, monospace;
}
.anchor-chip i { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
.swatches { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 0.75rem; max-height: 280px; overflow-y: auto; }
.swatch {
  flex: 1 1 auto; min-width: 56px; max-width: 110px; text-align: center;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden;
  background: rgba(255,255,255,0.03); cursor: pointer; transition: all 0.15s ease;
}
.swatch:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(102,126,234,0.18); border-color: rgba(102,126,234,0.3); }
.swatch i { display: block; height: 24px; }
.swatch span {
  display: block; font-size: 0.625rem; color: #a0a0a0; padding: 2px 0 3px;
  font-family: Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
</style>
