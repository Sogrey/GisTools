<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">七参数 / 四参数转换</h1>
      <span class="page-subtitle">Bursa-Wolf 七参数 · 2D 四参数 · 最小二乘反算</span>
    </div>
    <div class="tool-main">
      <!-- 模式标签 -->
      <div class="tabs" style="margin-bottom: 0.75rem;">
        <button class="tab" :class="{ active: curMode === 'forward' }" @click="curMode = 'forward'">正向转换</button>
        <button class="tab" :class="{ active: curMode === 'inverse' }" @click="curMode = 'inverse'">参数反算</button>
      </div>
      <div class="tabs" style="margin-bottom: 1rem;">
        <button class="tab" :class="{ active: curSub === 'seven' }" @click="curSub = 'seven'">七参数</button>
        <button class="tab" :class="{ active: curSub === 'four' }" @click="curSub = 'four'">四参数</button>
      </div>

      <!-- 正向七参数 -->
      <div v-if="curMode === 'forward' && curSub === 'seven'" class="panel" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">七参数 Bursa-Wolf 正向转换</span></div>
        <div class="panel-body">
          <div class="result-grid" style="margin-bottom: 0.5rem;">
            <div class="form-group"><label class="form-label">DX (m)</label><input class="form-input" type="number" step="any" v-model.number="f7dx" /></div>
            <div class="form-group"><label class="form-label">DY (m)</label><input class="form-input" type="number" step="any" v-model.number="f7dy" /></div>
            <div class="form-group"><label class="form-label">DZ (m)</label><input class="form-input" type="number" step="any" v-model.number="f7dz" /></div>
            <div class="form-group"><label class="form-label">RX (″)</label><input class="form-input" type="number" step="any" v-model.number="f7rx" /></div>
            <div class="form-group"><label class="form-label">RY (″)</label><input class="form-input" type="number" step="any" v-model.number="f7ry" /></div>
            <div class="form-group"><label class="form-label">RZ (″)</label><input class="form-input" type="number" step="any" v-model.number="f7rz" /></div>
            <div class="form-group"><label class="form-label">SCALE (ppm)</label><input class="form-input" type="number" step="any" v-model.number="f7s" /></div>
          </div>
          <label class="form-label">源坐标 (X, Y, Z) — 每行一组，支持逗号/空格分隔</label>
          <textarea v-model="f7src" class="form-textarea" placeholder="4000000, 500000, 4900000&#10;4100000, 600000, 4800000"></textarea>
          <div class="action-row">
            <button class="btn btn-primary" @click="computeFwd7">计算</button>
            <button class="btn btn-secondary btn-small" @click="loadExampleF7">示例</button>
            <button class="btn btn-secondary btn-small" @click="clearF7">清空</button>
          </div>
          <div v-if="f7Result" style="margin-top: 0.5rem;">
            <table class="data-table">
              <thead><tr><th>#</th><th>源X</th><th>源Y</th><th>源Z</th><th></th><th>目标X</th><th>目标Y</th><th>目标Z</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in f7Result" :key="i"><td>{{ i + 1 }}</td><td v-for="v in r.src" :key="'s'+v">{{ fmt(v) }}</td><td style="color: #606060;">→</td><td v-for="v in r.tgt" :key="'t'+v">{{ fmt(v) }}</td></tr>
              </tbody>
            </table>
            <div class="action-row" style="margin-top: 0.5rem;">
              <button class="btn btn-secondary btn-small" @click="copyF7">复制结果</button>
            </div>
          </div>
          <span class="msg err" v-if="f7Err">{{ f7Err }}</span>
        </div>
      </div>

      <!-- 正向四参数 -->
      <div v-if="curMode === 'forward' && curSub === 'four'" class="panel" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">四参数 2D 相似变换 正向转换</span></div>
        <div class="panel-body">
          <div class="result-grid" style="margin-bottom: 0.5rem;">
            <div class="form-group"><label class="form-label">DX (m)</label><input class="form-input" type="number" step="any" v-model.number="f4dx" /></div>
            <div class="form-group"><label class="form-label">DY (m)</label><input class="form-input" type="number" step="any" v-model.number="f4dy" /></div>
            <div class="form-group"><label class="form-label">ROTATION (°)</label><input class="form-input" type="number" step="any" v-model.number="f4rot" /></div>
            <div class="form-group"><label class="form-label">SCALE (k)</label><input class="form-input" type="number" step="any" v-model.number="f4s" /></div>
          </div>
          <label class="form-label">源坐标 (x, y) — 每行一组，支持逗号/空格分隔</label>
          <textarea v-model="f4src" class="form-textarea" placeholder="1000.5, 2000.3&#10;3000.7, 4000.2"></textarea>
          <div class="action-row">
            <button class="btn btn-primary" @click="computeFwd4">计算</button>
            <button class="btn btn-secondary btn-small" @click="loadExampleF4">示例</button>
            <button class="btn btn-secondary btn-small" @click="clearF4">清空</button>
          </div>
          <div v-if="f4Result" style="margin-top: 0.5rem;">
            <table class="data-table">
              <thead><tr><th>#</th><th>源x</th><th>源y</th><th></th><th>目标x</th><th>目标y</th></tr></thead>
              <tbody>
                <tr v-for="(r, i) in f4Result" :key="i"><td>{{ i + 1 }}</td><td v-for="v in r.src" :key="'s'+v">{{ fmt(v) }}</td><td style="color: #606060;">→</td><td v-for="v in r.tgt" :key="'t'+v">{{ fmt(v) }}</td></tr>
              </tbody>
            </table>
            <div class="action-row" style="margin-top: 0.5rem;">
              <button class="btn btn-secondary btn-small" @click="copyF4">复制结果</button>
            </div>
          </div>
          <span class="msg err" v-if="f4Err">{{ f4Err }}</span>
        </div>
      </div>

      <!-- 反算七参数 -->
      <div v-if="curMode === 'inverse' && curSub === 'seven'" class="panel" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">七参数最小二乘反算</span></div>
        <div class="panel-body">
          <div class="info-box" style="margin-bottom: 0.5rem;">每行一组，格式：源X,源Y,源Z,目标X,目标Y,目标Z 或用 → 分隔。以 # 开头为注释。至少需要 3 组公共点。</div>
          <textarea v-model="i7pts" class="form-textarea" placeholder="# 示例（非共线点）：&#10;4000000, 500000, 4900000, 4000100, 500200, 4900150&#10;4100000, 300000, 4800000, 4100100, 300200, 4800150&#10;3900000, 700000, 4700000, 3900100, 700200, 4700150"></textarea>
          <div class="action-row">
            <button class="btn btn-primary" @click="computeInv7">计算参数</button>
            <button class="btn btn-secondary btn-small" @click="loadExampleI7">示例</button>
            <button class="btn btn-secondary btn-small" @click="clearI7">清空</button>
          </div>
          <div v-if="i7Result" style="margin-top: 0.5rem;">
            <div class="action-row" style="margin-bottom: 0.5rem;">
              <button class="btn btn-secondary btn-small" @click="applyInv7">应用到正向转换</button>
            </div>
            <div class="result-grid" style="margin-bottom: 0.5rem;">
              <div class="result-card"><span class="label">DX</span><span class="value">{{ fmt(i7Result.params.Dx) }} m</span></div>
              <div class="result-card"><span class="label">DY</span><span class="value">{{ fmt(i7Result.params.Dy) }} m</span></div>
              <div class="result-card"><span class="label">DZ</span><span class="value">{{ fmt(i7Result.params.Dz) }} m</span></div>
              <div class="result-card"><span class="label">RX</span><span class="value">{{ fmt(i7Result.params.Rx) }} ″</span></div>
              <div class="result-card"><span class="label">RY</span><span class="value">{{ fmt(i7Result.params.Ry) }} ″</span></div>
              <div class="result-card"><span class="label">RZ</span><span class="value">{{ fmt(i7Result.params.Rz) }} ″</span></div>
              <div class="result-card"><span class="label">SCALE</span><span class="value">{{ fmt(i7Result.params.ppm) }} ppm</span></div>
            </div>
            <div class="info-box">公共点数: <b style="color:#fff">{{ i7Result.n }}</b> | 自由度: <b style="color:#fff">{{ i7Result.dof }}</b> | 单位权中误差: <b style="color:#fff">{{ fmt(i7Result.sigma0) }} m</b></div>
            <table class="data-table" style="margin-top: 0.5rem;">
              <thead><tr><th>点号</th><th>ΔX (mm)</th><th>ΔY (mm)</th><th>ΔZ (mm)</th></tr></thead>
              <tbody>
                <tr v-for="r in i7Result.residuals" :key="r.idx"><td>{{ r.idx }}</td><td>{{ fmt(r.vx, 3) }}</td><td>{{ fmt(r.vy, 3) }}</td><td>{{ fmt(r.vz, 3) }}</td></tr>
              </tbody>
            </table>
          </div>
          <span class="msg err" v-if="i7Err">{{ i7Err }}</span>
        </div>
      </div>

      <!-- 反算四参数 -->
      <div v-if="curMode === 'inverse' && curSub === 'four'" class="panel" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">四参数最小二乘反算</span></div>
        <div class="panel-body">
          <div class="info-box" style="margin-bottom: 0.5rem;">每行一组，格式：源x,源y,目标x,目标y 或用 → 分隔。以 # 开头为注释。至少需要 2 组公共点。</div>
          <textarea v-model="i4pts" class="form-textarea" placeholder="# 示例&#10;1000, 2000, 1500, 2800&#10;3000, 1500, 3500, 2300&#10;5000, 6000, 5500, 6800"></textarea>
          <div class="action-row">
            <button class="btn btn-primary" @click="computeInv4">计算参数</button>
            <button class="btn btn-secondary btn-small" @click="loadExampleI4">示例</button>
            <button class="btn btn-secondary btn-small" @click="clearI4">清空</button>
          </div>
          <div v-if="i4Result" style="margin-top: 0.5rem;">
            <div class="action-row" style="margin-bottom: 0.5rem;">
              <button class="btn btn-secondary btn-small" @click="applyInv4">应用到正向转换</button>
            </div>
            <div class="result-grid" style="margin-bottom: 0.5rem;">
              <div class="result-card"><span class="label">DX</span><span class="value">{{ fmt(i4Result.params.Dx) }} m</span></div>
              <div class="result-card"><span class="label">DY</span><span class="value">{{ fmt(i4Result.params.Dy) }} m</span></div>
              <div class="result-card"><span class="label">ROTATION</span><span class="value">{{ fmt(i4Result.params.rotation) }} °</span></div>
              <div class="result-card"><span class="label">SCALE (k)</span><span class="value">{{ fmt(i4Result.params.k) }}</span></div>
            </div>
            <div class="info-box">公共点数: <b style="color:#fff">{{ i4Result.n }}</b> | 自由度: <b style="color:#fff">{{ i4Result.dof }}</b> | 单位权中误差: <b style="color:#fff">{{ fmt(i4Result.sigma0) }} m</b></div>
            <table class="data-table" style="margin-top: 0.5rem;">
              <thead><tr><th>点号</th><th>Δx (mm)</th><th>Δy (mm)</th></tr></thead>
              <tbody>
                <tr v-for="r in i4Result.residuals" :key="r.idx"><td>{{ r.idx }}</td><td>{{ fmt(r.vx, 3) }}</td><td>{{ fmt(r.vy, 3) }}</td></tr>
              </tbody>
            </table>
          </div>
          <span class="msg err" v-if="i4Err">{{ i4Err }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { fwd7, fwd4, inv7, inv4, parsePts, parseCommon, fmt } from '../utils/seven-param'
import type { Inv7Result, Inv4Result } from '../utils/seven-param'

const router = useRouter()
const goBack = () => router.push('/')

const curMode = ref<'forward' | 'inverse'>('forward')
const curSub = ref<'seven' | 'four'>('seven')

// Forward 7
const f7dx = ref(0), f7dy = ref(0), f7dz = ref(0)
const f7rx = ref(0), f7ry = ref(0), f7rz = ref(0), f7s = ref(0)
const f7src = ref('')
const f7Result = ref<{ src: number[]; tgt: number[] }[] | null>(null)
const f7Err = ref('')

// Forward 4
const f4dx = ref(0), f4dy = ref(0), f4rot = ref(0), f4s = ref(1)
const f4src = ref('')
const f4Result = ref<{ src: number[]; tgt: number[] }[] | null>(null)
const f4Err = ref('')

// Inverse 7
const i7pts = ref('')
const i7Result = ref<Inv7Result | null>(null)
const i7Err = ref('')

// Inverse 4
const i4pts = ref('')
const i4Result = ref<Inv4Result | null>(null)
const i4Err = ref('')

function computeFwd7() {
  f7Err.value = ''
  const pts = parsePts(f7src.value, 3)
  if (pts.length === 0) { f7Err.value = '请输入至少一组源坐标'; return }
  try {
    const tgt = fwd7(f7dx.value, f7dy.value, f7dz.value, f7rx.value, f7ry.value, f7rz.value, f7s.value, pts)
    f7Result.value = pts.map((s, i) => ({ src: s, tgt: tgt[i]! }))
  } catch (e) { f7Err.value = (e as Error).message }
}

function computeFwd4() {
  f4Err.value = ''
  const pts = parsePts(f4src.value, 2)
  if (pts.length === 0) { f4Err.value = '请输入至少一组源坐标'; return }
  try {
    const tgt = fwd4(f4dx.value, f4dy.value, f4rot.value, f4s.value, pts)
    f4Result.value = pts.map((s, i) => ({ src: s, tgt: tgt[i]! }))
  } catch (e) { f4Err.value = (e as Error).message }
}

function computeInv7() {
  i7Err.value = ''
  const common = parseCommon(i7pts.value, 3)
  if (common.length === 0) { i7Err.value = '请输入公共点坐标'; return }
  try { i7Result.value = inv7(common) } catch (e) { i7Err.value = (e as Error).message }
}

function computeInv4() {
  i4Err.value = ''
  const common = parseCommon(i4pts.value, 2)
  if (common.length === 0) { i4Err.value = '请输入公共点坐标'; return }
  try { i4Result.value = inv4(common) } catch (e) { i4Err.value = (e as Error).message }
}

function applyInv7() {
  if (!i7Result.value) return
  const p = i7Result.value.params
  curMode.value = 'forward'; curSub.value = 'seven'
  f7dx.value = p.Dx; f7dy.value = p.Dy; f7dz.value = p.Dz
  f7rx.value = p.Rx; f7ry.value = p.Ry; f7rz.value = p.Rz; f7s.value = p.ppm
}

function applyInv4() {
  if (!i4Result.value) return
  const p = i4Result.value.params
  curMode.value = 'forward'; curSub.value = 'four'
  f4dx.value = p.Dx; f4dy.value = p.Dy; f4rot.value = p.rotation; f4s.value = p.k
}

function loadExampleF7() {
  f7dx.value = 10; f7dy.value = 20; f7dz.value = 15; f7rx.value = 0.5; f7ry.value = -0.3; f7rz.value = 0.8; f7s.value = 1.2
  f7src.value = '4000000, 500000, 4900000\n4100000, 600000, 4800000\n4200000, 700000, 4700000'
}
function loadExampleF4() {
  f4dx.value = 500; f4dy.value = 800; f4rot.value = 0.5; f4s.value = 1.00005
  f4src.value = '1000.5, 2000.3\n3000.7, 4000.2\n5000.1, 6000.4'
}
function loadExampleI7() {
  i7pts.value = '# 七参数反算示例（DX=100, DY=200, DZ=150）\n4000000, 500000, 4900000, 4000100, 500200, 4900150\n4100000, 300000, 4800000, 4100100, 300200, 4800150\n3900000, 700000, 4700000, 3900100, 700200, 4700150\n4200000, 600000, 4500000, 4200100, 600200, 4500150'
}
function loadExampleI4() {
  i4pts.value = '# 四参数反算示例（DX=500, DY=800, ROT=0°, SCALE=1）\n1000, 2000, 1500, 2800\n3000, 1500, 3500, 2300\n5000, 6000, 5500, 6800'
}

function clearF7() { f7src.value = ''; f7Result.value = null; f7Err.value = '' }
function clearF4() { f4src.value = ''; f4Result.value = null; f4Err.value = '' }
function clearI7() { i7pts.value = ''; i7Result.value = null; i7Err.value = '' }
function clearI4() { i4pts.value = ''; i4Result.value = null; i4Err.value = '' }

function copyF7() {
  if (!f7Result.value) return
  const text = f7Result.value.map(r => r.src.map(v => fmt(v)).join(', ') + ' → ' + r.tgt.map(v => fmt(v)).join(', ')).join('\n')
  navigator.clipboard.writeText(text)
}
function copyF4() {
  if (!f4Result.value) return
  const text = f4Result.value.map(r => r.src.map(v => fmt(v)).join(', ') + ' → ' + r.tgt.map(v => fmt(v)).join(', ')).join('\n')
  navigator.clipboard.writeText(text)
}
</script>
