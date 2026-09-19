/* ============================================================
 * 专题图着色 · 核心：分级分类 + 色带映射 + SVG 渲染
 * 提取自 doSometing/choropleth-map/index.html
 * ============================================================ */

import { PRESETS, hexToRgb, rgbToHex, sampleColors } from './colormap'
export { PRESETS, hexToRgb, rgbToHex, sampleColors }

/** 等间隔：值域均分为 n 类，返回 n+1 个断点 */
export function classifyEqual(values: number[], n: number): number[] {
  if (!values.length) return []
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (min === max) max = min + 1
  const breaks: number[] = []
  for (let i = 0; i <= n; i++) breaks.push(min + (max - min) * i / n)
  return breaks
}

/** 分位数：每类样本数尽量相等 */
export function classifyQuantile(values: number[], n: number): number[] {
  if (!values.length) return []
  const sorted = values.slice().sort((a, b) => a - b)
  const breaks: number[] = []
  for (let i = 0; i <= n; i++) {
    const idx = (sorted.length - 1) * i / n
    const lo = Math.floor(idx), hi = Math.ceil(idx)
    const f = idx - lo
    breaks.push(sorted[lo]! * (1 - f) + (sorted[hi]! || sorted[lo]!) * f)
  }
  return breaks
}

/** 自定义区间：用户提供逗号分隔的断点 */
export function classifyCustom(str: string): number[] | null {
  const parts = str.split(',').map((s) => parseFloat(s.trim()))
  const breaks = parts.filter((v) => isFinite(v))
  if (breaks.length < 2) return null
  breaks.sort((a, b) => a - b)
  return breaks
}

/** 根据 value 找到所属类别索引 */
export function getClassIndex(value: number, breaks: number[]): number {
  if (breaks.length < 2) return 0
  if (value < breaks[0]!) return 0
  for (let i = 0; i < breaks.length - 1; i++) {
    if (value >= breaks[i]! && value < breaks[i + 1]!) return i
  }
  return breaks.length - 2
}

/** 色带映射 */
export function colorize(breaks: number[], paletteName: string, reversed: boolean): number[][] {
  const n = breaks.length - 1
  if (n < 1) return []
  return sampleColors(PRESETS[paletteName] || PRESETS.viridis!, n, reversed)
}

/** 提取所有数值属性字段名 */
export function extractFields(fc: any): string[] {
  const fields: Record<string, boolean> = {}
  for (let i = 0; i < fc.features.length; i++) {
    const props = fc.features[i].properties || {}
    for (const k in props) {
      if (typeof props[k] === 'number') fields[k] = true
    }
  }
  return Object.keys(fields)
}

/** 计算 bbox */
export function calcBbox(fc: any): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const visitCoord = (c: number[]) => {
    if (c[0]! < minX) minX = c[0]!
    if (c[0]! > maxX) maxX = c[0]!
    if (c[1]! < minY) minY = c[1]!
    if (c[1]! > maxY) maxY = c[1]!
  }
  const visitRing = (r: number[][]) => { for (let i = 0; i < r.length; i++) visitCoord(r[i]!) }
  const visitPoly = (p: number[][][]) => { for (let i = 0; i < p.length; i++) visitRing(p[i]!) }
  for (let f = 0; f < fc.features.length; f++) {
    const geom = fc.features[f].geometry
    if (!geom) continue
    if (geom.type === 'Polygon') visitPoly(geom.coordinates)
    else if (geom.type === 'MultiPolygon') for (let k = 0; k < geom.coordinates.length; k++) visitPoly(geom.coordinates[k])
  }
  if (minX === Infinity) return null
  return [minX, minY, maxX, maxY]
}

/** 坐标 → SVG 路径 */
function ringToPath(ring: number[][], toXY: (c: number[]) => [number, number]): string {
  let d = ''
  for (let i = 0; i < ring.length; i++) {
    const p = toXY(ring[i]!)
    d += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)
  }
  return d + 'Z'
}

/** SVG 构建 */
export function buildSvg(fc: any, field: string, breaks: number[], colors: number[][], opts?: { width?: number; height?: number; padding?: number }): string {
  opts = opts || {}
  const vw = opts.width || 500, vh = opts.height || 400, pad = opts.padding || 16
  const bbox = calcBbox(fc)
  if (!bbox) throw new Error('无法计算边界')

  let bw = bbox[2] - bbox[0], bh = bbox[3] - bbox[1]
  if (bw <= 0) bw = 1
  if (bh <= 0) bh = 1
  const scale = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh)
  const offX = pad + (vw - pad * 2 - bw * scale) / 2
  const offY = pad + (vh - pad * 2 - bh * scale) / 2

  const toXY = (c: number[]): [number, number] => [
    offX + (c[0]! - bbox[0]!) * scale,
    offY + (bbox[3]! - c[1]!) * scale,
  ]

  let paths = ''
  for (let i = 0; i < fc.features.length; i++) {
    const feat = fc.features[i]
    const geom = feat.geometry
    if (!geom) continue
    const val = feat.properties ? feat.properties[field] : null
    const ci = typeof val === 'number' && isFinite(val) ? getClassIndex(val, breaks) : -1
    const fill = ci >= 0 ? rgbToHex(colors[ci]!) : '#e0e0e0'
    const strokeColor = 'rgba(255,255,255,.7)'

    if (geom.type === 'Polygon') {
      let d = ''
      for (let r = 0; r < geom.coordinates.length; r++) d += ringToPath(geom.coordinates[r], toXY)
      paths += '<path d="' + d + '" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="0.5" fill-rule="evenodd"/>'
    } else if (geom.type === 'MultiPolygon') {
      for (let mp = 0; mp < geom.coordinates.length; mp++) {
        let md = ''
        for (let r = 0; r < geom.coordinates[mp].length; r++) md += ringToPath(geom.coordinates[mp][r], toXY)
        paths += '<path d="' + md + '" fill="' + fill + '" stroke="' + strokeColor + '" stroke-width="0.5" fill-rule="evenodd"/>'
      }
    }
  }

  const legendY = vh - 6
  let legendItems = ''
  const legendW = 16, legendGap = 4, legendStartX = pad
  for (let li = 0; li < colors.length; li++) {
    const lx = legendStartX + li * (legendW + legendGap)
    const lo = breaks[li]!.toFixed(2)
    legendItems += '<rect x="' + lx + '" y="' + (legendY - 12) + '" width="' + legendW + '" height="12" fill="' + rgbToHex(colors[li]!) + '" stroke="rgba(0,0,0,.2)" stroke-width="0.5"/>'
    legendItems += '<text x="' + (lx + legendW / 2) + '" y="' + (legendY + 4) + '" font-size="7" fill="#5b6b80" text-anchor="middle">' + lo + '</text>'
  }

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + vw + '" height="' + vh + '" viewBox="0 0 ' + vw + ' ' + vh + '">'
  svg += '<rect width="' + vw + '" height="' + vh + '" fill="#fff"/>'
  svg += paths
  svg += '<g>' + legendItems + '</g>'
  svg += '</svg>'
  return svg
}
