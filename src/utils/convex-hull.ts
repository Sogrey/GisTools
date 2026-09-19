/* ============================================================
 * 凸包计算器 · 核心算法
 * Andrew's Monotone Chain O(n log n)
 * 提取自 doSometing/convex-hull/index.html
 * ============================================================ */

import { haversine, polygonPerimeter as polygonPerimeterM, shoelaceArea } from './geo-math'

const RAD = Math.PI / 180
const M_PER_DEG_LAT = 110540

type Pt = [number, number]

function mPerDegLng(lat: number): number {
  return 111320 * Math.cos(lat * RAD)
}

export interface ParseResult {
  points: Pt[]
  ignored: number
  source: string
}

export function parsePoints(text: string): ParseResult {
  if (typeof text !== 'string' || !text.trim()) throw new Error('输入为空')
  const t = text.trim()
  const out: ParseResult = { points: [], ignored: 0, source: 'csv' }
  if (t.charAt(0) === '{' || t.charAt(0) === '[') {
    let obj: unknown
    try {
      obj = JSON.parse(t)
    } catch (e) {
      throw new Error('看起来是 JSON 但解析失败：' + (e as Error).message)
    }
    out.source = 'geojson'
    collectGeo(obj, out)
  } else {
    const numRe = /[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g
    text.split(/\r?\n/).forEach((line) => {
      const m = line.match(numRe)
      if (!m || m.length < 2) {
        if (line.trim()) out.ignored++
        return
      }
      pushCoord([parseFloat(m[0]!), parseFloat(m[1]!)], out)
    })
  }
  if (out.points.length === 0) throw new Error('未解析到有效点（' + out.ignored + ' 个无效条目被忽略）')
  return out
}

function pushCoord(c: number[] | Pt, out: ParseResult): void {
  if (
    !Array.isArray(c) ||
    c.length < 2 ||
    typeof c[0] !== 'number' ||
    typeof c[1] !== 'number' ||
    !isFinite(c[0]) ||
    !isFinite(c[1]) ||
    c[0] < -180 ||
    c[0] > 180 ||
    c[1] < -90 ||
    c[1] > 90
  ) {
    out.ignored++
    return
  }
  out.points.push([c[0], c[1]])
}

function collectGeo(node: unknown, out: ParseResult): void {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const obj = node as Record<string, unknown>
  switch (obj.type) {
    case 'Point':
      pushCoord(obj.coordinates as number[], out)
      break
    case 'MultiPoint':
      (obj.coordinates as number[][] || []).forEach((c) => pushCoord(c, out))
      break
    case 'Feature':
      collectGeo(obj.geometry, out)
      break
    case 'FeatureCollection':
      (obj.features as unknown[] || []).forEach((f) => collectGeo(f, out))
      break
    case 'GeometryCollection':
      (obj.geometries as unknown[] || []).forEach((g) => collectGeo(g, out))
      break
    default:
      out.ignored++
  }
}

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
}

export function convexHull(points: Pt[]): Pt[] {
  if (!points || points.length === 0) return []
  const p = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const uniq: Pt[] = []
  for (let i = 0; i < p.length; i++) {
    const u = uniq.length
    if (u === 0 || uniq[u - 1]![0] !== p[i]![0] || uniq[u - 1]![1] !== p[i]![1]) uniq.push(p[i]!)
  }
  const n = uniq.length
  if (n < 3) return uniq
  const lower: Pt[] = []
  const upper: Pt[] = []
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, uniq[i]!) <= 0) lower.pop()
    lower.push(uniq[i]!)
  }
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, uniq[i]!) <= 0) upper.pop()
    upper.push(uniq[i]!)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

export function polygonArea(pts: Pt[]): number {
  const n = pts ? pts.length : 0
  if (n < 3) return 0
  let m = n
  if (pts[0]![0]! === pts[n - 1]![0]! && pts[0]![1]! === pts[n - 1]![1]!) m--
  const areaDeg2 = shoelaceArea(pts.slice(0, m))
  let latSum = 0
  for (let i = 0; i < m; i++) latSum += pts[i]![1]!
  const latMid = latSum / m
  return areaDeg2 * M_PER_DEG_LAT * mPerDegLng(latMid)
}

export function haversineKm(a: Pt, b: Pt): number {
  return haversine(a[0], a[1], b[0], b[1]) / 1000
}

export function polygonPerimeter(pts: Pt[]): number {
  const n = pts ? pts.length : 0
  if (n < 2) return 0
  return polygonPerimeterM(pts) / 1000
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6
}

export interface HullResult {
  fc: { type: string; features: unknown[] }
  points: Pt[]
  source: string
  ignored: number
  hull: Pt[]
  areaKm2: number
  perimKm: number
  degenerate: boolean
}

export function buildResult(text: string): HullResult {
  const parsed = parsePoints(text)
  const hull = convexHull(parsed.points)
  const fc: { type: string; features: unknown[] } = { type: 'FeatureCollection', features: [] }
  let areaKm2 = 0
  let perimKm = 0
  const degenerate = hull.length < 3
  if (hull.length >= 3) {
    areaKm2 = polygonArea(hull) / 1e6
    perimKm = polygonPerimeter(hull)
    const ring = hull.concat([hull[0]!])
    fc.features.push({
      type: 'Feature',
      properties: {
        name: 'convex_hull',
        vertices: hull.length,
        area_km2: round6(areaKm2),
        perimeter_km: round6(perimKm),
      },
      geometry: { type: 'Polygon', coordinates: [ring] },
    })
    fc.features.push({
      type: 'Feature',
      properties: { name: 'convex_hull_boundary', vertices: hull.length, length_km: round6(perimKm) },
      geometry: { type: 'LineString', coordinates: ring },
    })
  } else if (hull.length === 2) {
    perimKm = 2 * haversineKm(hull[0]!, hull[1]!)
    fc.features.push({
      type: 'Feature',
      properties: {
        name: 'convex_hull_boundary',
        degenerate: true,
        vertices: 2,
        length_km: round6(haversineKm(hull[0]!, hull[1]!)),
      },
      geometry: { type: 'LineString', coordinates: [hull[0], hull[1]] },
    })
  } else {
    throw new Error('所有点位置重合，无法构成凸包')
  }
  return {
    fc,
    points: parsed.points,
    source: parsed.source,
    ignored: parsed.ignored,
    hull,
    areaKm2,
    perimKm,
    degenerate,
  }
}
