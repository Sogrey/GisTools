/* ============================================================
 * 距离矩阵计算器 · 核心算法
 * N×N Haversine 距离矩阵 → CSV
 * 提取自 doSometing/distance-matrix/index.html
 * ============================================================ */

import { haversine } from './geo-math'

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  return haversine(lng1, lat1, lng2, lat2) / 1000
}

export interface NamedPoint {
  name: string
  lng: number
  lat: number
}

export function parsePoints(text: string): NamedPoint[] {
  text = (text || '').trim()
  if (!text) return []
  const ch = text.charAt(0)
  if (ch === '{' || ch === '[') {
    const gj = JSON.parse(text) as Record<string, unknown>
    let feats: unknown[] = []
    if (Array.isArray(gj.features)) feats = gj.features
    else if (gj.type === 'Feature') feats = [gj]
    else if (gj.type === 'Point') feats = [{ type: 'Feature', geometry: gj, properties: {} }]
    const points: NamedPoint[] = []
    ;(fees as Record<string, unknown>[]) = feats as unknown as Record<string, unknown>[]
    let i = 0
    for (const f of feats as Record<string, unknown>[]) {
      if (f && (f as Record<string, unknown>).geometry) {
        const geom = (f as Record<string, unknown>).geometry as Record<string, unknown>
        if (geom.type === 'Point') {
          const c = geom.coordinates as number[]
          const props = (f.properties || {}) as Record<string, unknown>
          const name = String(props.name || props.NAME || props.title || props.id || 'P' + (i + 1))
          points.push({ name, lng: +c[0]!, lat: +c[1]! })
        }
      }
      i++
    }
    return points
  }
  const lines = text.split(/\r?\n/)
  const points: NamedPoint[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || line.charAt(0) === '#') continue
    let parts = line.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 1) parts = line.split(/[\t\s]+/).filter(Boolean)
    if (parts.length >= 3) {
      const n1 = parseFloat(parts[1]!)
      const n2 = parseFloat(parts[2]!)
      if (!isNaN(n1) && !isNaN(n2)) {
        points.push({ name: parts[0]!, lng: n1, lat: n2 })
        continue
      }
    }
    if (parts.length >= 2) {
      const m0 = parseFloat(parts[0]!)
      const m1 = parseFloat(parts[1]!)
      if (!isNaN(m0) && !isNaN(m1)) {
        points.push({ name: 'P' + (points.length + 1), lng: m0, lat: m1 })
      }
    }
  }
  return points
}

let fees: Record<string, unknown>[] = []

export function distanceMatrix(points: NamedPoint[]): number[][] {
  const n = points.length
  const mat: number[][] = []
  for (let i = 0; i < n; i++) mat.push(new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(points[i]!.lng, points[i]!.lat, points[j]!.lng, points[j]!.lat)
      mat[i]![j] = d
      mat[j]![i] = d
    }
  }
  return mat
}

function csvCell(s: string): string {
  s = String(s)
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

export function matrixToCsv(names: string[], mat: number[][]): string {
  const lines: string[] = []
  lines.push(',' + names.map(csvCell).join(','))
  for (let i = 0; i < names.length; i++) {
    const row = [csvCell(names[i]!)]
    for (let j = 0; j < names.length; j++) row.push(mat[i]![j]!.toFixed(4))
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export interface MatrixStats {
  n: number
  cells: number
  max: number
  maxPair: string[] | null
  min: number
  minPair: string[] | null
  avg: number
}

export function matrixStats(points: NamedPoint[], mat: number[][]): MatrixStats {
  const n = points.length
  let maxD = -1
  let minD = Infinity
  let maxPair: string[] | null = null
  let minPair: string[] | null = null
  let sum = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = mat[i]![j]!
      if (d > maxD) {
        maxD = d
        maxPair = [points[i]!.name, points[j]!.name]
      }
      if (d < minD) {
        minD = d
        minPair = [points[i]!.name, points[j]!.name]
      }
      sum += d
      count++
    }
  }
  return {
    n,
    cells: n * n,
    max: maxD < 0 ? 0 : maxD,
    maxPair,
    min: minD === Infinity ? 0 : minD,
    minPair,
    avg: count > 0 ? sum / count : 0,
  }
}
