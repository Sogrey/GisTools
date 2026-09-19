/* ============================================================
 * 缓冲区生成器 · 核心算法
 * 点/线/多边形缓冲区（平面米制近似）
 * 提取自 doSometing/buffer-gen/index.html
 * ============================================================ */

import { shoelaceArea } from './geo-math'

const TAU = Math.PI * 2
const MPLAT = 110.54 * 1000

type Pt = [number, number]

function mplng(lat: number): number {
  return 111.32 * 1000 * Math.cos((lat * Math.PI) / 180)
}

interface ParsedGeom {
  points: Pt[]
  lines: Pt[][]
  polys: Pt[][]
}

function parseRows(text: string): (Pt | 'ERR')[] {
  const rows: (Pt | 'ERR')[] = []
  text.split(/\r?\n/).forEach((line) => {
    line = line.trim()
    if (!line) return
    const m = line.match(/[-+]?\d*\.?\d+/g)
    if (m && m.length >= 2) {
      const a = parseFloat(m[0])
      const b = parseFloat(m[1]!)
      if (a < -180 || a > 180 || b < -90 || b > 90) {
        rows.push('ERR')
        return
      }
      rows.push([a, b])
    }
  })
  return rows
}

function parseGeoJSON(text: string): ParsedGeom {
  const o = JSON.parse(text)
  const pts: Pt[] = []
  const lines: Pt[][] = []
  const polys: Pt[][] = []
  function pushGeo(g: unknown): void {
    if (!g || typeof g !== 'object') return
    const obj = g as Record<string, unknown>
    const c = obj.coordinates as number[] | number[][]
    switch (obj.type) {
      case 'Point':
        if ((c as number[]).length >= 2) pts.push([(c as number[])[0]!, (c as number[])[1]!])
        break
      case 'MultiPoint':
        ;(c as number[][]).forEach((p) => { if (p.length >= 2) pts.push([p[0]!, p[1]!]) })
        break
      case 'LineString':
        if ((c as number[][]).length >= 2) lines.push(c as Pt[])
        break
      case 'MultiLineString':
        ;(c as unknown as number[][][]).forEach((l) => { if (l.length >= 2) lines.push(l as Pt[]) })
        break
      case 'Polygon':
        if (c && (c as number[][]).length) polys.push((c as unknown as number[][][])[0]! as Pt[])
        break
      case 'MultiPolygon':
        ;(c as unknown as number[][][][]).forEach((p) => { if (p && p.length) polys.push(p[0]! as Pt[]) })
        break
      default:
        break
    }
  }
  function collect(o: unknown): void {
    if (!o || typeof o !== 'object') return
    const obj = o as Record<string, unknown>
    if (obj.type === 'FeatureCollection') {
      (obj.features as unknown[] || []).forEach(collect)
      return
    }
    if (obj.type === 'Feature') {
      pushGeo(obj.geometry)
      return
    }
    pushGeo(obj)
  }
  collect(o)
  return { points: pts, lines, polys }
}

function samePoint(a: Pt, b: Pt): boolean {
  return a[0] === b[0] && a[1] === b[1]
}

function closeRing(pts: Pt[]): Pt[] {
  if (samePoint(pts[0]!, pts[pts.length - 1]!)) return pts.slice()
  return pts.concat([pts[0]!])
}

function isClosed(pts: Pt[]): boolean {
  return pts.length >= 3 && samePoint(pts[0]!, pts[pts.length - 1]!)
}

export function inferInput(text: string, typeMode: string): ParsedGeom {
  text = text.trim()
  if (!text) throw new Error('输入为空')
  if (/^[\{\[]/.test(text)) {
    const g = parseGeoJSON(text)
    if (!g.points.length && !g.lines.length && !g.polys.length) throw new Error('未识别到有效几何')
    return g
  }
  const rows = parseRows(text)
  if (!rows.length) throw new Error('未解析到坐标（期望每行 经度,纬度）')
  if (rows.some((r) => r === 'ERR')) throw new Error('坐标超出合法范围（经度 ±180 / 纬度 ±90）')
  const pts = rows as Pt[]
  const g: ParsedGeom = { points: [], lines: [], polys: [] }
  if (typeMode === 'point') {
    g.points = pts
    return g
  }
  if (typeMode === 'line') {
    if (pts.length < 2) throw new Error('折线至少需要 2 个顶点')
    g.lines.push(pts)
    return g
  }
  if (typeMode === 'polygon') {
    if (pts.length < 3) throw new Error('多边形至少需要 3 个顶点')
    g.polys.push(closeRing(pts))
    return g
  }
  if (pts.length === 1) g.points = pts
  else if (samePoint(pts[0]!, pts[pts.length - 1]!)) g.polys.push(pts)
  else g.lines.push(pts)
  return g
}

function toLocal(pts: Pt[]): Pt[] {
  const p0 = pts[0]!
  const kx = mplng(p0[1])
  const ky = MPLAT
  return pts.map((p) => [(p[0] - p0[0]) * kx, (p[1] - p0[1]) * ky])
}

function fromLocal(local: Pt[], p0: Pt): Pt[] {
  const kx = mplng(p0[1])
  const ky = MPLAT
  return local.map((p) => [p[0] / kx + p0[0], p[1] / ky + p0[1]])
}

function normAng(a: number): number {
  a %= TAU
  if (a > Math.PI) a -= TAU
  if (a < -Math.PI) a += TAU
  return a
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function circleRing(lng: number, lat: number, r: number, seg: number): Pt[] {
  const ring: Pt[] = []
  const dx = r / mplng(lat)
  const dy = r / MPLAT
  for (let i = 0; i < seg; i++) {
    const a = (TAU * i) / seg
    ring.push([lng + dx * Math.cos(a), lat + dy * Math.sin(a)])
  }
  ring.push(ring[0]!)
  return ring
}

export function squareRing(lng: number, lat: number, r: number): Pt[] {
  const dx = r / mplng(lat)
  const dy = r / MPLAT
  return [
    [lng - dx, lat - dy],
    [lng + dx, lat - dy],
    [lng + dx, lat + dy],
    [lng - dx, lat + dy],
    [lng - dx, lat - dy],
  ]
}

export function lineBufferRing(local: Pt[], r: number, seg: number): Pt[] {
  if (isClosed(local)) return polygonBufferRing(local, r)
  const n = local.length
  const as: number[] = []
  for (let i = 0; i < n - 1; i++) {
    as.push(Math.atan2(local[i + 1]![1] - local[i]![1], local[i + 1]![0] - local[i]![0]))
  }
  const step = TAU / seg
  const ring: Pt[] = []
  function off(i: number, ang: number): Pt {
    return [local[i]![0] + r * Math.cos(ang), local[i]![1] + r * Math.sin(ang)]
  }
  function addArc(i: number, f: number, t: number, ccw: boolean): void {
    let d = ccw ? t - f : f - t
    d = ((d % TAU) + TAU) % TAU
    if (d < 1e-9 || d > TAU - 1e-9) return
    const cnt = Math.max(1, Math.ceil(d / step))
    for (let k = 1; k <= cnt; k++) {
      const a = ccw ? f + (d * k) / cnt : f - (d * k) / cnt
      ring.push([local[i]![0] + r * Math.cos(a), local[i]![1] + r * Math.sin(a)])
    }
  }
  const a0 = as[0]!
  const H = Math.PI / 2
  ring.push(off(0, a0 + H))
  addArc(0, a0 + H, a0 + 3 * H, true)
  for (let i = 0; i < n - 1; i++) {
    const a = as[i]!
    ring.push(off(i + 1, a - H))
    if (i < n - 2) {
      const an = as[i + 1]!
      const dl = normAng(an - a)
      addArc(i + 1, a - H, an - H, dl > 0)
    } else {
      addArc(n - 1, a - H, a + H, true)
    }
  }
  for (let i = n - 2; i >= 0; i--) {
      const a2 = as[i]!
    ring.push(off(i, a2 + H))
    if (i > 0) {
      const ap = as[i - 1]!
      const dl2 = normAng(a2 - ap)
      addArc(i, a2 + H, ap + H, dl2 > 0)
    } else {
      addArc(0, a2 + H, a2 - H, true)
    }
  }
  ring.push(ring[0]!)
  return ring
}

export function polygonBufferRing(local: Pt[], r: number): Pt[] {
  const pts = isClosed(local) ? local.slice(0, local.length - 1) : local.slice()
  if (pts.length < 3) throw new Error('多边形至少需要 3 个顶点')
  const n = pts.length
  let area = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += pts[i]![0] * pts[j]![1] - pts[j]![0] * pts[i]![1]
  }
  const ccw = area > 0
  const out: Pt[] = []
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!
    const cur = pts[i]!
    const next = pts[(i + 1) % n]!
    const e1x = cur[0] - prev[0]
    const e1y = cur[1] - prev[1]
    const e2x = next[0] - cur[0]
    const e2y = next[1] - cur[1]
    const l1 = Math.sqrt(e1x * e1x + e1y * e1y)
    const l2 = Math.sqrt(e2x * e2x + e2y * e2y)
    if (l1 < 1e-9 || l2 < 1e-9) {
      out.push(cur)
      continue
    }
    const nx1 = e1x / l1, ny1 = e1y / l1, nx2 = e2x / l2, ny2 = e2y / l2
    const cross = nx1 * ny2 - ny1 * nx2
    const dot = clamp(nx1 * nx2 + ny1 * ny2, -1, 1)
    const half = Math.acos(dot) / 2
    let d = r / Math.max(0.15, Math.sin(half))
    if (d > 30 * r) d = 30 * r
    let bx = nx2 - nx1
    let by = ny2 - ny1
    const bl = Math.sqrt(bx * bx + by * by)
    if (bl < 1e-9) { bx = -ny1; by = nx1 } else { bx /= bl; by /= bl }
    const convex = cross > 0 === ccw
    const k = convex ? -d : d
    out.push([cur[0] + bx * k, cur[1] + by * k])
  }
  out.push(out[0]!)
  return out
}

function bufferFeature(ring: Pt[]): { type: string; coordinates: Pt[][] } {
  return { type: 'Polygon', coordinates: [ring] }
}

export interface BufferResult {
  fc: { type: string; features: unknown[] }
  srcInfo: string[]
}

export function generateBuffer(
  text: string,
  typeMode: string,
  rMeters: number,
  shape: 'circle' | 'square',
  seg: number
): BufferResult {
  const g = inferInput(text, typeMode)
  const features: unknown[] = []
  const srcInfo: string[] = []
  g.points.forEach((p) => {
    const ring = shape === 'square' ? squareRing(p[0], p[1], rMeters) : circleRing(p[0], p[1], rMeters, seg)
    features.push({
      type: 'Feature',
      properties: { 源: '点', 形状: shape === 'square' ? '方形' : '圆形', 缓冲: rMeters + ' m' },
      geometry: bufferFeature(ring),
    })
    srcInfo.push('点')
  })
  g.lines.forEach((ls) => {
    if (ls.length < 2) return
    const p0 = ls[0]!
    const local = toLocal(ls)
    const ringLocal = lineBufferRing(local, rMeters, seg)
    const ring = fromLocal(ringLocal, p0)
    features.push({
      type: 'Feature',
      properties: { 源: '线', 形状: '圆角折线', 缓冲: rMeters + ' m' },
      geometry: bufferFeature(ring),
    })
    srcInfo.push('线')
  })
  g.polys.forEach((pl) => {
    if (pl.length < 3) throw new Error('多边形至少需要 3 个顶点')
    const p0 = pl[0]!
    const local = toLocal(pl)
    const ringLocal = polygonBufferRing(local, rMeters)
    const ring = fromLocal(ringLocal, p0)
    features.push({
      type: 'Feature',
      properties: { 源: '面', 形状: shape === 'square' ? '方形外扩' : '法线外扩', 缓冲: rMeters + ' m' },
      geometry: bufferFeature(ring),
    })
    srcInfo.push('面')
  })
  if (!features.length) throw new Error('没有可缓冲的几何')
  return { fc: { type: 'FeatureCollection', features }, srcInfo }
}

function ringAreaM2(ring: Pt[]): number {
  const pts = isClosed(ring) ? ring.slice(0, ring.length - 1) : ring
  const n = pts.length
  if (n < 3) return 0
  const p0 = pts[0]!
  const kx = mplng(p0[1])
  const ky = MPLAT
  const local = pts.map((p) => [(p[0] - p0[0]) * kx, (p[1] - p0[1]) * ky] as Pt)
  return shoelaceArea(local)
}

export function countVertices(fc: { features: { geometry: { coordinates: Pt[][] } }[] }): number {
  let v = 0
  fc.features.forEach((f) => {
    ;(f.geometry.coordinates || []).forEach((r) => { v += r.length })
  })
  return v
}

export function totalAreaKm2(fc: { features: { geometry: { coordinates: Pt[][] } }[] }): number {
  let s = 0
  fc.features.forEach((f) => {
    s += ringAreaM2(f.geometry.coordinates[0]!)
  })
  return s / 1e6
}
