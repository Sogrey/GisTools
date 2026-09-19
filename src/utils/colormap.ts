/* ============================================================
 * 色带生成器 · 核心：锚点线性插值 + 输出格式化
 * 提取自 doSometing/colormap-gen/index.html
 * ============================================================ */

export const PRESETS: Record<string, string[]> = {
  viridis: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
  inferno: ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'],
  magma: ['#000004', '#451077', '#9e2f7f', '#cd4071', '#f8765c', '#fefcfd'],
  blues: ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b'],
  greens: ['#f7fcf5', '#c7e9c0', '#74c476', '#238b45', '#00441b'],
  reds: ['#fff5f0', '#fcbba1', '#fb6a4a', '#cb181d', '#67000d'],
  ylorrd: ['#ffffcc', '#ffeda0', '#fed976', '#fe9929', '#e31a1c', '#800026'],
  rdylgn: ['#a50026', '#f46d43', '#fee08b', '#a6d96a', '#1a9850', '#006837'],
  rdbu: ['#b2182b', '#ef8a62', '#f7f7f7', '#67a9cf', '#2166ac'],
  terrain: ['#2f7bd0', '#54b76a', '#e6d13a', '#c98f45', '#f4f1e6'],
  ocean: ['#001a3a', '#00407a', '#007f8a', '#1fa3d0', '#d6edff'],
  gray: ['#000000', '#595959', '#a8a8a8', '#ffffff'],
  rainbow: ['#e41a1c', '#ff7f00', '#ffd700', '#4daf4a', '#377eb8', '#984ea3'],
}

export const PALETTE_NAMES: Record<string, string> = {
  viridis: 'viridis（黄紫蓝绿）',
  inferno: 'inferno（黑紫橙黄）',
  magma: 'magma（黑紫粉黄白）',
  blues: 'blues（白→蓝）',
  greens: 'greens（白→绿）',
  reds: 'reds（白→红）',
  ylorrd: 'ylorrd（黄→橙→红）',
  rdylgn: 'rdylgn（红→黄→绿）',
  rdbu: 'rdbu（红→白→蓝）',
  terrain: 'terrain（蓝绿黄棕白）',
  ocean: 'ocean（海深蓝）',
  gray: 'gray（灰度）',
  rainbow: 'rainbow（彩虹）',
}

export function hexToRgb(h: string): [number, number, number] {
  h = h.replace('#', '')
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgbToHex(c: number[]): string {
  let s = ''
  for (let i = 0; i < 3; i++) {
    const v = c[i]!.toString(16)
    s += v.length < 2 ? '0' + v : v
  }
  return '#' + s
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 锚点线性插值采样 n 个颜色 */
export function sampleColors(anchors: string[], n: number, reversed: boolean): number[][] {
  let pts = anchors.map(hexToRgb)
  if (reversed) pts = pts.slice().reverse()
  const out: number[][] = []
  const last = pts.length - 1
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0 : i / (n - 1)
    const pos = t * last
    const i0 = Math.floor(pos)
    const i1 = Math.min(last, i0 + 1)
    const f = pos - i0
    const c0 = pts[i0]!, c1 = pts[i1]!
    out.push([
      Math.round(lerp(c0[0], c1[0], f)),
      Math.round(lerp(c0[1], c1[1], f)),
      Math.round(lerp(c0[2], c1[2], f)),
    ])
  }
  return out
}

/** 输出格式化 */
export type OutFmt = 'hex' | 'rgba' | 'cesium'

export function fmtHexArr(colors: number[][]): string {
  return JSON.stringify(colors.map(rgbToHex))
}

export function fmtRgbaArr(colors: number[][], withAlpha: boolean): string {
  const parts = colors.map((c) => '[' + c[0] + ',' + c[1] + ',' + c[2] + (withAlpha ? ',255' : '') + ']')
  return '[' + parts.join(',') + ']'
}

export function fmtCesium(colors: number[][], meta: { name: string; count: number; reversed: boolean }): string {
  const L: string[] = []
  L.push('// colormap: ' + meta.name + ' · ' + meta.count + ' colors · reversed: ' + (meta.reversed ? 'true' : 'false'))
  L.push('// 用法: entity/实例着色、折线渐变色等，Cesium.Color.fromBytes(r,g,b,a)')
  L.push('var colors = [')
  colors.forEach((c) => {
    L.push('  Cesium.Color.fromBytes(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', 255),')
  })
  L.push('];')
  return L.join('\n')
}
