/* ============================================================
 * DEM 高程数据处理 · 核心逻辑
 * 高程统计 · 等值线插值 · 规则格网聚合
 * 提取自 doSometing/dem-tools/index.html
 * ============================================================ */

export interface DemPoint { x: number; y: number; z: number }

export interface DemStats {
  n: number; min: number; max: number; range: number
  mean: number; median: number; sd: number
  minX: number; maxX: number; minY: number; maxY: number
}

export interface HistBin { lo: number; hi: number; count: number }

export interface ContourHit { seg: number; x: number; y: number; t: number }

export function parseXYZ(text: string): { pts: DemPoint[]; skipped: number } {
  const pts: DemPoint[] = []
  let skipped = 0
  const lines = String(text).split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed[0] === '#' || trimmed[0] === ';' || trimmed.indexOf('//') === 0) continue
    const parts = trimmed.split(/[\s,;]+/).filter(Boolean)
    if (parts.length < 3) { skipped++; continue }
    const x = parseFloat(parts[0]!), y = parseFloat(parts[1]!), z = parseFloat(parts[2]!)
    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) { skipped++; continue }
    pts.push({ x, y, z })
  }
  return { pts, skipped }
}

export function calcStats(pts: DemPoint[]): DemStats {
  const n = pts.length
  let min = Infinity, max = -Infinity, sum = 0
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  const zs = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const p = pts[i]!, z = p.z
    zs[i] = z
    if (z < min) min = z
    if (z > max) max = z
    sum += z
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const mean = sum / n
  let sq = 0
  for (let i = 0; i < n; i++) { const d = zs[i]! - mean; sq += d * d }
  const sd = Math.sqrt(sq / n)
  const sorted = Array.from(zs).sort((a, b) => a - b)
  const median = n % 2 ? sorted[(n - 1) >> 1]! : (sorted[n / 2 - 1]! + sorted[n / 2]!) / 2
  return { n, min, max, range: max - min, mean, median, sd, minX, maxX, minY, maxY }
}

export function calcHist(pts: DemPoint[], min: number, max: number, bins: number): HistBin[] {
  if (max === min) return [{ lo: min, hi: max, count: pts.length }]
  const w = (max - min) / bins
  const out: HistBin[] = []
  for (let i = 0; i < bins; i++) out.push({ lo: min + i * w, hi: min + (i + 1) * w, count: 0 })
  for (const p of pts) {
    let b = Math.floor((p.z - min) / w)
    if (b >= bins) b = bins - 1
    if (b < 0) b = 0
    out[b]!.count++
  }
  return out
}

function lineCross(p1: DemPoint, p2: DemPoint, z0: number): { x: number; y: number; t: number } | null {
  const z1 = p1.z, z2 = p2.z, dz = z2 - z1
  if (Math.abs(dz) < 1e-12) return null
  const t = (z0 - z1) / dz
  if (t < -1e-9 || t > 1 + 1e-9) return null
  const tc = Math.max(0, Math.min(1, t))
  return { x: p1.x + (p2.x - p1.x) * tc, y: p1.y + (p2.y - p1.y) * tc, t: tc }
}

export function contourAt(points: DemPoint[], z0: number, closed: boolean): ContourHit[] {
  const n = points.length, m = closed ? n : n - 1
  const hits: ContourHit[] = []
  for (let i = 0; i < m; i++) {
    const r = lineCross(points[i]!, points[(i + 1) % n]!, z0)
    if (r) hits.push({ seg: i + 1, ...r })
  }
  const out: ContourHit[] = []
  for (const h of hits) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - h.x) < 1e-9 && Math.abs(last.y - h.y) < 1e-9) continue
    out.push(h)
  }
  return out
}

export function levelsFor(pts: DemPoint[], interval: number): number[] {
  let zmin = Infinity, zmax = -Infinity
  for (const p of pts) { if (p.z < zmin) zmin = p.z; if (p.z > zmax) zmax = p.z }
  const lo = Math.floor(zmin / interval + 1e-9) * interval
  const hi = Math.ceil(zmax / interval - 1e-9) * interval
  const levels: number[] = []
  for (let z = lo; z <= hi + interval * 1e-6; z += interval) levels.push(+z.toFixed(9))
  return levels
}

export interface GridifyResult {
  text: string
  colsN: number
  rowsN: number
  filled: number
  total: number
  cellCounts: number[]
}

export function gridify(pts: DemPoint[], d: number, snapOrigin: boolean): GridifyResult {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y
  }
  const ox = snapOrigin ? Math.floor(minX / d) * d : minX
  const oy = snapOrigin ? Math.floor(minY / d) * d : minY
  const cells = new Map<number, { ix: number; iy: number; sum: number; count: number }>()
  for (const p of pts) {
    let ix = Math.floor((p.x - ox) / d), iy = Math.floor((p.y - oy) / d)
    if (ix < 0) ix = 0; if (iy < 0) iy = 0
    const k = iy * 100000 + ix
    let c = cells.get(k)
    if (!c) { c = { ix, iy, sum: 0, count: 0 }; cells.set(k, c) }
    c.sum += p.z; c.count++
  }
  const list = Array.from(cells.values()).sort((a, b) => (a.iy - b.iy) || (a.ix - b.ix))
  let colsN = 0, rowsN = 0
  for (const c of list) { if (c.ix + 1 > colsN) colsN = c.ix + 1; if (c.iy + 1 > rowsN) rowsN = c.iy + 1 }
  const fmt = (v: number, dp: number) => (+v.toFixed(dp)).toString()
  const lines: string[] = []
  lines.push('# DEM 规则格网聚合结果')
  lines.push(`# 间距=${fmt(d, 6)} | 格网=${colsN} x ${rowsN} | 有值格=${list.length} | 覆盖率=${fmt(list.length * 100 / (colsN * rowsN), 1)}%`)
  lines.push('# 格式: x_center  y_center  avg_z  count')
  for (const c of list) {
    const cx = ox + (c.ix + 0.5) * d, cy = oy + (c.iy + 0.5) * d
    lines.push(`${fmt(cx, 6)}  ${fmt(cy, 6)}  ${fmt(c.sum / c.count, 3)}  ${c.count}`)
  }
  return { text: lines.join('\n'), colsN, rowsN, filled: list.length, total: colsN * rowsN, cellCounts: list.map(c => c.count) }
}

function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

export function buildExample(): string {
  const rand = mulberry32(20260917)
  const x0 = 113.20, y0 = 30.30, span = 0.36, N = 12, d = span / N
  const lines: string[] = []
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = x0 + i * d, y = y0 + j * d
      const gx1 = (x - (x0 + 0.09)) / 0.10, gy1 = (y - (y0 + 0.24)) / 0.12
      const gx2 = (x - (x0 + 0.27)) / 0.14, gy2 = (y - (y0 + 0.10)) / 0.11
      let z = 320 + 210 * Math.exp(-(gx1 * gx1 + gy1 * gy1)) + 130 * Math.exp(-(gx2 * gx2 + gy2 * gy2))
      z += 50 * Math.sin((x - x0) / span * Math.PI * 2) * Math.exp(-Math.pow((y - (y0 + 0.30)) / 0.20, 2))
      z += (rand() - 0.5) * 7
      lines.push(x.toFixed(6) + ' ' + y.toFixed(6) + ' ' + z.toFixed(2))
    }
  }
  return lines.join('\n')
}

export function fmt(v: number | undefined, d: number): string {
  return (typeof v === 'number' && isFinite(v)) ? (+v.toFixed(d)).toString() : '—'
}
