/* ============================================================
 * 多边形叠加分析 · 核心算法
 * 相交(∩) · 并集(∪) · 差集(−) · 对称差(⊕) — Sutherland-Hodgman
 * 提取自 doSometing/overlay-analysis/index.html
 * ============================================================ */

const EPS = 1e-12
const AREA_EPS = 1e-12
const COLIN_EPS = 1e-13
const EARTH_R = 6378137

type Pt = [number, number]
type HalfPlane = [number, number, number, number, boolean]

function isNum(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

function ptOk(p: unknown): p is Pt {
  return (
    !!p &&
    typeof p === 'object' &&
    Array.isArray(p) &&
    (p as unknown[]).length >= 2 &&
    isNum((p as unknown[])[0]) &&
    isNum((p as unknown[])[1])
  )
}

function shoelace(ring: Pt[]): number {
  let s = 0
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const a = ring[i]!
    const b = ring[(i + 1) % n]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

function dedupeRing(ring: unknown): Pt[] {
  if (!Array.isArray(ring)) throw new Error('环必须是坐标数组')
  const out: Pt[] = []
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]
    if (!ptOk(p)) throw new Error('存在非法坐标点（第 ' + (i + 1) + ' 个）')
    const last = out.length ? out[out.length - 1] : null
    if (last && Math.abs(p[0] - last[0]) <= EPS && Math.abs(p[1] - last[1]) <= EPS) continue
    out.push([p[0], p[1]])
  }
  while (out.length > 1) {
    const a = out[0]!
    const b = out[out.length - 1]!
    if (Math.abs(a[0] - b[0]) <= EPS && Math.abs(a[1] - b[1]) <= EPS) out.pop()
    else break
  }
  return out
}

function ensureCCW(ring: Pt[]): Pt[] {
  return shoelace(ring) < 0 ? ring.slice().reverse() : ring.slice()
}
function ensureCW(ring: Pt[]): Pt[] {
  return shoelace(ring) > 0 ? ring.slice().reverse() : ring.slice()
}

function cleanRing(raw: Pt[]): Pt[] | null {
  const pts = dedupeRing(raw)
  if (pts.length < 3) return null
  const keep: Pt[] = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length]!
    const b = pts[i]!
    const c = pts[(i + 1) % pts.length]!
    const cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
    if (Math.abs(cr) > COLIN_EPS) keep.push(b)
  }
  if (keep.length < 3) return null
  if (Math.abs(shoelace(keep)) < AREA_EPS) return null
  return keep
}

function cross3(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax)
}

function segLineX(S: Pt, E: Pt, ax: number, ay: number, bx: number, by: number): Pt {
  const d1x = E[0] - S[0]
  const d1y = E[1] - S[1]
  const d2x = bx - ax
  const d2y = by - ay
  const den = d1x * d2y - d1y * d2x
  if (Math.abs(den) < 1e-15) return [S[0], S[1]]
  let t = ((ax - S[0]) * d2y - (ay - S[1]) * d2x) / den
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return [S[0] + d1x * t, S[1] + d1y * t]
}

function clipHalfplane(pts: Pt[], pl: HalfPlane): Pt[] {
  const ax = pl[0]
  const ay = pl[1]
  const bx = pl[2]
  const by = pl[3]
  const sign = pl[4] ? 1 : -1
  const out: Pt[] = []
  const n = pts.length
  if (n === 0) return out
  for (let i = 0; i < n; i++) {
    const S = pts[i]!
    const E = pts[(i + 1) % n]!
    const sIn = cross3(ax, ay, bx, by, S[0], S[1]) * sign >= 0
    const eIn = cross3(ax, ay, bx, by, E[0], E[1]) * sign >= 0
    if (eIn) {
      if (!sIn) out.push(segLineX(S, E, ax, ay, bx, by))
      out.push(E)
    } else if (sIn) {
      out.push(segLineX(S, E, ax, ay, bx, by))
    }
  }
  return out
}

function clipChain(pts: Pt[], planes: HalfPlane[]): Pt[] {
  for (let i = 0; i < planes.length; i++) {
    pts = clipHalfplane(pts, planes[i]!)
    if (pts.length < 3) return []
  }
  return pts
}

function ringPlanes(clip: Pt[]): HalfPlane[] {
  const planes: HalfPlane[] = []
  const n = clip.length
  for (let i = 0; i < n; i++) {
    const a = clip[i]!
    const b = clip[(i + 1) % n]!
    planes.push([a[0], a[1], b[0], b[1], true])
  }
  return planes
}

export function clipPolygon(subjectRing: Pt[], clipRing: Pt[]): Pt[] {
  const pts = dedupeRing(subjectRing)
  const clip = ensureCCW(dedupeRing(clipRing))
  if (pts.length < 3 || clip.length < 3) return []
  return clipChain(pts, ringPlanes(clip))
}

function exteriorRegions(clip: Pt[]): HalfPlane[][] {
  const n = clip.length
  const regions: HalfPlane[][] = []
  for (let i = 0; i < n; i++) {
    const v0 = clip[i]!
    const v1 = clip[(i + 1) % n]!
    const vp = clip[(i - 1 + n) % n]!
    const vn = clip[(i + 2) % n]!
    const extPrev: Pt = [v0[0] + (v0[0] - vp[0]), v0[1] + (v0[1] - vp[1])]
    const extNext: Pt = [v1[0] + (vn[0] - v1[0]), v1[1] + (vn[1] - v1[1])]
    regions.push([
      [v0[0], v0[1], v1[0], v1[1], false],
      [v0[0], v0[1], extPrev[0], extPrev[1], true],
      [v1[0], v1[1], extNext[0], extNext[1], true],
    ])
    regions.push([
      [vp[0], vp[1], v0[0], v0[1], false],
      [v0[0], v0[1], v1[0], v1[1], false],
    ])
  }
  return regions
}

function diffRingsByClip(rings: Pt[][], clipRing: Pt[]): Pt[][] {
  const clip = ensureCCW(dedupeRing(clipRing))
  if (clip.length < 3) return rings.slice()
  if (!rings.length) return []
  const regions = exteriorRegions(clip)
  const out: Pt[][] = []
  for (let r = 0; r < rings.length; r++) {
    const pts = dedupeRing(rings[r])
    if (pts.length < 3) continue
    for (let g = 0; g < regions.length; g++) {
      const res = clipChain(pts, regions[g]!)
      if (res.length < 3) continue
      const c = cleanRing(res)
      if (c) out.push(c)
    }
  }
  return out
}

function intersectRings(subjectRing: Pt[], clipRing: Pt[]): Pt[][] {
  const res = clipPolygon(subjectRing, clipRing)
  if (res.length < 3) return []
  const c = cleanRing(res)
  return c ? [c] : []
}

interface Part {
  outer: Pt[]
  holes: Pt[][]
}

function toParts(geom: { type: string; coordinates: unknown }): Part[] {
  if (!geom || typeof geom !== 'object') throw new Error('几何对象非法')
  const t = geom.type
  if (t !== 'Polygon' && t !== 'MultiPolygon') {
    throw new Error('仅支持 Polygon / MultiPolygon，当前为 ' + (t || '未知类型'))
  }
  if (!Array.isArray(geom.coordinates)) throw new Error('coordinates 结构非法')
  const polys = t === 'Polygon' ? [geom.coordinates] : geom.coordinates
  const parts: Part[] = []
  for (let i = 0; i < polys.length; i++) {
    const rings = polys[i] as Pt[][]
    if (!Array.isArray(rings) || rings.length === 0) continue
    const outer = ensureCCW(dedupeRing(rings[0]))
    if (outer.length < 3) {
      throw new Error('第 ' + (i + 1) + ' 个多边形的外环至少需要 3 个互不相同的顶点')
    }
    const holes: Pt[][] = []
    for (let h = 1; h < rings.length; h++) {
      const hr = dedupeRing(rings[h])
      if (hr.length >= 3) holes.push(hr)
    }
    parts.push({ outer, holes })
  }
  if (parts.length === 0) throw new Error('未找到有效多边形')
  return parts
}

function intersectParts(pa: Part[], pb: Part[]): Part[] {
  const out: Part[] = []
  for (let i = 0; i < pa.length; i++) {
    for (let j = 0; j < pb.length; j++) {
      let rings = intersectRings(pa[i]!.outer, pb[j]!.outer)
      for (let h = 0; h < pa[i]!.holes.length; h++) rings = diffRingsByClip(rings, pa[i]!.holes[h]!)
      for (let h2 = 0; h2 < pb[j]!.holes.length; h2++) rings = diffRingsByClip(rings, pb[j]!.holes[h2]!)
      for (let k = 0; k < rings.length; k++) out.push({ outer: rings[k]!, holes: [] })
    }
  }
  return out
}

function differenceParts(pa: Part[], pb: Part[]): Part[] {
  let rings: Pt[][] = []
  for (let i = 0; i < pa.length; i++) {
    let rl = [pa[i]!.outer]
    for (let h = 0; h < pa[i]!.holes.length; h++) rl = diffRingsByClip(rl, pa[i]!.holes[h]!)
    rings = rings.concat(rl)
  }
  for (let j = 0; j < pb.length; j++) {
    if (!rings.length) break
    rings = diffRingsByClip(rings, pb[j]!.outer)
  }
  const parts: Part[] = []
  for (let m = 0; m < rings.length; m++) parts.push({ outer: rings[m]!, holes: [] })
  for (let i2 = 0; i2 < pa.length; i2++) {
    for (let j2 = 0; j2 < pb.length; j2++) {
      for (let h2 = 0; h2 < pb[j2]!.holes.length; h2++) {
        let back = intersectRings(pa[i2]!.outer, pb[j2]!.holes[h2]!)
        for (let h3 = 0; h3 < pa[i2]!.holes.length; h3++) back = diffRingsByClip(back, pa[i2]!.holes[h3]!)
        for (let k = 0; k < back.length; k++) parts.push({ outer: back[k]!, holes: [] })
      }
    }
  }
  return parts
}

function unionParts(pa: Part[], pb: Part[]): Part[] {
  const parts: Part[] = []
  for (let i = 0; i < pa.length; i++) {
    parts.push({ outer: pa[i]!.outer, holes: pa[i]!.holes.slice() })
  }
  return parts.concat(differenceParts(pb, pa))
}

function xorParts(pa: Part[], pb: Part[]): Part[] {
  return differenceParts(pa, pb).concat(differenceParts(pb, pa))
}

function closeRing(r: Pt[]): Pt[] {
  return r.concat([[r[0]![0], r[0]![1]]])
}

function partsToGeometry(parts: Part[]): { type: string; coordinates: unknown } | null {
  const polys: Pt[][][] = []
  for (let i = 0; i < parts.length; i++) {
    const outer = ensureCCW(cleanRing(parts[i]!.outer) || [])
    if (outer.length < 3) continue
    const rings: Pt[][] = [closeRing(outer)]
    for (let h = 0; h < parts[i]!.holes.length; h++) {
      const c = ensureCW(cleanRing(parts[i]!.holes[h]!) || [])
      if (c.length >= 3) rings.push(closeRing(c))
    }
    polys.push(rings)
  }
  if (!polys.length) return null
  if (polys.length === 1 && polys[0]!.length === 1) {
    return { type: 'Polygon', coordinates: polys[0] }
  }
  return { type: 'MultiPolygon', coordinates: polys }
}

function ringAreaSigned(ring: Pt[]): number {
  const pts = dedupeRing(ring)
  const n = pts.length
  if (n < 3) return 0
  let total = 0
  for (let i = 0; i < n; i++) {
    const p1 = pts[(i - 1 + n) % n]!
    const p2 = pts[i]!
    const p3 = pts[(i + 1) % n]!
    const lam1 = (p1[0] * Math.PI) / 180
    const lam3 = (p3[0] * Math.PI) / 180
    const phi2 = (p2[1] * Math.PI) / 180
    total += (lam3 - lam1) * (2 + Math.sin(phi2))
  }
  return (total * EARTH_R * EARTH_R) / 2
}

export function polygonArea(geom: { type: string; coordinates: unknown }): number {
  if (!geom || !geom.type || !Array.isArray(geom.coordinates)) return 0
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : (geom.coordinates as Pt[][][])
  let total = 0
  for (let i = 0; i < polys.length; i++) {
    const rings = polys[i] as Pt[][]
    if (!Array.isArray(rings) || rings.length === 0) continue
    total += Math.abs(ringAreaSigned(rings[0]!))
    for (let h = 1; h < rings.length; h++) total -= Math.abs(ringAreaSigned(rings[h]!))
  }
  return total > 0 ? total : 0
}

export interface GeoGeom {
  type: string
  coordinates: unknown
}

export function parseGeometry(text: string): GeoGeom {
  if (!text || !String(text).trim()) throw new Error('请输入内容')
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(text)
  } catch (e) {
    throw new Error('JSON 解析失败: ' + (e as Error).message)
  }
  if (!obj || typeof obj !== 'object') throw new Error('输入不是 JSON 对象')
  let g: GeoGeom | null = null
  if (obj.type === 'FeatureCollection') {
    const fs = obj.features as Array<{ geometry?: GeoGeom }>
    if (!Array.isArray(fs)) throw new Error('FeatureCollection 缺少 features 数组')
    for (let i = 0; i < fs.length; i++) {
      const gg = fs[i] && fs[i]!.geometry
      if (gg && (gg.type === 'Polygon' || gg.type === 'MultiPolygon')) {
        g = gg
        break
      }
    }
    if (!g) throw new Error('FeatureCollection 中未找到 Polygon / MultiPolygon 要素')
  } else if (obj.type === 'Feature') {
    g = obj.geometry as GeoGeom
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
      throw new Error('Feature 的几何必须是 Polygon / MultiPolygon')
    }
  } else if (obj.type === 'Polygon' || obj.type === 'MultiPolygon') {
    g = obj as unknown as GeoGeom
  } else {
    throw new Error('仅支持 Polygon / MultiPolygon（或包含它们的 Feature / FeatureCollection）')
  }
  return g
}

export function fmtArea(v: number): string {
  if (!isNum(v) || v < 0) return '—'
  if (v >= 1e6) return trim0((v / 1e6).toFixed(4)) + ' km²'
  if (v >= 1) return trim0(v.toFixed(2)) + ' m²'
  return trim0(v.toFixed(6)) + ' m²'
}

function trim0(s: string): string {
  return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s
}

export type OverlayOp = 'intersect' | 'union' | 'difference' | 'xor'

export function overlay(op: OverlayOp, gA: GeoGeom, gB: GeoGeom): GeoGeom | null {
  const pa = toParts(gA)
  const pb = toParts(gB)
  let parts: Part[]
  switch (op) {
    case 'intersect':
      parts = intersectParts(pa, pb)
      break
    case 'union':
      parts = unionParts(pa, pb)
      break
    case 'difference':
      parts = differenceParts(pa, pb)
      break
    case 'xor':
      parts = xorParts(pa, pb)
      break
  }
  return partsToGeometry(parts)
}
