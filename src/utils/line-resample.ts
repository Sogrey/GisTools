/* ============================================================
 * 线等距重采样器 · 核心算法
 * 等距加密/抽稀/按数量重采样 + Douglas-Peucker
 * 提取自 doSometing/line-resample/index.html
 * ============================================================ */

import { haversine } from './geo-math'
export { haversine }

const R = 6371008.8
const DEG = Math.PI / 180

type Pt = [number, number]

function toRad(d: number): number {
  return d * DEG
}

function lerpPt(p1: Pt, p2: Pt, t: number): Pt {
  return [p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t]
}

export function arcLengths(coords: Pt[]): number[] {
  const acc = [0]
  for (let i = 1; i < coords.length; i++) {
    acc[i] = acc[i - 1]! + haversine(coords[i - 1]![0], coords[i - 1]![1], coords[i]![0], coords[i]![1])
  }
  return acc
}

export function totalLength(coords: Pt[]): number {
  let d = 0
  for (let i = 1; i < coords.length; i++) {
    d += haversine(coords[i - 1]![0], coords[i - 1]![1], coords[i]![0], coords[i]![1])
  }
  return d
}

function copyAll(coords: Pt[]): Pt[] {
  return coords.map((p) => p.slice() as Pt)
}

export function densify(coords: Pt[], spacing: number): Pt[] {
  if (coords.length < 2) return copyAll(coords)
  if (!(spacing > 0)) return copyAll(coords)
  const result: Pt[] = [coords[0]!.slice() as Pt]
  for (let i = 0; i < coords.length - 1; i++) {
    const p1 = coords[i]!
    const p2 = coords[i + 1]!
    const segLen = haversine(p1[0], p1[1], p2[0], p2[1])
    if (segLen <= spacing || segLen < 1e-9) {
      result.push(p2.slice() as Pt)
      continue
    }
    const n = Math.ceil(segLen / spacing)
    for (let j = 1; j <= n; j++) {
      result.push(lerpPt(p1, p2, j / n))
    }
  }
  return result
}

export function simplifyByInterval(coords: Pt[], spacing: number): Pt[] {
  if (coords.length < 3) return copyAll(coords)
  if (!(spacing > 0)) return copyAll(coords)
  const result: Pt[] = [coords[0]!.slice() as Pt]
  let acc = 0
  for (let i = 1; i < coords.length - 1; i++) {
    acc += haversine(coords[i - 1]![0], coords[i - 1]![1], coords[i]![0], coords[i]![1])
    if (acc >= spacing) {
      result.push(coords[i]!.slice() as Pt)
      acc = 0
    }
  }
  result.push(coords[coords.length - 1]!.slice() as Pt)
  return result
}

function perpDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len2 = dx * dx + dy * dy
  if (len2 === 0) {
    const ddx = p[0] - a[0]
    const ddy = p[1] - a[1]
    return Math.sqrt(ddx * ddx + ddy * ddy)
  }
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const px = a[0] + t * dx
  const py = a[1] + t * dy
  const ex = p[0] - px
  const ey = p[1] - py
  return Math.sqrt(ex * ex + ey * ey)
}

export function dpSimplify(coords: Pt[], tol: number): Pt[] {
  if (coords.length < 3) return copyAll(coords)
  if (!(tol >= 0)) return copyAll(coords)
  const p0 = coords[0]!
  const kx = Math.cos(toRad(p0[1])) * R * DEG
  const ky = R * DEG
  const local = coords.map((p) => [(p[0] - p0[0]) * kx, (p[1] - p0[1]) * ky] as Pt)
  const n = local.length
  const keep: boolean[] = new Array(n).fill(false)
  keep[0] = true
  keep[n - 1] = true
  const stack: [number, number][] = [[0, n - 1]]
  while (stack.length) {
    const seg = stack.pop()!
    const s = seg[0]
    const e = seg[1]
    let maxD = 0
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(local[i]!, local[s]!, local[e]!)
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (maxD > tol && idx > 0) {
      keep[idx] = true
      stack.push([s, idx])
      stack.push([idx, e])
    }
  }
  const result: Pt[] = []
  for (let j = 0; j < n; j++) {
    if (keep[j]) result.push(coords[j]!.slice() as Pt)
  }
  return result
}

export function resampleByCount(coords: Pt[], count: number): Pt[] {
  if (coords.length < 2) return copyAll(coords)
  count = Math.max(2, Math.floor(count))
  const acc = arcLengths(coords)
  const total = acc[acc.length - 1]!
  if (total <= 0) return coords.slice(0, count)
  const result: Pt[] = [coords[0]!.slice() as Pt]
  let seg = 0
  for (let k = 1; k < count - 1; k++) {
    const target = (total * k) / (count - 1)
    while (seg < acc.length - 1 && acc[seg + 1]! < target) seg++
    const segLen = acc[seg + 1]! - acc[seg]!
    const t = segLen > 0 ? (target - acc[seg]!) / segLen : 0
    result.push(lerpPt(coords[seg]!, coords[seg + 1]!, t))
  }
  result.push(coords[coords.length - 1]!.slice() as Pt)
  return result
}

export function parseLines(text: string): Pt[][] {
  const o = JSON.parse(text)
  const lines: Pt[][] = []
  function walk(g: unknown): void {
    if (!g || typeof g !== 'object') return
    const obj = g as Record<string, unknown>
    if (obj.type === 'FeatureCollection') {
      ;(obj.features as unknown[] || []).forEach(walk)
    } else if (obj.type === 'Feature') {
      walk(obj.geometry)
    } else if (obj.type === 'LineString') {
      const c = obj.coordinates as number[][]
      if (c && c.length >= 2) lines.push(c.map((p) => [p[0], p[1]] as Pt))
    } else if (obj.type === 'MultiLineString') {
      ;(obj.coordinates as number[][][] || []).forEach((l) => {
        if (l && l.length >= 2) lines.push(l.map((p) => [p[0], p[1]] as Pt))
      })
    }
  }
  walk(o)
  return lines
}

export type ResampleMode = 'densify' | 'simplify' | 'count'
export type SimplifySubMode = 'interval' | 'dp'
