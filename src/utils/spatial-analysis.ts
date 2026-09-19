/* ============================================================
 * 空间分析工具箱 · 核心算法
 * 点在多边形 · 球面面积/周长 · 几何中心 · 矩形边界 · Douglas-Peucker 抽稀
 * 提取自 doSometing/spatial-analysis/index.html
 * ============================================================ */

import { haversine, sphereArea, polygonPerimeter as polygonPerimeterM } from './geo-math'
import { dpSimplify as _dpSimplify } from './line-resample'

/** 度 → 米（R=6371008.8）：把"度"容差适配为 line-resample 的"米"容差 */
const DEG_TO_M = (6371008.8 * Math.PI) / 180

export type Pt = [number, number]

export interface BBox {
  west: number
  south: number
  east: number
  north: number
}

/* 解析坐标（支持 GeoJSON 几何 / WKT / 行坐标） */
export function parseCoords(text: string, fmt: string, isLatLng: boolean): Pt[] {
  const pts: Pt[] = []
  if (fmt === 'xy') {
    text.split(/\r?\n/).forEach((line) => {
      line = line.trim()
      if (!line) return
      const m = line.match(/[-+]?\d*\.?\d+/g)
      if (m && m.length >= 2) {
        const a = parseFloat(m[0]!)
        const b = parseFloat(m[1]!)
        pts.push(isLatLng ? [b, a] : [a, b])
      }
    })
    return pts
  }
  if (fmt === 'wkt') {
    const res = parseWkt(text)
    return res.coords
  }
  const gj = JSON.parse(text)
  const coords: Pt[] = []
  function collect(o: unknown): void {
    if (Array.isArray(o)) {
      if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number') {
        coords.push([o[0] as number, o[1] as number])
      } else {
        o.forEach(collect)
      }
    } else if (typeof o === 'object' && o) {
      for (const k in o as Record<string, unknown>) collect((o as Record<string, unknown>)[k])
    }
  }
  collect(gj)
  return coords
}

/* WKT 解析（简化：仅取坐标对） */
export function parseWkt(wkt: string): { type: string; coords: Pt[] } {
  const type = wkt.match(/^\s*([A-Za-z]+)/)
  const t = type ? type[1]!.toUpperCase() : ''
  const m = wkt.match(/\(([\s\S]*)\)/)
  const body = m ? m[1]! : ''
  const coords: Pt[] = []
  const numRe = /[-+]?\d*\.?\d+/g
  const nums = body.match(numRe) || []
  for (let i = 0; i + 1 < nums.length; i += 2) {
    coords.push([parseFloat(nums[i]!), parseFloat(nums[i + 1]!)])
  }
  return { type: t, coords }
}

/* 点在多边形内（射线法） */
export function pointInPolygon(lng: number, lat: number, poly: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]![0]
    const yi = poly[i]![1]
    const xj = poly[j]![0]
    const yj = poly[j]![1]
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function firstRing(coords: Pt[] | Pt[][]): Pt[] {
  if (coords.length && Array.isArray(coords[0]) && Array.isArray((coords[0] as unknown[])[0])) {
    return (coords as Pt[][])[0]!
  }
  return coords as Pt[]
}

/* 面积（球面多边形，km²） */
export function polygonAreaKm2(ring: Pt[]): number {
  return Math.abs(sphereArea(ring, 6371.0088))
}

/* 周长（球面边长 km） */
export function polygonPerimeter(ring: Pt[]): number {
  return polygonPerimeterM(ring) / 1000
}

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  return haversine(lng1, lat1, lng2, lat2) / 1000
}

/* 几何中心（平均，闭合环自动去重） */
export function centroid(pts: Pt[]): Pt {
  let list = pts
  if (
    pts.length > 1 &&
    pts[0]![0] === pts[pts.length - 1]![0] &&
    pts[0]![1] === pts[pts.length - 1]![1]
  ) {
    list = pts.slice(0, pts.length - 1)
  }
  let sx = 0
  let sy = 0
  for (let i = 0; i < list.length; i++) {
    sx += list[i]![0]
    sy += list[i]![1]
  }
  return [sx / list.length, sy / list.length]
}

/* 矩形边界 */
export function bbox(pts: Pt[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < pts.length; i++) {
    if (pts[i]![0] < minX) minX = pts[i]![0]
    if (pts[i]![0] > maxX) maxX = pts[i]![0]
    if (pts[i]![1] < minY) minY = pts[i]![1]
    if (pts[i]![1] > maxY) maxY = pts[i]![1]
  }
  return { west: minX, south: minY, east: maxX, north: maxY }
}

/* 抽稀 Douglas-Peucker
 * 容差单位为"度"（保持本模块历史接口）；内部适配为 line-resample 的"米"实现
 * （line-resample 先做局部等距投影再比较垂直距离，比直接对经纬度算欧氏距离更准确）。 */
export function dpSimplify(pts: Pt[], tol: number): Pt[] {
  return _dpSimplify(pts, tol * DEG_TO_M)
}

export interface AnalysisResult {
  area: number
  perim: number
  centroid: Pt
  bbox: BBox
  simpCount: number
  vertexCount: number
}
