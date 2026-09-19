/* ============================================================
 * Voronoi / Delaunay 三角网生成器 · 核心算法
 * Bowyer-Watson 三角剖分 / 外心 / Voronoi 半平面交裁
 * 提取自 doSometing/voronoi-triangulation/index.html
 * ============================================================ */

type Pt = [number, number]

export function parsePoints(text: string): Pt[] {
  text = String(text).trim()
  if (!text) return []
  const first = text.charAt(0)
  const pts: Pt[] = []
  if (first === '{' || first === '[') {
    const o = JSON.parse(text)
    function walk(g: unknown): void {
      if (!g || typeof g !== 'object') return
      const obj = g as Record<string, unknown>
      if (obj.type === 'FeatureCollection') {
        (obj.features as unknown[] || []).forEach(walk)
      } else if (obj.type === 'Feature') {
        walk(obj.geometry)
      } else if (obj.type === 'GeometryCollection') {
        (obj.geometries as unknown[] || []).forEach(walk)
      } else if (obj.type === 'Point') {
        const c = obj.coordinates as number[]
        if (c) pts.push([c[0]!, c[1]!])
      } else if (obj.type === 'MultiPoint') {
        (obj.coordinates as number[][] || []).forEach((c) => pts.push([c[0]!, c[1]!]))
      }
    }
    walk(o)
  } else {
    const lines = text.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim()
      if (!line || line.charAt(0) === '#') continue
      const parts = line.split(/[\s,;\t]+/).filter(Boolean)
      if (parts.length < 2) continue
      const lng = parseFloat(parts[0]!)
      const lat = parseFloat(parts[1]!)
      if (!isFinite(lng) || !isFinite(lat)) continue
      pts.push([lng, lat])
    }
  }
  return pts
}

export function circumcenter(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): Pt {
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-20) {
    return [(ax + bx + cx) / 3, (ay + by + cy) / 3]
  }
  const A = ax * ax + ay * ay
  const B = bx * bx + by * by
  const C = cx * cx + cy * cy
  const ux = (A * (by - cy) + B * (cy - ay) + C * (ay - by)) / d
  const uy = (A * (cx - bx) + B * (ax - cx) + C * (bx - ax)) / d
  return [ux, uy]
}

function inCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number, eps: number): boolean {
  ax -= dx; ay -= dy; bx -= dx; by -= dy; cx -= dx; cy -= dy
  const A = ax * ax + ay * ay
  const B = bx * bx + by * by
  const C = cx * cx + cy * cy
  const det = ax * (by * C - cy * B) - ay * (bx * C - cx * B) + A * (bx * cy - by * cx)
  const orient = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
  if (orient > 0) return det > eps
  if (orient < 0) return det < -eps
  return false
}

function pushEdge(edgeMap: Record<string, { a: number; b: number; count: number }>, u: number, v: number): void {
  const a = u < v ? u : v
  const b = u < v ? v : u
  const key = a + '_' + b
  if (edgeMap[key]) edgeMap[key].count++
  else edgeMap[key] = { a, b, count: 1 }
}

export function delaunay(points: Pt[]): number[][] {
  const n = points.length
  if (n < 3) return []

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const x = points[i]![0], y = points[i]![1]
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  let dx = maxX - minX, dy = maxY - minY
  if (!(dx > 0)) dx = 1
  if (!(dy > 0)) dy = 1
  const dmax = Math.max(dx, dy)
  const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2
  const eps = 1e-9 * dmax * dmax * dmax * dmax

  const pts: Pt[] = points.concat([
    [midX - 20 * dmax, midY - dmax],
    [midX, midY + 20 * dmax],
    [midX + 20 * dmax, midY - dmax],
  ])

  let triangles: number[][] = [[n, n + 1, n + 2]]

  for (let p = 0; p < n; p++) {
    const px = pts[p]![0], py = pts[p]![1]
    const isBad: boolean[] = new Array(triangles.length).fill(false)
    for (let t = 0; t < triangles.length; t++) {
      const tr = triangles[t]!
      if (inCircle(pts[tr[0]!]![0], pts[tr[0]!]![1], pts[tr[1]!]![0], pts[tr[1]!]![1], pts[tr[2]!]![0], pts[tr[2]!]![1], px, py, eps))
        isBad[t] = true
    }
    const edgeMap: Record<string, { a: number; b: number; count: number }> = {}
    for (let t2 = 0; t2 < triangles.length; t2++) {
      if (!isBad[t2]) continue
      const tr2 = triangles[t2]!
      pushEdge(edgeMap, tr2[0]!, tr2[1]!)
      pushEdge(edgeMap, tr2[1]!, tr2[2]!)
      pushEdge(edgeMap, tr2[2]!, tr2[0]!)
    }
    const boundary: [number, number][] = []
    for (const k in edgeMap) {
      if (edgeMap[k]!.count === 1) boundary.push([edgeMap[k]!.a, edgeMap[k]!.b])
    }
    const newTris: number[][] = []
    for (let t3 = 0; t3 < triangles.length; t3++) {
      if (!isBad[t3]) newTris.push(triangles[t3]!)
    }
    for (let bi = 0; bi < boundary.length; bi++) {
      const e = boundary[bi]!
      newTris.push([e[0], e[1], p])
    }
    triangles = newTris
  }

  const result: number[][] = []
  for (let r = 0; r < triangles.length; r++) {
    const tr3 = triangles[r]!
    if (tr3[0]! < n && tr3[1]! < n && tr3[2]! < n) result.push(tr3)
  }
  return result
}

export function buildNeighbors(points: Pt[], triangles: number[][]): number[][] {
  const n = points.length
  const adj: Record<number, number>[] = []
  for (let i = 0; i < n; i++) adj.push({})
  for (let t = 0; t < triangles.length; t++) {
    const tr = triangles[t]!
    const a = tr[0]!, b = tr[1]!, c = tr[2]!
    adj[a]![b] = 1; adj[b]![a] = 1
    adj[b]![c] = 1; adj[c]![b] = 1
    adj[c]![a] = 1; adj[a]![c] = 1
  }
  const neighbors: number[][] = []
  for (let j = 0; j < n; j++) neighbors.push(Object.keys(adj[j]!).map(Number))
  return neighbors
}

function clipHalfPlane(poly: Pt[], px: number, py: number, qx: number, qy: number): Pt[] {
  const mx = (px + qx) / 2, my = (py + qy) / 2
  const nx = qx - px, ny = qy - py
  const result: Pt[] = []
  const len = poly.length
  if (len === 0) return result
  for (let i = 0; i < len; i++) {
    const a = poly[i]!, b = poly[(i + 1) % len]!
    const da = (a[0] - mx) * nx + (a[1] - my) * ny
    const db = (b[0] - mx) * nx + (b[1] - my) * ny
    const aIn = da <= 1e-12
    const bIn = db <= 1e-12
    if (aIn) result.push(a)
    if (aIn !== bIn) {
      const t = da / (da - db)
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])])
    }
  }
  return result
}

export function voronoiCells(points: Pt[], triangles: number[][]): Pt[][] {
  const n = points.length
  if (n === 0) return []

  const neighbors = buildNeighbors(points, triangles)

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const x = points[i]![0], y = points[i]![1]
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  let dx = maxX - minX, dy = maxY - minY
  if (!(dx > 0)) dx = 1
  if (!(dy > 0)) dy = 1
  const dmax = Math.max(dx, dy)
  const margin = Math.max(0.2 * dmax, 1e-6)
  const bbox: Pt[] = [
    [minX - margin, minY - margin],
    [maxX + margin, minY - margin],
    [maxX + margin, maxY + margin],
    [minX - margin, maxY + margin],
  ]

  const cells: Pt[][] = []
  for (let i = 0; i < n; i++) {
    const p = points[i]!
    let cell: Pt[] = bbox.map((c) => [c[0], c[1]] as Pt)
    const nb = neighbors[i]!
    for (let j = 0; j < nb.length; j++) {
      const q = points[nb[j]!]!
      cell = clipHalfPlane(cell, p[0], p[1], q[0], q[1])
      if (cell.length === 0) break
    }
    cells.push(cell)
  }
  return cells
}

export type VoronoiMode = 'both' | 'delaunay' | 'voronoi'

function round7(p: Pt): Pt {
  return [Math.round(p[0] * 1e7) / 1e7, Math.round(p[1] * 1e7) / 1e7]
}

export interface VoronoiResult {
  geo: { type: string; features: unknown[] }
  pointCount: number
  triangleCount: number
  cellCount: number
}

export function buildGeoJSON(mode: VoronoiMode, points: Pt[], triangles: number[][], cells: Pt[][]): VoronoiResult {
  const feats: unknown[] = []
  if (mode === 'delaunay' || mode === 'both') {
    triangles.forEach((tr, idx) => {
      const ring = [points[tr[0]!]!, points[tr[1]!]!, points[tr[2]!]!, points[tr[0]!]!].map(round7)
      feats.push({
        type: 'Feature',
        properties: { kind: 'delaunay', triangle: idx, vertices: [tr[0], tr[1], tr[2]] },
        geometry: { type: 'Polygon', coordinates: [ring] },
      })
    })
  }
  if (mode === 'voronoi' || mode === 'both') {
    cells.forEach((cell, idx) => {
      if (cell.length < 3) return
      const ring = cell.map(round7)
      const first = ring[0]!, last = ring[ring.length - 1]!
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
      feats.push({
        type: 'Feature',
        properties: { kind: 'voronoi', site: idx, site_coord: round7(points[idx]!) },
        geometry: { type: 'Polygon', coordinates: [ring] },
      })
    })
  }
  const validCells = cells.filter((c) => c.length >= 3).length
  return {
    geo: { type: 'FeatureCollection', features: feats },
    pointCount: points.length,
    triangleCount: triangles.length,
    cellCount: validCells,
  }
}
