/* ============================================================
 * 图幅编号计算 · 核心算法
 * 提取自 doSometing/map-sheet/index.html
 * ============================================================ */

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUV'
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI']

interface ScaleInfo {
  rows: number
  cols: number
  name: string
  lngSpan: number
  latSpan: number
}

export const SCALES: Record<string, ScaleInfo> = {
  '1M': { rows: 1, cols: 1, name: '1:100万', lngSpan: 6, latSpan: 4 },
  '500K': { rows: 2, cols: 2, name: '1:50万', lngSpan: 3, latSpan: 2 },
  '250K': { rows: 4, cols: 4, name: '1:25万', lngSpan: 1.5, latSpan: 1 },
  '100K': { rows: 12, cols: 12, name: '1:10万', lngSpan: 0.5, latSpan: 0.333 },
  '50K': { rows: 24, cols: 24, name: '1:5万', lngSpan: 0.25, latSpan: 0.166 },
  '25K': { rows: 48, cols: 48, name: '1:2.5万', lngSpan: 0.125, latSpan: 0.083 },
  '10K': { rows: 96, cols: 96, name: '1:1万', lngSpan: 0.0625, latSpan: 0.0417 },
}

export function latBand(lat: number): number {
  return Math.floor(lat / 4)
}

export function lngBand(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1
}

function bandToLat(row: number): number {
  return row * 4
}

function bandToLng(col: number): number {
  return (col - 1) * 6 - 180
}

export interface SheetResult {
  scale: string
  code: string
  west: number
  east: number
  south: number
  north: number
}

export function lngLatToSheet(lng: number, lat: number): SheetResult[] {
  const row100 = latBand(lat)
  const col100 = lngBand(lng)
  const letter = LETTERS[row100] || '?'
  const base = letter + '-' + col100
  const results: SheetResult[] = []

  for (const key in SCALES) {
    const sc = SCALES[key]!
    const north100 = (row100 + 1) * 4
    const south100 = row100 * 4
    if (key === '1M') {
      results.push({
        scale: sc.name,
        code: base,
        west: bandToLng(col100),
        east: bandToLng(col100) + 6,
        south: south100,
        north: north100,
      })
      continue
    }
    let subRow = Math.floor((north100 - lat) / sc.latSpan)
    let subCol = Math.floor((lng - bandToLng(col100)) / sc.lngSpan)
    if (subRow < 0) subRow = 0
    if (subCol < 0) subCol = 0

    let code: string
    if (key === '500K') {
      code = base + '-' + ROMAN[subRow * 2 + subCol]
    } else if (key === '250K') {
      code = base + '-' + (subRow * 4 + subCol + 1)
    } else if (key === '100K') {
      code = base + '-' + (subRow * 12 + subCol + 1)
    } else if (key === '50K') {
      const k100 = Math.floor(subRow / 2) * 12 + Math.floor(subCol / 2) + 1
      const sub = (subRow % 2) * 2 + (subCol % 2)
      code = base + '-' + k100 + '-' + ['甲', '乙', '丙', '丁'][sub]
    } else if (key === '10K') {
      const k100b = Math.floor(subRow / 8) * 12 + Math.floor(subCol / 8) + 1
      const sub2 = (subRow % 8) * 8 + (subCol % 8) + 1
      code = base + '-' + k100b + '-(' + sub2 + ')'
    } else {
      code = base + '-' + (subRow * sc.cols + subCol + 1)
    }

    const west = bandToLng(col100) + subCol * sc.lngSpan
    const north = north100 - subRow * sc.latSpan
    results.push({
      scale: sc.name,
      code,
      west,
      east: west + sc.lngSpan,
      south: north - sc.latSpan,
      north,
    })
  }
  return results
}

export interface ReverseResult {
  code: string
  scale?: string
  west: number
  east: number
  south: number
  north: number
  hint?: string
  error?: string
}

export function sheetToBbox(sheetNo: string, scaleKey: string): ReverseResult {
  sheetNo = sheetNo.trim().toUpperCase()
  const m = sheetNo.match(/^([A-V])-?(\d+)$/)
  if (!m) return { code: sheetNo, west: 0, east: 0, south: 0, north: 0, error: '格式无效，如 J-50' }
  const row = LETTERS.indexOf(m[1]!)
  const col = parseInt(m[2]!, 10)
  if (row < 0 || col < 1) return { code: sheetNo, west: 0, east: 0, south: 0, north: 0, error: '行列号无效' }
  const west = bandToLng(col)
  const east = west + 6
  const south = row * 4
  const north = (row + 1) * 4
  if (scaleKey === '1M') return { code: sheetNo, west, east, south, north }
  const sc = SCALES[scaleKey]!
  const suffix = sheetNo.replace(/^[A-V]-?\d+-?/, '').trim()
  if (!suffix) return { code: sheetNo, west, east, south, north }
  return {
    code: sheetNo,
    scale: sc.name,
    west,
    east,
    south,
    north,
    hint: '子图幅范围请用经纬度→图幅号查询',
  }
}
