/* ============================================================
 * Visvalingam-Whyatt 简化 (VWS) · 核心算法
 * 提取自 doSometing/visvalingam-simplify/index.html
 * ============================================================ */

export type Position = [number, number]
export type VwsMode = 'area' | 'percent'
export type GeoJson = Record<string, unknown>

export const R = 6371008.8
const DEG = Math.PI / 180

export function calcArea(a: Position, b: Position, c: Position): number {
  return Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2
}

function projectLocal(coords: Position[]): Position[] {
  const n = coords.length
  let lat0 = 0
  for (const c of coords) lat0 += c[1]
  lat0 = (lat0 / n) * DEG
  const kx = Math.cos(lat0) * R * DEG
  const ky = R * DEG
  return coords.map((c) => [c[0] * kx, c[1] * ky] as Position)
}

export function vwsSimplify(coords: Position[], threshold: number, mode: VwsMode, keepPercent: number): Position[] {
  const n = coords.length
  if (n < 3) return coords.map((c) => [c[0], c[1]])

  const proj = projectLocal(coords)
  const prev = new Array<number>(n)
  const next = new Array<number>(n)
  const alive = new Array<boolean>(n)
  const area = new Array<number>(n)
  let aliveCount = n

  for (let i = 0; i < n; i++) {
    prev[i] = i - 1
    next[i] = i + 1
    alive[i] = true
    area[i] = Infinity
  }
  prev[0] = -1
  next[n - 1] = -1
  area[0] = Infinity
  area[n - 1] = Infinity

  function calcAreaIdx(idx: number): number {
    const pi = prev[idx]!
    const ni = next[idx]!
    if (pi < 0 || ni < 0) return Infinity
    return calcArea(proj[pi]!, proj[idx]!, proj[ni]!)
  }

  for (let k = 1; k < n - 1; k++) area[k] = calcAreaIdx(k)

  let targetCount = 0
  if (mode === 'percent') {
    targetCount = Math.max(2, Math.ceil((keepPercent / 100) * n))
  }

  while (aliveCount > 2) {
    let minArea = Infinity
    let minIdx = -1
    for (let m = 0; m < n; m++) {
      if (alive[m]! && area[m]! < minArea) {
        minArea = area[m]!
        minIdx = m
      }
    }
    if (minIdx < 0) break
    if (mode === 'area' && minArea >= threshold) break
    if (mode === 'percent' && aliveCount <= targetCount) break

    alive[minIdx] = false
    aliveCount--
    const pi2 = prev[minIdx]!
    const ni2 = next[minIdx]!
    if (pi2 >= 0) next[pi2] = ni2
    if (ni2 >= 0) prev[ni2] = pi2
    if (pi2 >= 0 && alive[pi2]!) area[pi2] = calcAreaIdx(pi2)
    if (ni2 >= 0 && alive[ni2]!) area[ni2] = calcAreaIdx(ni2)
  }

  const result: Position[] = []
  for (let r = 0; r < n; r++) {
    if (alive[r]!) result.push([coords[r]![0], coords[r]![1]])
  }
  return result
}

export interface VwsResult {
  geometry: unknown
  origPoints: number
  outPoints: number
}

export function parseGeometry(input: string | GeoJson, threshold: number, mode: VwsMode, keepPercent: number): VwsResult {
  let obj: GeoJson
  if (typeof input === 'string') obj = JSON.parse(input) as GeoJson
  else obj = input
  if (!obj || typeof obj !== 'object') throw new Error('输入不是有效 JSON 对象')

  let origPoints = 0
  let outPoints = 0

  function simplifyRing(ring: Position[]): Position[] {
    let opened = ring
    let closed = false
    if (ring.length >= 2) {
      const a = ring[0]!
      const b = ring[ring.length - 1]!
      if (a[0] === b[0] && a[1] === b[1]) {
        opened = ring.slice(0, ring.length - 1)
        closed = true
      }
    }
    origPoints += opened.length
    const simplified = vwsSimplify(opened, threshold, mode, keepPercent)
    outPoints += simplified.length
    if (closed && simplified.length >= 2) {
      simplified.push([simplified[0]![0], simplified[0]![1]])
    }
    return simplified
  }

  function simplifyLine(coords: Position[]): Position[] {
    origPoints += coords.length
    const simplified = vwsSimplify(coords, threshold, mode, keepPercent)
    outPoints += simplified.length
    return simplified
  }

  function processGeom(geom: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!geom || !geom.type) return geom
    const t = geom.type as string
    if (t === 'LineString') {
      return { type: 'LineString', coordinates: simplifyLine(geom.coordinates as Position[]) }
    }
    if (t === 'MultiLineString') {
      const lines = (geom.coordinates as Position[][]).map(simplifyLine)
      return { type: 'MultiLineString', coordinates: lines }
    }
    if (t === 'Polygon') {
      const rings = (geom.coordinates as Position[][]).map(simplifyRing)
      return { type: 'Polygon', coordinates: rings }
    }
    if (t === 'MultiPolygon') {
      const polys = (geom.coordinates as Position[][][]).map((poly) => poly.map(simplifyRing))
      return { type: 'MultiPolygon', coordinates: polys }
    }
    return geom
  }

  function processFeature(feat: Record<string, unknown>): Record<string, unknown> {
    if (!feat || feat.type !== 'Feature') return feat
    feat.geometry = processGeom(feat.geometry as Record<string, unknown> | null)
    return feat
  }

  let result: unknown
  if (obj.type === 'FeatureCollection') {
    const fs = (obj.features as Record<string, unknown>[]) || []
    result = {
      type: 'FeatureCollection',
      features: fs.map((f) => processFeature(JSON.parse(JSON.stringify(f)) as Record<string, unknown>)),
    }
  } else if (obj.type === 'Feature') {
    result = processFeature(JSON.parse(JSON.stringify(obj)) as Record<string, unknown>)
  } else {
    result = processGeom(JSON.parse(JSON.stringify(obj)) as Record<string, unknown>)
  }

  return { geometry: result, origPoints, outPoints }
}
