<template>
  <div class="tool-container">
    <div class="tool-header">
      <button class="back-btn" @click="goBack">← 返回首页</button>
      <h1 class="page-title">H3/S2 网格编码器</h1>
      <span class="page-subtitle">Plus Codes · S2 · H3 三合一全球网格编码</span>
    </div>
    <div class="tool-main">
      <div class="tabs" style="margin-bottom: 1rem;">
        <button class="tab" :class="{ active: tab === 'olc' }" @click="tab = 'olc'">Plus Codes</button>
        <button class="tab" :class="{ active: tab === 's2' }" @click="tab = 's2'">S2 网格</button>
        <button class="tab" :class="{ active: tab === 'h3' }" @click="tab = 'h3'">H3 网格</button>
      </div>

      <!-- Plus Codes -->
      <div v-show="tab === 'olc'">
        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head"><span class="t">经纬度 → Plus Code</span></div>
            <div class="panel-body">
              <div class="action-row">
                <label class="form-label" style="margin: 0;">纬度</label>
                <input class="form-input" type="number" v-model.number="olcLat" step="0.0001" style="width: 100px;" />
                <label class="form-label" style="margin: 0;">经度</label>
                <input class="form-input" type="number" v-model.number="olcLng" step="0.0001" style="width: 100px;" />
              </div>
              <div class="form-group">
                <label class="form-label">码长度</label>
                <select class="form-select" v-model.number="olcLen">
                  <option :value="10">10 位 — 区域级</option>
                  <option :value="11">11 位 — 标准精度</option>
                  <option :value="12">12 位 — 高精度</option>
                </select>
              </div>
              <button class="btn btn-primary" @click="olcEncodeFn">编码</button>
              <div v-if="olcEncResult" class="result-card" style="background: rgba(102,126,234,0.08); border-color: rgba(102,126,234,0.15);">
                <span class="label">Plus Code</span>
                <span class="value" style="font-size: 1.2rem; letter-spacing: 1px;">{{ olcEncResult.code }}</span>
                <span class="sub">解码中心: {{ olcEncResult.dec.lat.toFixed(6) }}, {{ olcEncResult.dec.lng.toFixed(6) }}</span>
                <span class="sub">BBox: {{ olcEncResult.dec.south.toFixed(4) }}~{{ olcEncResult.dec.north.toFixed(4) }}, {{ olcEncResult.dec.west.toFixed(4) }}~{{ olcEncResult.dec.east.toFixed(4) }}</span>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="t">Plus Code → 经纬度</span></div>
            <div class="panel-body">
              <div class="form-group">
                <label class="form-label">Plus Code 字符串</label>
                <input class="form-input" v-model="olcCode" placeholder="如 PRCFM88M+M8" style="font-family: Consolas, monospace;" />
              </div>
              <button class="btn btn-primary" @click="olcDecodeFn">解码</button>
              <div v-if="olcDecResult" class="result-card" style="background: rgba(102,126,234,0.08); border-color: rgba(102,126,234,0.15);">
                <span class="label">解码中心坐标</span>
                <span class="value">{{ olcDecResult.lat.toFixed(6) }}, {{ olcDecResult.lng.toFixed(6) }}</span>
                <span class="sub">BBox S/N: {{ olcDecResult.south.toFixed(6) }} ~ {{ olcDecResult.north.toFixed(6) }}</span>
                <span class="sub">BBox W/E: {{ olcDecResult.west.toFixed(6) }} ~ {{ olcDecResult.east.toFixed(6) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- S2 -->
      <div v-show="tab === 's2'">
        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head"><span class="t">经纬度 → S2 Cell ID</span></div>
            <div class="panel-body">
              <div class="action-row">
                <label class="form-label" style="margin: 0;">纬度</label>
                <input class="form-input" type="number" v-model.number="s2Lat" step="0.0001" style="width: 100px;" />
                <label class="form-label" style="margin: 0;">经度</label>
                <input class="form-input" type="number" v-model.number="s2Lng" step="0.0001" style="width: 100px;" />
              </div>
              <div class="form-group">
                <label class="form-label">S2 Level（0–30）: {{ s2Level }}</label>
                <input type="range" v-model.number="s2Level" min="0" max="30" style="width: 100%; accent-color: #667eea;" />
              </div>
              <button class="btn btn-primary" @click="doS2Encode">编码</button>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="t">S2 输出</span></div>
            <div class="panel-body">
              <div v-if="s2Result">
                <div class="result-card" style="background: rgba(102,126,234,0.08); border-color: rgba(102,126,234,0.15);">
                  <span class="label">S2 Cell ID (十进制)</span>
                  <span class="value" style="font-size: 0.9rem;">{{ s2Result.cellIdDec }}</span>
                </div>
                <div class="result-card" style="margin-top: 0.5rem;">
                  <span class="label">S2 Cell ID (十六进制)</span>
                  <span class="value" style="font-size: 1.1rem;">{{ s2Result.cellIdHex }}</span>
                </div>
                <div class="result-grid" style="margin-top: 0.5rem;">
                  <div class="result-card"><span class="label">Face</span><span class="value">{{ s2Result.face }}</span></div>
                  <div class="result-card"><span class="label">Level</span><span class="value">{{ s2Result.level }}</span></div>
                  <div class="result-card"><span class="label">中心点</span><span class="value">{{ s2Result.center.lat.toFixed(6) }}, {{ s2Result.center.lng.toFixed(6) }}</span></div>
                </div>
              </div>
              <div v-else class="msg">输入坐标并点击「编码」按钮</div>
            </div>
          </div>
        </div>
      </div>

      <!-- H3 -->
      <div v-show="tab === 'h3'">
        <div class="tool-grid">
          <div class="panel">
            <div class="panel-head"><span class="t">经纬度 → H3 索引</span></div>
            <div class="panel-body">
              <div class="action-row">
                <label class="form-label" style="margin: 0;">纬度</label>
                <input class="form-input" type="number" v-model.number="h3Lat" step="0.0001" style="width: 100px;" />
                <label class="form-label" style="margin: 0;">经度</label>
                <input class="form-input" type="number" v-model.number="h3Lng" step="0.0001" style="width: 100px;" />
              </div>
              <div class="form-group">
                <label class="form-label">H3 Resolution（0–15）: {{ h3Res }}</label>
                <input type="range" v-model.number="h3Res" min="0" max="15" style="width: 100%; accent-color: #667eea;" />
              </div>
              <button class="btn btn-primary" @click="doH3Encode">编码</button>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><span class="t">H3 输出</span></div>
            <div class="panel-body">
              <div v-if="h3Result">
                <div class="result-card" style="background: rgba(102,126,234,0.08); border-color: rgba(102,126,234,0.15);">
                  <span class="label">H3 索引</span>
                  <span class="value" style="font-size: 1.1rem;">{{ h3Result.h3Index }}</span>
                </div>
                <div class="result-grid" style="margin-top: 0.5rem;">
                  <div class="result-card"><span class="label">Base Cell</span><span class="value">{{ h3Result.baseCell }} / 121</span></div>
                  <div class="result-card"><span class="label">Resolution</span><span class="value">{{ h3Result.resolution }}</span></div>
                  <div class="result-card"><span class="label">边长</span><span class="value">{{ h3Result.edgeKm }} km</span></div>
                </div>
              </div>
              <div v-else class="msg">输入坐标并点击「编码」按钮</div>
            </div>
          </div>
        </div>
      </div>

      <div class="tool-footer">Plus Codes (OLC) 为完整实现 · S2/H3 为简化实现 · 全部本地运算</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import '../assets/tool-common.css'
import { olcEncode, olcDecode, type OlcDecodeResult } from '../utils/h3-s2-grid'
import { s2Encode, type S2Result } from '../utils/h3-s2-grid'
import { h3Encode, type H3Result } from '../utils/h3-s2-grid'

const router = useRouter()
const goBack = () => router.push('/')

const tab = ref<'olc' | 's2' | 'h3'>('olc')

// Plus Codes
const olcLat = ref(39.9)
const olcLng = ref(116.4)
const olcLen = ref(11)
const olcCode = ref('')
const olcEncResult = ref<{ code: string; dec: OlcDecodeResult } | null>(null)
const olcDecResult = ref<OlcDecodeResult | null>(null)

function doOlcEncode() {
  try {
    const code = olcEncode(olcLat.value, olcLng.value, olcLen.value)
    const dec = olcDecode(code)
    olcEncResult.value = { code, dec }
  } catch (e) {
    olcEncResult.value = null
  }
}

function doOlcDecode() {
  if (!olcCode.value.trim()) { olcDecResult.value = null; return }
  try {
    olcDecResult.value = olcDecode(olcCode.value)
  } catch (e) {
    olcDecResult.value = null
  }
}

const olcEncodeFn = () => doOlcEncode()
const olcDecodeFn = () => doOlcDecode()

// S2
const s2Lat = ref(39.9)
const s2Lng = ref(116.4)
const s2Level = ref(14)
const s2Result = ref<S2Result | null>(null)

function doS2Encode() {
  try {
    s2Result.value = s2Encode(s2Lat.value, s2Lng.value, s2Level.value)
  } catch (e) {
    s2Result.value = null
  }
}

// H3
const h3Lat = ref(39.9)
const h3Lng = ref(116.4)
const h3Res = ref(7)
const h3Result = ref<H3Result | null>(null)

function doH3Encode() {
  try {
    h3Result.value = h3Encode(h3Lat.value, h3Lng.value, h3Res.value)
  } catch (e) {
    h3Result.value = null
  }
}
</script>
