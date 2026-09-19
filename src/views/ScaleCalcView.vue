<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">比例尺计算器</h1>
      <span class="page-subtitle">像素 ↔ 距离 ↔ 比例尺 ↔ Web墨卡托层级</span>
    </div>
    <div class="tool-main">
      <!-- 标签页 -->
      <div class="tabs" style="margin-bottom: 1rem;">
        <button class="tab" :class="{ active: mode === 'px' }" @click="mode = 'px'">像素 ↔ 距离</button>
        <button class="tab" :class="{ active: mode === 'scale' }" @click="mode = 'scale'">比例尺 × DPI</button>
        <button class="tab" :class="{ active: mode === 'zoom' }" @click="mode = 'zoom'">Z + 纬度</button>
        <button class="tab" :class="{ active: mode === 'plot' }" @click="mode = 'plot'">出图建议</button>
      </div>

      <!-- 模式 1：像素 ↔ 距离 -->
      <div class="panel" v-show="mode === 'px'" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">已知像素数与地面距离</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="margin: 0;">像素数</label>
            <input class="form-input" type="number" v-model.number="m1Px" style="width: 110px;" />
            <label class="form-label" style="margin: 0;">地面距离</label>
            <input class="form-input" type="number" v-model.number="m1Dist" style="width: 110px;" />
            <select class="form-select" v-model="m1Unit" style="width: 80px;">
              <option value="m">米</option><option value="km">千米</option><option value="mi">英里</option>
            </select>
            <label class="form-label" style="margin: 0;">DPI</label>
            <input class="form-input" type="number" v-model.number="m1Dpi" style="width: 76px;" />
          </div>
          <div class="result-grid">
            <div class="result-card" style="background: rgba(102,126,234,0.12); border-color: rgba(102,126,234,0.3);">
              <span class="label">地面分辨率</span><span class="value">{{ m1 ? fmtN(m1.res, 5) : '—' }}</span><span class="sub">米 / 像素</span>
            </div>
            <div class="result-card"><span class="label">比例尺分母</span><span class="value">{{ m1 ? fmtScale(m1.scale) : '—' }}</span><span class="sub">约 1 : D</span></div>
            <div class="result-card"><span class="label">推荐标准比例尺</span><span class="value">{{ m1 ? fmtScale(m1.stdScale) : '—' }}</span><span class="sub">标准序列就近取整</span></div>
            <div class="result-card"><span class="label">1 km 图上像素</span><span class="value">{{ m1 ? fmtN(m1.pxPerKm, 1) + ' px' : '—' }}</span><span class="sub">图上每公里像素密度</span></div>
            <div class="result-card"><span class="label">等效 Web墨卡托层级</span><span class="value">{{ m1 ? '≈ Z' + fmtN(m1.zoom, 1) : '—' }}</span><span class="sub">赤道近似 Z</span></div>
          </div>
        </div>
      </div>

      <!-- 模式 2：比例尺 × DPI -->
      <div class="panel" v-show="mode === 'scale'" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">已知比例尺与 DPI</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="margin: 0;">比例尺</label>
            <input class="form-input" type="number" v-model.number="m2D" style="width: 120px;" />
            <label class="form-label" style="margin: 0;">DPI</label>
            <input class="form-input" type="number" v-model.number="m2Dpi" style="width: 76px;" />
            <span class="form-hint" style="margin: 0;">打印常用 300；1:10000 即图上 1mm = 地面 10m</span>
          </div>
          <div class="result-grid">
            <div class="result-card" style="background: rgba(102,126,234,0.12); border-color: rgba(102,126,234,0.3);">
              <span class="label">地面分辨率</span><span class="value">{{ m2 ? fmtN(m2.res, 5) : '—' }}</span><span class="sub">米 / 像素</span>
            </div>
            <div class="result-card"><span class="label">每英寸地面距离</span><span class="value">{{ m2 ? fmtN(m2.inchDist, 3) + ' m' : '—' }}</span><span class="sub">DPI × 分辨率</span></div>
            <div class="result-card"><span class="label">1 km 图上像素</span><span class="value">{{ m2 ? fmtN(m2.pxPerKm, 1) + ' px' : '—' }}</span><span class="sub">像素 / 公里</span></div>
            <div class="result-card"><span class="label">A4 横版覆盖</span><span class="value">{{ m2 ? fmtN(m2.a4W, 3) + ' × ' + fmtN(m2.a4H, 3) + ' km' : '—' }}</span><span class="sub">297 × 210 mm 打印幅面</span></div>
          </div>
        </div>
      </div>

      <!-- 模式 3：Web 墨卡托 z + 纬度 -->
      <div class="panel" v-show="mode === 'zoom'" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">Web墨卡托层级 × 纬度</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="margin: 0;">层级 Z</label>
            <input class="form-input" type="number" v-model.number="m3z" style="width: 76px;" />
            <input type="range" v-model.number="m3z" min="0" max="24" step="1" style="flex: 1; max-width: 180px; accent-color: #667eea;" />
            <label class="form-label" style="margin: 0;">纬度</label>
            <input class="form-input" type="number" v-model.number="m3Lat" style="width: 100px;" />
            <label class="form-label" style="margin: 0;">DPI</label>
            <input class="form-input" type="number" v-model.number="m3Dpi" style="width: 76px;" />
          </div>
          <div class="result-grid">
            <div class="result-card" style="background: rgba(102,126,234,0.12); border-color: rgba(102,126,234,0.3);">
              <span class="label">地面分辨率</span><span class="value">{{ m3 ? fmtN(m3.res, 5) : '—' }}</span><span class="sub">米 / 像素（该纬度）</span>
            </div>
            <div class="result-card"><span class="label">比例尺分母</span><span class="value">{{ m3 ? fmtScale(m3.scale) : '—' }}</span><span class="sub">DPI 打印比例</span></div>
            <div class="result-card"><span class="label">推荐标准比例尺</span><span class="value">{{ m3 ? fmtScale(m3.stdScale) : '—' }}</span><span class="sub">标准序列就近取整</span></div>
            <div class="result-card"><span class="label">瓦片地面跨度</span><span class="value">{{ m3 ? fmtN(m3.tileSpan, 1) + ' m' : '—' }}</span><span class="sub">256px 标准瓦片</span></div>
            <div class="result-card"><span class="label">全球瓦片数量</span><span class="value">{{ m3 ? fmtN(m3.tileCount, 0) : '—' }}</span><span class="sub">2^z × 2^z</span></div>
          </div>
        </div>
      </div>

      <!-- 模式 4：出图幅面 -->
      <div class="panel" v-show="mode === 'plot'" style="margin-bottom: 1rem;">
        <div class="panel-head"><span class="t">出图幅面 → 建议比例尺</span></div>
        <div class="panel-body">
          <div class="action-row" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="margin: 0;">图幅宽</label>
            <input class="form-input" type="number" v-model.number="m4W" style="width: 90px;" /><span class="form-hint" style="margin: 0;">mm</span>
            <label class="form-label" style="margin: 0;">图幅高</label>
            <input class="form-input" type="number" v-model.number="m4H" style="width: 90px;" /><span class="form-hint" style="margin: 0;">mm</span>
          </div>
          <div class="action-row" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="margin: 0;">范围宽</label>
            <input class="form-input" type="number" v-model.number="m4RW" style="width: 90px;" /><span class="form-hint" style="margin: 0;">km</span>
            <label class="form-label" style="margin: 0;">范围高</label>
            <input class="form-input" type="number" v-model.number="m4RH" style="width: 90px;" /><span class="form-hint" style="margin: 0;">km</span>
            <label class="form-label" style="margin: 0;">DPI</label>
            <input class="form-input" type="number" v-model.number="m4Dpi" style="width: 76px;" />
          </div>
          <div class="result-grid">
            <div class="result-card" style="background: rgba(102,126,234,0.12); border-color: rgba(102,126,234,0.3);">
              <span class="label">建议标准比例尺</span><span class="value">{{ m4 ? fmtScale(m4.stdScale) : '—' }}</span><span class="sub">{{ m4 && m4.overLimit ? '超出标准序列上限' : '标准序列：1:500…1:100万' }}</span>
            </div>
            <div class="result-card"><span class="label">需求比例尺分母</span><span class="value">{{ m4 ? fmtScale(m4.demandScale) : '—' }}</span><span class="sub">按宽高取较大值</span></div>
            <div class="result-card"><span class="label">出图分辨率</span><span class="value">{{ m4 ? fmtN(m4.res, 5) : '—' }}</span><span class="sub">米/像素（DPI）</span></div>
            <div class="result-card"><span class="label">图幅覆盖范围</span><span class="value">{{ m4 ? fmtN(m4.coverW, 3) + ' × ' + fmtN(m4.coverH, 3) + ' km' : '—' }}</span><span class="sub">宽 × 高</span></div>
            <div class="result-card"><span class="label">等效 Web墨卡托层级</span><span class="value">{{ m4 ? '≈ Z' + fmtN(m4.zoom, 1) : '—' }}</span><span class="sub">赤道近似 Z</span></div>
          </div>
        </div>
      </div>

      <div class="tool-footer">
        分辨率(m/px) = 地面距离 / 像素数 · 比例尺分母 = 分辨率 ÷ (0.0254 ÷ DPI) · Web墨卡托：156543.03392 × cos(纬度) ÷ 2^z<br>
        标准比例尺序列：1:500 / 1000 / 2000 / 5000 / 1万 / 2.5万 / 5万 / 10万 / 25万 / 50万 / 100万
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { fmtN, fmtScale, calcPxToDist, calcScaleDpi, calcZoom, calcPlot } from '../utils/scale-calc'
import type { Mode1Result, Mode2Result, Mode3Result, Mode4Result } from '../utils/scale-calc'

const router = useRouter()
const goBack = () => router.push('/')

const mode = ref<'px' | 'scale' | 'zoom' | 'plot'>('px')

// Mode 1
const m1Px = ref(1536)
const m1Dist = ref(3.2)
const m1Unit = ref('km')
const m1Dpi = ref(96)
const m1 = computed<Mode1Result | null>(() => calcPxToDist(m1Px.value, m1Dist.value, m1Unit.value, m1Dpi.value))

// Mode 2
const m2D = ref(10000)
const m2Dpi = ref(96)
const m2 = computed<Mode2Result | null>(() => calcScaleDpi(m2D.value, m2Dpi.value))

// Mode 3
const m3z = ref(16)
const m3Lat = ref(39.9075)
const m3Dpi = ref(96)
const m3 = computed<Mode3Result | null>(() => calcZoom(m3z.value, m3Lat.value, m3Dpi.value))

// Mode 4
const m4W = ref(297)
const m4H = ref(210)
const m4RW = ref(2.5)
const m4RH = ref(1.7)
const m4Dpi = ref(300)
const m4 = computed<Mode4Result | null>(() => calcPlot(m4W.value, m4H.value, m4RW.value, m4RH.value, m4Dpi.value))
</script>
