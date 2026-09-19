/* ============================================================
 * 拓扑检查 · 核心算法
 * 提取自 doSometing/topology-check/index.html
 * ============================================================ */

export type Position = [number, number]
export type Ring = Position[]

const EPS = 1e-12

function cross(a: Position, b: Position, c: Position): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
}

export interface SegIntersectResult {
  hit: boolean
  point: Position | null
}

export function segmentIntersect(p1: Position, p2: Position, p3: Position, p4: Position): SegIntersectResult {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  if (
    ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) &&
    ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS))
  ) {
    const t = d1 / (d1 - d2)
    return { hit: true, point: [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] }
  }
  return { hit: false, point: null }
}

export function shoelace(ring: Ring): number {
  let s = 0
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    s += ring[i]![0] * ring[j]![1] - ring[j]![0] * ring[i]![1]
  }
  return s / 2
}

function openRing(ring: Ring): Ring {
  if (ring.length < 2) return ring.slice()
  const a = ring[0]!
  const b = ring[ring.length - 1]!
  if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) {
    return ring.slice(0, ring.length - 1)
  }
  return ring.slice()
}

function ringBbox(ring: Ring): [number, number, number, number] {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return [minX, minY, maxX, maxY]
}

function bboxIntersect(a: [number, number, number, number], b: [number, number, number, number]): boolean {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1])
}

export function pointInRing(pt: Position, ring: Ring): boolean {
  const n = ring.length
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]![0]
    const yi = ring[i]![1]
    const xj = ring[j]![0]
    const yj = ring[j]![1]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

function pointSegDist(p: Position, a: Position, b: Position): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 < EPS) return Math.hypot(p[0] - a[0], p[1] - a[1])
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

function pointRingDist(p: Position, ring: Ring): number {
  let min = Infinity
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const d = pointSegDist(p, ring[i]!, ring[j]!)
    if (d < min) min = d
  }
  return min
}

export interface SelfIntersectIssue {
  edges: [number, number]
  point: Position
}

export function checkSelfIntersect(ring: Ring): SelfIntersectIssue[] {
  const pts = openRing(ring)
  const n = pts.length
  const issues: SelfIntersectIssue[] = []
  if (n < 4) return issues
  for (let i = 0; i < n; i++) {
    const a1 = pts[i]!
    const a2 = pts[(i + 1) % n]!
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue
      const b1 = pts[j]!
      const b2 = pts[(j + 1) % n]!
      const r = segmentIntersect(a1, a2, b1, b2)
      if (r.hit && r.point) issues.push({ edges: [i, j], point: r.point })
    }
  }
  return issues
}

export interface RingOrientIssue {
  ring: number
  desc: string
  area: number
}

export function checkRingOrientation(polygonCoords: Ring[]): RingOrientIssue[] {
  const issues: RingOrientIssue[] = []
  for (let i = 0; i < polygonCoords.length; i++) {
    const ring = polygonCoords[i]!
    const area = shoelace(ring)
    if (i === 0) {
      if (area < -EPS) {
        issues.push({ ring: 0, desc: '外环为顺时针(CW)，按 RFC 7946 应为逆时针(CCW)', area })
      }
    } else {
      if (area > EPS) {
        issues.push({ ring: i, desc: '内环 #' + i + ' 为逆时针(CCW)，按 RFC 7946 应为顺时针(CW)', area })
      }
    }
  }
  return issues
}

export function checkOverlap(outerA: Ring, outerB: Ring, tolerance: number): { hit: boolean; point: Position | null } {
  const bbA = ringBbox(outerA)
  const bbB = ringBbox(outerB)
  if (!bboxIntersect(bbA, bbB)) return { hit: false, point: null }

  const minX = Math.max(bbA[0], bbB[0])
  const minY = Math.max(bbA[1], bbB[1])
  const maxX = Math.min(bbA[2], bbB[2])
  const maxY = Math.min(bbA[3], bbB[3])
  if (minX > maxX || minY > maxY) return { hit: false, point: null }

  const w = maxX - minX
  const h = maxY - minY
  let gridSize = Math.max(Math.ceil(Math.sqrt((w * h) / (tolerance * tolerance))), 6)
  if (gridSize > 200) gridSize = 200
  const sx = w / gridSize
  const sy = h / gridSize
  if (sx <= 0 || sy <= 0) return { hit: false, point: null }

  const ra = openRing(outerA)
  const rb = openRing(outerB)
  for (let gy = 0; gy <= gridSize; gy++) {
    for (let gx = 0; gx <= gridSize; gx++) {
      const px = minX + gx * sx
      const py = minY + gy * sy
      if (pointInRing([px, py], ra) && pointInRing([px, py], rb)) {
        return { hit: true, point: [px, py] }
      }
    }
  }
  return { hit: false, point: null }
}

export interface GapIssue {
  featA: number
  featB: number
  point: Position
  dist: number
  side: string
}

export function checkGap(outerA: Ring, outerB: Ring, tolerance: number, idxA: number, idxB: number): GapIssue[] {
  const issues: GapIssue[] = []
  const ra = openRing(outerA)
  const rb = openRing(outerB)
  const bbA = ringBbox(outerA)
  const bbB = ringBbox(outerB)
  const ext = tolerance * 5
  if (bbA[2] + ext < bbB[0] || bbB[2] + ext < bbA[0] || bbA[3] + ext < bbB[1] || bbB[3] + ext < bbA[1]) return issues

  const na = ra.length
  for (let i = 0; i < na; i++) {
    const j = (i + 1) % na
    const mx = (ra[i]![0] + ra[j]![0]) / 2
    const my = (ra[i]![1] + ra[j]![1]) / 2
    const d = pointRingDist([mx, my], rb)
    if (d > EPS && d < tolerance && !pointInRing([mx, my], rb)) {
      issues.push({ featA: idxA, featB: idxB, point: [mx, my], dist: d, side: 'A' })
    }
  }
  const nb = rb.length
  for (let k = 0; k < nb; k++) {
    const l = (k + 1) % nb
    const mx2 = (rb[k]![0] + rb[l]![0]) / 2
    const my2 = (rb[k]![1] + rb[l]![1]) / 2
    const d2 = pointRingDist([mx2, my2], ra)
    if (d2 > EPS && d2 < tolerance && !pointInRing([mx2, my2], ra)) {
      issues.push({ featA: idxB, featB: idxA, point: [mx2, my2], dist: d2, side: 'B' })
    }
  }
  return issues
}

interface PolyInfo {
  featIdx: number
  outer: Ring
  polygon: Ring[]
}

function extractPolygons(fc: Record<string, unknown>): PolyInfo[] {
  const polys: PolyInfo[] = []
  let feats: Record<string, unknown>[] = []
  if (fc.type === 'FeatureCollection') feats = (fc.features as Record<string, unknown>[]) || []
  else if (fc.type === 'Feature') feats = [fc]
  else if (fc.type === 'Polygon' || fc.type === 'MultiPolygon') {
    feats = [{ type: 'Feature', properties: {}, geometry: fc }]
  }

  for (let i = 0; i < feats.length; i++) {
    const g = feats[i]!.geometry as Record<string, unknown> | undefined
    if (!g) continue
    if (g.type === 'Polygon') {
      const coords = g.coordinates as Ring[]
      polys.push({ featIdx: i, outer: coords[0]!, polygon: coords })
    } else if (g.type === 'MultiPolygon') {
      const parts = (g.coordinates as Ring[][]) || []
      for (const part of parts) {
        if (part && part.length > 0) polys.push({ featIdx: i, outer: part[0]!, polygon: part })
      }
    }
  }
  return polys
}

export type IssueType = 'self' | 'gap' | 'overlap' | 'orient'

export interface TopoIssue {
  type: IssueType
  tag: string
  feat: number
  desc: string
  coord: Position | null
}

export interface CheckResult {
  issues: TopoIssue[]
  counts: { self: number; gap: number; overlap: number; orient: number }
  total: number
}

export function runCheck(fc: Record<string, unknown>, tolerance: number): CheckResult {
  const polys = extractPolygons(fc)
  const issues: TopoIssue[] = []
  const counts = { self: 0, gap: 0, overlap: 0, orient: 0 }

  for (const poly of polys) {
    const si = checkSelfIntersect(poly.outer)
    for (const s of si) {
      issues.push({
        type: 'self',
        tag: '自相交',
        feat: poly.featIdx,
        desc: '外环边 ' + s.edges[0] + ' 与边 ' + s.edges[1] + ' 相交',
        coord: s.point,
      })
      counts.self++
    }
    const ori = checkRingOrientation(poly.polygon)
    for (const o of ori) {
      issues.push({
        type: 'orient',
        tag: '环方向',
        feat: poly.featIdx,
        desc: o.desc + ' (面积=' + o.area.toFixed(8) + '°²)',
        coord: null,
      })
      counts.orient++
    }
  }

  for (let a = 0; a < polys.length; a++) {
    for (let b = a + 1; b < polys.length; b++) {
      const ov = checkOverlap(polys[a]!.outer, polys[b]!.outer, tolerance)
      if (ov.hit) {
        issues.push({
          type: 'overlap',
          tag: '重叠',
          feat: polys[a]!.featIdx,
          desc: '与要素 #' + polys[b]!.featIdx + ' 区域重叠（采样点命中）',
          coord: ov.point,
        })
        counts.overlap++
      }
      const gaps = checkGap(polys[a]!.outer, polys[b]!.outer, tolerance, a, b)
      for (let gi = 0; gi < Math.min(gaps.length, 3); gi++) {
        issues.push({
          type: 'gap',
          tag: '缝隙',
          feat: gaps[gi]!.featA,
          desc:
            '与要素 #' +
            gaps[gi]!.featB +
            ' 之间存在缝隙（间距 ' +
            gaps[gi]!.dist.toFixed(7) +
            '° < 容差 ' +
            tolerance +
            '°）',
          coord: gaps[gi]!.point,
        })
        counts.gap++
      }
    }
  }

  return { issues, counts, total: polys.length }
}

export function fmtCoord(p: Position | null): string {
  if (!p) return '—'
  return '[' + (+p[0]).toFixed(6) + ', ' + (+p[1]).toFixed(6) + ']'
}
