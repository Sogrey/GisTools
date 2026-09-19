/* ============================================================
 * 最近邻搜索器 · 核心算法
 * KNN + 方位角 + Mutual NN — Haversine 球面距离
 * 提取自 doSometing/nearest-neighbor/index.html
 * ============================================================ */

import { haversine as _haversine } from './geo-math'

const DEG = Math.PI / 180
const RAD = 180 / Math.PI

type Pt = [number, number]

function toRad(d: number): number {
  return d * DEG
}
function toDeg(r: number): number {
  return r * RAD
}

export function haversine(lon1: number, lat1: number, lon2: number, lat2: number): number {
  return _haversine(lon1, lat1, lon2, lat2) / 1000
}

export function bearing(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const p1 = toRad(lat1)
  const p2 = toRad(lat2)
  const dl = toRad(lon2 - lon1)
  const y = Math.sin(dl) * Math.cos(p2)
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
  const th = Math.atan2(y, x)
  return (toDeg(th) + 360) % 360
}

export interface ParsedPoint {
  coord: Pt
  props: Record<string, unknown>
}

export function parsePoints(text: string): ParsedPoint[] {
  text = (text || '').trim()
  if (!text) throw new Error('输入为空')
  let o: unknown
  try {
    o = JSON.parse(text)
  } catch (e) {
    throw new Error('JSON 解析失败: ' + (e as Error).message)
  }
  const pts: ParsedPoint[] = []
  function collectGeo(g: unknown, props: Record<string, unknown>): void {
    if (!g || typeof g !== 'object') return
    const obj = g as Record<string, unknown>
    const c = obj.coordinates as number[]
    switch (obj.type) {
      case 'Point':
        if (c && c.length >= 2) pts.push({ coord: [c[0]!, c[1]!], props: props || {} })
        break
      case 'MultiPoint':
        ((c as unknown as number[][]) || []).forEach((p: number[]) => {
          if (p && p.length >= 2) pts.push({ coord: [p[0]!, p[1]!], props: props || {} })
        })
        break
      case 'GeometryCollection':
        (obj.geometries as unknown[] || []).forEach((gg) => collectGeo(gg, props))
        break
      default:
        break
    }
  }
  function collect(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return
    const o2 = obj as Record<string, unknown>
    if (o2.type === 'FeatureCollection') {
      (o2.features as unknown[] || []).forEach(collect)
      return
    }
    if (o2.type === 'Feature') {
      collectGeo(o2.geometry, (o2.properties || {}) as Record<string, unknown>)
      return
    }
    collectGeo(obj, {})
  }
  collect(o)
  if (!pts.length) throw new Error('未识别到 Point 几何')
  return pts
}

export interface KnnResult {
  idx: number
  coord: Pt
  distance_km: number
  bearing_deg: number
  props: Record<string, unknown>
  mutual?: boolean
}

export function knnOne(target: ParsedPoint, searches: ParsedPoint[], k: number): KnnResult[] {
  const dists: { idx: number; coord: Pt; props: Record<string, unknown>; dist: number }[] = []
  for (let j = 0; j < searches.length; j++) {
    const s = searches[j]!
    const d = haversine(target.coord[0], target.coord[1], s.coord[0], s.coord[1])
    dists.push({ idx: j, coord: s.coord, props: s.props, dist: d })
  }
  dists.sort((a, b) => a.dist - b.dist)
  return dists.slice(0, k).map((r) => ({
    idx: r.idx,
    coord: r.coord,
    distance_km: r.dist,
    bearing_deg: bearing(target.coord[0], target.coord[1], r.coord[0], r.coord[1]),
    props: r.props,
  }))
}

export interface KnnAllResult {
  targetIdx: number
  target: ParsedPoint
  knn: KnnResult[]
}

export function knn(targets: ParsedPoint[], searches: ParsedPoint[], k: number): KnnAllResult[] {
  let kk = k
  if (kk > searches.length) kk = searches.length
  if (kk < 1) kk = 1
  const results: KnnAllResult[] = []
  for (let i = 0; i < targets.length; i++) {
    const nn = knnOne(targets[i]!, searches, kk)
    results.push({ targetIdx: i, target: targets[i]!, knn: nn })
  }
  return results
}

export function runMutualKnn(
  targets: ParsedPoint[],
  searches: ParsedPoint[],
  k: number
): KnnAllResult[] {
  let kk = k
  if (kk > searches.length) kk = searches.length
  if (kk < 1) kk = 1
  const fwd = knn(targets, searches, kk)
  const rev = knn(searches, targets, 1)
  fwd.forEach((r, i) => {
    if (r.knn[0]) {
      const j = r.knn[0].idx
      if (rev[j] && rev[j].knn[0] && rev[j].knn[0].idx === i) {
        r.knn[0].mutual = true
      }
    }
  })
  return fwd
}

export interface KnnOutput {
  fc: { type: string; features: unknown[] }
  results: KnnAllResult[]
  mutualCount: number
  avgDist: number
  minDist: number
  maxDist: number
  targetCount: number
  searchCount: number
}
