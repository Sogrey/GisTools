/* ============================================================
 * 坐标清洗 · 核心算法（合并 coord-precision + coord-cleaner）
 * 精度控制（截断/四舍五入）+ 去重清洗（去重/越界/离群/排序）
 * 提取自 doSometing/coord-precision/index.html 和 coord-cleaner/index.html
 * ============================================================ */

export type PrecisionMode = 'truncate' | 'round' | 'original'

/* ---------- 精度控制 ---------- */
function detectSep(line: string, forced: string | null): string | null {
  if (forced && forced !== 'auto') return forced
  if (line.indexOf(',') !== -1) return ','
  if (line.indexOf('，') !== -1) return '，'
  if (line.indexOf('\t') !== -1) return '\t'
  if (line.indexOf(' ') !== -1) return ' '
  return null
}

export function parseCoordLine(line: string, forcedSep: string | null = null): [number, number] | null {
  line = line.trim()
  if (!line) return null
  const sep = detectSep(line, forcedSep)
  if (sep === null) return null
  let parts: string[]
  if (sep === ' ') parts = line.split(/\s+/)
  else if (sep === '\t') parts = line.split(/\t+/)
  else parts = line.split(sep)
  if (parts.length < 2) return null
  const lng = parseFloat(parts[0]!)
  const lat = parseFloat(parts[1]!)
  if (isNaN(lng) || isNaN(lat)) return null
  return [lng, lat]
}

export function truncateVal(val: number, n: number): number {
  if (n <= 0) return Math.floor(val)
  const factor = Math.pow(10, n)
  const neg = val < 0
  const absVal = Math.abs(val)
  const truncated = Math.floor(absVal * factor) / factor
  return neg ? -truncated : truncated
}

export function roundVal(val: number, n: number): number {
  if (n <= 0) return Math.round(val)
  return parseFloat(val.toFixed(n))
}

export function formatNum(val: number, mode: PrecisionMode, n: number): string {
  if (mode === 'truncate') {
    let s = String(val)
    if (s.indexOf('e') !== -1 || s.indexOf('E') !== -1) s = val.toFixed(n)
    return s
  } else if (mode === 'round') {
    let str = val.toFixed(n)
    if (str.indexOf('.') !== -1) str = str.replace(/0+$/, '').replace(/\.$/, '')
    return str
  }
  return String(val)
}

export interface PrecisionStats {
  groups: number
  coords: number
  changed: number
}

export function processPrecision(
  input: string,
  mode: PrecisionMode,
  n: number,
  forcedSep: string = 'auto',
): { output: string; stats: PrecisionStats } {
  const lines = input.split(/\r?\n/)
  const outLines: string[] = []
  let groups = 0, coords = 0, changed = 0

  for (const line of lines) {
    if (!line.trim()) {
      outLines.push('')
      continue
    }
    const coord = parseCoordLine(line, forcedSep)
    if (!coord) {
      outLines.push(line)
      continue
    }
    groups++
    coords += 2
    const origLng = coord[0], origLat = coord[1]
    let newLng: number, newLat: number
    if (mode === 'truncate') {
      newLng = truncateVal(origLng, n)
      newLat = truncateVal(origLat, n)
    } else if (mode === 'round') {
      newLng = roundVal(origLng, n)
      newLat = roundVal(origLat, n)
    } else {
      newLng = origLng
      newLat = origLat
    }
    const lngStr = formatNum(newLng, mode, n)
    const latStr = formatNum(newLat, mode, n)
    if (String(origLng) !== lngStr) changed++
    if (String(origLat) !== latStr) changed++
    outLines.push(lngStr + ', ' + latStr)
  }
  return { output: outLines.join('\n'), stats: { groups, coords, changed } }
}

/* ---------- 去重清洗 ---------- */
export interface CleanPoint {
  lng: number
  lat: number
  raw: string
  idx?: number
  isAnomaly?: boolean
  isOutlier?: boolean
}

export interface CleanOptions {
  dedup: boolean
  dedupTol: number
  anomaly: boolean
  anomalyDel: boolean
  outlier: boolean
  outlierFactor: number
  outlierDel: boolean
  sort: boolean
  sortBy: 'lng' | 'lat'
}

export interface CleanStats {
  final: number
  dedup: number
  anomaly: number
  outlier: number
  parseFail: number
  original: number
}

function haversine(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function parseCleanLine(line: string): CleanPoint | null {
  const parts = line.trim().split(/[,;\s\t]+/).filter((s) => s)
  if (parts.length < 2) return null
  const lng = parseFloat(parts[0]!)
  const lat = parseFloat(parts[1]!)
  if (isNaN(lng) || isNaN(lat)) return null
  return { lng, lat, raw: line.trim() }
}

export function cleanCoords(input: string, opts: CleanOptions): { output: string; stats: CleanStats } {
  const lines = input.trim().split('\n')
  let points: CleanPoint[] = []
  let parseFail = 0
  for (let i = 0; i < lines.length; i++) {
    const p = parseCleanLine(lines[i]!)
    if (p) {
      p.idx = i
      points.push(p)
    } else if (lines[i]!.trim()) {
      parseFail++
    }
  }

  const originalCount = points.length
  let dedupCount = 0, anomalyCount = 0, outlierCount = 0

  // 异常值检测
  if (opts.anomaly) {
    for (const p of points) {
      p.isAnomaly = p.lng < -180 || p.lng > 180 || p.lat < -90 || p.lat > 90
      if (p.isAnomaly) anomalyCount++
    }
    if (opts.anomalyDel) {
      points = points.filter((p) => !p.isAnomaly)
    }
  }

  // 去重
  if (opts.dedup) {
    const seen: CleanPoint[] = []
    const deduped: CleanPoint[] = []
    for (const p of points) {
      let isDup = false
      for (const s of seen) {
        if (Math.abs(p.lng - s.lng) <= opts.dedupTol && Math.abs(p.lat - s.lat) <= opts.dedupTol) {
          isDup = true
          break
        }
      }
      if (isDup) dedupCount++
      else {
        seen.push({ lng: p.lng, lat: p.lat, raw: '' })
        deduped.push(p)
      }
    }
    points = deduped
  }

  // 离群点检测
  if (opts.outlier && points.length >= 3) {
    const dists: number[] = []
    for (let i = 1; i < points.length; i++) {
      dists.push(haversine(points[i - 1]!.lng, points[i - 1]!.lat, points[i]!.lng, points[i]!.lat))
    }
    const avgDist = dists.reduce((a, b) => a + b, 0) / dists.length
    const threshold = avgDist * opts.outlierFactor
    for (let i = 0; i < points.length; i++) {
      let isOutlier = false
      if (i === 0) isOutlier = dists[0]! > threshold
      else if (i === points.length - 1) isOutlier = dists[dists.length - 1]! > threshold
      else {
        const dPrev = dists[i - 1]!
        const dNext = dists[i]!
        isOutlier = dPrev > threshold && dNext > threshold
      }
      points[i]!.isOutlier = isOutlier
      if (isOutlier) outlierCount++
    }
    if (opts.outlierDel) points = points.filter((p) => !p.isOutlier)
  }

  // 排序
  if (opts.sort) {
    points.sort((a, b) => (opts.sortBy === 'lng' ? a.lng - b.lng : a.lat - b.lat))
  }

  const outputLines = points.map((p) => {
    let line = p.lng + ',' + p.lat
    if (p.isAnomaly) line += '  # 越界异常'
    if (p.isOutlier) line += '  # 离群点'
    return line
  })

  return {
    output: outputLines.join('\n'),
    stats: { final: points.length, dedup: dedupCount, anomaly: anomalyCount, outlier: outlierCount, parseFail, original: originalCount },
  }
}
