/* ============================================================
 * 点密度热力图 · 核心：高斯核 + Canvas 叠加 + 色带映射
 * 提取自 doSometing/heatmap-density/index.html
 * ============================================================ */

export const PALETTES: Record<string, string[]> = {
  heat: ['#000020', '#000040', '#000080', '#0000c0', '#0040ff', '#00a0ff', '#00ff80', '#80ff00', '#ffff00', '#ff8000', '#ff0000', '#a00000'],
  viridis: ['#440154', '#414487', '#2a788e', '#22a884', '#7ad151', '#fde725'],
  inferno: ['#000004', '#420a68', '#932667', '#dd513a', '#fca50a', '#fcffa4'],
  gray: ['#000000', '#ffffff'],
}

export function hexToRgb(h: string): [number, number, number] {
  h = h.replace('#', '')
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 生成 256 色查找表 */
export function buildLUT(paletteName: string): Uint8ClampedArray {
  const anchors = PALETTES[paletteName] || PALETTES.heat!
  const pts = anchors.map(hexToRgb)
  const lut = new Uint8ClampedArray(256 * 3)
  const last = pts.length - 1
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const pos = t * last
    const i0 = Math.floor(pos), i1 = Math.min(last, i0 + 1)
    const f = pos - i0
    lut[i * 3] = Math.round(lerp(pts[i0]![0], pts[i1]![0], f))
    lut[i * 3 + 1] = Math.round(lerp(pts[i0]![1], pts[i1]![1], f))
    lut[i * 3 + 2] = Math.round(lerp(pts[i0]![2], pts[i1]![2], f))
  }
  return lut
}

/** 高斯核函数 */
export function gaussKernel(d: number, sigma: number): number {
  if (sigma <= 0) return d === 0 ? 1 : 0
  const s2 = 2 * sigma * sigma
  return Math.exp(-(d * d) / s2)
}

export interface HeatPoint {
  x: number
  y: number
  weight: number
}

/** 解析 GeoJSON 点集 */
export function parsePoints(geojson: any, weightField: string): HeatPoint[] {
  let gj: any
  if (typeof geojson === 'string') gj = JSON.parse(geojson)
  else gj = geojson
  if (!gj || gj.type !== 'FeatureCollection') throw new Error('需要 GeoJSON FeatureCollection')
  const points: HeatPoint[] = []
  for (let i = 0; i < gj.features.length; i++) {
    const feat = gj.features[i]
    const geom = feat.geometry
    if (!geom) continue
    let w = 1
    if (weightField && feat.properties && typeof feat.properties[weightField] === 'number') {
      w = feat.properties[weightField]
    }
    if (geom.type === 'Point') {
      points.push({ x: geom.coordinates[0], y: geom.coordinates[1], weight: w })
    } else if (geom.type === 'MultiPoint') {
      for (let k = 0; k < geom.coordinates.length; k++) {
        points.push({ x: geom.coordinates[k][0], y: geom.coordinates[k][1], weight: w })
      }
    }
  }
  return points
}

/** 提取所有数值字段 */
export function extractWeightFields(geojson: any): string[] {
  const fields: Record<string, boolean> = {}
  for (let i = 0; i < geojson.features.length; i++) {
    const props = geojson.features[i].properties || {}
    for (const k in props) {
      if (typeof props[k] === 'number') fields[k] = true
    }
  }
  return Object.keys(fields)
}

/** 计算点集 bbox */
export function pointsBbox(points: HeatPoint[]): [number, number, number, number] | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
  }
  if (minX === Infinity) return null
  return [minX, minY, maxX, maxY]
}

export interface HeatRenderOptions {
  radiusPx?: number
  palette?: string
  alpha?: number
}

/** 渲染热力图到 Canvas */
export function renderHeat(canvas: HTMLCanvasElement, points: HeatPoint[], opts: HeatRenderOptions = {}): void {
  const radiusPx = opts.radiusPx || 30
  const paletteName = opts.palette || 'heat'
  const alphaFactor = opts.alpha != null ? opts.alpha : 0.8
  const width = canvas.width, height = canvas.height

  if (!points.length) return

  const bbox = pointsBbox(points)
  if (!bbox) return
  let bw = bbox[2] - bbox[0], bh = bbox[3] - bbox[1]
  if (bw <= 0) bw = 1
  if (bh <= 0) bh = 1
  const pad = radiusPx + 4
  const scale = Math.min((width - pad * 2) / bw, (height - pad * 2) / bh)
  const offX = pad + (width - pad * 2 - bw * scale) / 2
  const offY = pad + (height - pad * 2 - bh * scale) / 2

  const toPx = (p: HeatPoint): [number, number] => [
    offX + (p.x - bbox[0]) * scale,
    offY + (bbox[3] - p.y) * scale,
  ]

  const off = document.createElement('canvas')
  off.width = width; off.height = height
  const octx = off.getContext('2d')!

  let maxWeight = 0
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.weight > maxWeight) maxWeight = points[i]!.weight
  }
  if (maxWeight <= 0) maxWeight = 1

  octx.globalCompositeOperation = 'lighter'
  for (let j = 0; j < points.length; j++) {
    const pt = points[j]!
    const px = toPx(pt)
    const cx = px[0], cy = px[1]
    const r = Math.max(1, radiusPx)
    const intensity = (pt.weight / maxWeight) * alphaFactor

    const grad = octx.createRadialGradient(cx, cy, 0, cx, cy, r)
    const sigma = r / 3
    for (let step = 0; step <= 10; step++) {
      const t = step / 10
      const d = t * r
      const kernel = gaussKernel(d, sigma)
      const a = kernel * intensity
      grad.addColorStop(t, 'rgba(255,255,255,' + a.toFixed(4) + ')')
    }
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    octx.fillStyle = grad
    octx.beginPath()
    octx.arc(cx, cy, r, 0, Math.PI * 2)
    octx.fill()
  }

  const imgData = octx.getImageData(0, 0, width, height)
  const data = imgData.data
  const lut = buildLUT(paletteName)

  let maxV = 0
  for (let k = 0; k < data.length; k += 4) {
    const v = data[k]! * 0.299 + data[k + 1]! * 0.587 + data[k + 2]! * 0.114
    if (v > maxV) maxV = v
  }
  if (maxV <= 0) maxV = 1

  for (let m = 0; m < data.length; m += 4) {
    const v = data[m]! * 0.299 + data[m + 1]! * 0.587 + data[m + 2]! * 0.114
    if (v < 1) {
      data[m] = 0; data[m + 1] = 0; data[m + 2] = 0; data[m + 3] = 0
    } else {
      const norm = v / maxV
      const gamma = Math.pow(norm, 0.8)
      let idx = Math.round(gamma * 255)
      if (idx > 255) idx = 255
      data[m] = lut[idx * 3]!
      data[m + 1] = lut[idx * 3 + 1]!
      data[m + 2] = lut[idx * 3 + 2]!
      data[m + 3] = Math.round(norm * 255)
    }
  }

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, width, height)
  ctx.putImageData(imgData, 0, 0)
}
