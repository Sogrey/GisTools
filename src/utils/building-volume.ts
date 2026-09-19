/* ============================================================
 * 建筑高度/体积估算器 · 核心逻辑
 * 底面 GeoJSON × 层数层高 → 底面积 / 体积 / 表面积（球面算法）
 * 提取自 doSometing/building-volume/index.html
 * ============================================================ */

import { haversine as haversineM, polygonPerimeter as polygonPerimeterM, sphereArea } from './geo-math'

type Pt = [number, number]

export function haversine(a: Pt, b: Pt): number {
  return haversineM(a[0], a[1], b[0], b[1])
}

export function ringArea(ring: Pt[]): number {
  const pts = ring.slice()
  if (pts.length > 1) {
    const f = pts[0]!, l = pts[pts.length - 1]!
    if (f[0] === l[0] && f[1] === l[1]) pts.pop()
  }
  if (pts.length < 3) return 0
  return sphereArea(pts)
}

export function ringPerimeter(ring: Pt[]): number {
  const pts = ring.slice()
  if (pts.length > 1) {
    const f = pts[0]!, l = pts[pts.length - 1]!
    if (f[0] === l[0] && f[1] === l[1]) pts.pop()
  }
  if (pts.length < 2) return 0
  return polygonPerimeterM(pts)
}

function validRing(ring: unknown): ring is Pt[] {
  if (!Array.isArray(ring) || ring.length < 3) return false
  for (const p of ring) {
    if (!Array.isArray(p) || p.length < 2) return false
    if (typeof p[0] !== 'number' || typeof p[1] !== 'number' || !isFinite(p[0]) || !isFinite(p[1])) return false
  }
  return true
}

export interface ExtractResult { rings: Pt[][]; note: string }

export function extractRings(input: unknown): ExtractResult {
  let note = ''
  if (input == null) throw new Error('输入为空')
  if (typeof input === 'string') input = JSON.parse(input)
  let obj = input as Record<string, unknown>
  if (obj.type === 'FeatureCollection') {
    const features = obj.features as Record<string, unknown>[]
    let found = null
    let idx = 0
    for (let i = 0; i < features.length; i++) {
      const g = features[i]?.geometry as Record<string, unknown> | undefined
      if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon')) { found = g; idx = i; break }
    }
    if (!found) throw new Error('FeatureCollection 中未找到 Polygon / MultiPolygon 要素')
    note = `使用 FeatureCollection 第 ${idx + 1} 个面要素`
    obj = found
  }
  if (obj.type === 'Feature') {
    if (!obj.geometry) throw new Error('Feature 缺少 geometry')
    obj = obj.geometry as Record<string, unknown>
  }
  let rings: Pt[][]
  if (obj.type === 'Polygon') {
    rings = obj.coordinates as Pt[][]
  } else if (obj.type === 'MultiPolygon') {
    const coords = obj.coordinates as Pt[][][]
    if (!coords || !coords.length) throw new Error('MultiPolygon 无坐标数据')
    rings = coords[0]!
    note = '使用 MultiPolygon 第 1 个多边形'
  } else if (Array.isArray(obj)) {
    if ((obj as unknown[]).length && Array.isArray((obj as unknown[])[0]) && Array.isArray(((obj as unknown[])[0] as unknown[])[0]) && Array.isArray((((obj as unknown[])[0] as unknown[])[0] as unknown[])[0])) {
      rings = (obj as Pt[][][])[0]!
      note = '识别为 MultiPolygon 形式坐标，取第 1 个多边形'
    } else {
      rings = obj as Pt[][]
      note = '识别为坐标环数组'
    }
  } else {
    throw new Error('无法识别的输入类型，请提供 GeoJSON Polygon / Feature / FeatureCollection')
  }
  if (!rings || !rings.length) throw new Error('多边形缺少坐标环')
  for (let r = 0; r < rings.length; r++) {
    if (!validRing(rings[r])) throw new Error(`第 ${r + 1} 个环无效：至少需要 3 个 [经度, 纬度] 顶点且均为数值`)
  }
  return { rings, note }
}

export function polygonArea(polygon: unknown): number {
  const ex = extractRings(polygon)
  let area = Math.abs(ringArea(ex.rings[0]!))
  for (let i = 1; i < ex.rings.length; i++) area -= Math.abs(ringArea(ex.rings[i]!))
  return Math.max(0, area)
}

export function buildingVolume(baseArea: number, totalHeight: number, roofType: string, roofHeight: number): number {
  if (!isFinite(baseArea) || baseArea <= 0) return 0
  if (!isFinite(totalHeight) || totalHeight <= 0) return 0
  let v = baseArea * totalHeight
  if (roofType === 'cone' && isFinite(roofHeight) && roofHeight > 0) v += baseArea * roofHeight / 3
  return v
}

export interface SurfaceResult {
  perimeter: number
  wallArea: number
  roofArea: number
  totalArea: number
  holesArea: number
  outerArea: number
}

export function calcSurface(polygon: unknown, height: number, roofType: string, roofHeight: number): SurfaceResult {
  const ex = extractRings(polygon)
  const outerArea = Math.abs(ringArea(ex.rings[0]!))
  let holesArea = 0
  for (let i = 1; i < ex.rings.length; i++) holesArea += Math.abs(ringArea(ex.rings[i]!))
  const baseArea = Math.max(0, outerArea - holesArea)
  let perimeter = ringPerimeter(ex.rings[0]!)
  for (let i = 1; i < ex.rings.length; i++) perimeter += ringPerimeter(ex.rings[i]!)
  const wallArea = perimeter * (isFinite(height) ? Math.max(0, height) : 0)
  let roofArea = baseArea
  if (roofType === 'cone' && isFinite(roofHeight) && roofHeight > 0 && baseArea > 0) {
    const r = Math.sqrt(baseArea / Math.PI)
    roofArea = Math.PI * r * Math.sqrt(r * r + roofHeight * roofHeight)
  }
  return { perimeter, wallArea, roofArea, totalArea: wallArea + roofArea, holesArea, outerArea }
}

export const SAMPLE_BUILDING = JSON.stringify({
  type: 'Polygon',
  coordinates: [[
    [116.3000, 39.9000],
    [116.3013, 39.9000],
    [116.3013, 39.9022],
    [116.3000, 39.9022],
    [116.3000, 39.9000]
  ]]
}, null, 1)
