/* ============================================================
 * 等值线生成 · 核心：Marching Squares + 线性插值 + 段链接
 * 提取自 doSometing/contour-generator/index.html
 * ============================================================ */

const EPS = 1e-9

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** 边插值：返回等值线与网格边的交点坐标 */
export function interpolateEdge(p1: [number, number], p2: [number, number], v1: number, v2: number, level: number): [number, number] {
  if (Math.abs(v2 - v1) < EPS) return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2]
  let t = (level - v1) / (v2 - v1)
  t = Math.max(0, Math.min(1, t))
  return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])]
}

/** Marching Squares：单个网格单元，返回线段数组 */
export function marchingSquares(xL: number, xR: number, yT: number, yB: number, vTL: number, vTR: number, vBR: number, vBL: number, level: number): number[][][] {
  let code = 0
  if (vTL >= level) code |= 1
  if (vTR >= level) code |= 2
  if (vBR >= level) code |= 4
  if (vBL >= level) code |= 8

  if (code === 0 || code === 15) return []

  const TL: [number, number] = [xL, yT], TR: [number, number] = [xR, yT]
  const BL: [number, number] = [xL, yB], BR: [number, number] = [xR, yB]

  const pTop = () => interpolateEdge(TL, TR, vTL, vTR, level)
  const pBottom = () => interpolateEdge(BL, BR, vBL, vBR, level)
  const pLeft = () => interpolateEdge(TL, BL, vTL, vBL, level)
  const pRight = () => interpolateEdge(TR, BR, vTR, vBR, level)

  const segs: number[][][] = []
  switch (code) {
    case 1: segs.push([pLeft(), pTop()]); break
    case 2: segs.push([pTop(), pRight()]); break
    case 3: segs.push([pLeft(), pRight()]); break
    case 4: segs.push([pRight(), pBottom()]); break
    case 5: segs.push([pLeft(), pTop()]); segs.push([pRight(), pBottom()]); break
    case 6: segs.push([pTop(), pBottom()]); break
    case 7: segs.push([pLeft(), pBottom()]); break
    case 8: segs.push([pLeft(), pBottom()]); break
    case 9: segs.push([pTop(), pBottom()]); break
    case 10: segs.push([pLeft(), pBottom()]); segs.push([pTop(), pRight()]); break
    case 11: segs.push([pTop(), pRight()]); break
    case 12: segs.push([pLeft(), pRight()]); break
    case 13: segs.push([pTop(), pRight()]); break
    case 14: segs.push([pLeft(), pTop()]); break
  }
  return segs
}

/** 将线段链接为折线（贪心法） */
export function chainSegments(segments: number[][][]): number[][][] {
  if (!segments.length) return []
  const used = new Array(segments.length).fill(false)
  const polylines: number[][][] = []
  const tol = 1e-6

  const ptsEq = (a: number[], b: number[]): boolean =>
    Math.abs(a[0]! - b[0]!) < tol && Math.abs(a[1]! - b[1]!) < tol

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue
    used[i] = true
    const chain: number[][] = [segments[i]![0]!, segments[i]![1]!]

    let found = true
    while (found) {
      found = false
      const tail = chain[chain.length - 1]!
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue
        if (ptsEq(segments[j]![0]!, tail)) { chain.push(segments[j]![1]!); used[j] = true; found = true; break }
        if (ptsEq(segments[j]![1]!, tail)) { chain.push(segments[j]![0]!); used[j] = true; found = true; break }
      }
    }

    found = true
    while (found) {
      found = false
      const head = chain[0]!
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue
        if (ptsEq(segments[j]![1]!, head)) { chain.unshift(segments[j]![0]!); used[j] = true; found = true; break }
        if (ptsEq(segments[j]![0]!, head)) { chain.unshift(segments[j]![1]!); used[j] = true; found = true; break }
      }
    }

    polylines.push(chain)
  }

  return polylines
}

/** 构建所有等值线 */
export function buildContours(grid: number[][], xCoords: number[], yCoords: number[], levels: number[]): any {
  const nrows = grid.length
  const ncols = grid[0]!.length
  const allFeatures: any[] = []

  for (let li = 0; li < levels.length; li++) {
    const level = levels[li]!
    const segments: number[][][] = []

    for (let row = 0; row < nrows - 1; row++) {
      for (let col = 0; col < ncols - 1; col++) {
        const xL = xCoords[col]!, xR = xCoords[col + 1]!
        const yT = yCoords[row]!, yB = yCoords[row + 1]!
        const vTL = grid[row]![col]!, vTR = grid[row]![col + 1]!
        const vBL = grid[row + 1]![col]!, vBR = grid[row + 1]![col + 1]!

        const cellSegs = marchingSquares(xL, xR, yT, yB, vTL, vTR, vBR, vBL, level)
        for (let s = 0; s < cellSegs.length; s++) segments.push(cellSegs[s]!)
      }
    }

    const polylines = chainSegments(segments)
    for (let p = 0; p < polylines.length; p++) {
      allFeatures.push({
        type: 'Feature',
        properties: { value: level, level_index: li },
        geometry: { type: 'LineString', coordinates: polylines[p] },
      })
    }
  }

  return { type: 'FeatureCollection', features: allFeatures }
}

export interface ParsedGrid {
  grid: number[][]
  xCoords: number[]
  yCoords: number[]
}

/** CSV 解析为网格 */
export function parseCSV(text: string): ParsedGrid {
  const lines = text.trim().split(/\r?\n/)
  const points: number[][] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || line.charAt(0) === '#') continue
    const parts = line.split(/[,\s\t;]+/)
    if (parts.length < 3) continue
    const x = parseFloat(parts[0]!), y = parseFloat(parts[1]!), v = parseFloat(parts[2]!)
    if (!isFinite(x) || !isFinite(y) || !isFinite(v)) continue
    points.push([x, y, v])
  }
  if (points.length < 4) throw new Error('CSV 至少需要 4 个数据点')

  const xSet: Record<number, boolean> = {}, ySet: Record<number, boolean> = {}
  for (let p = 0; p < points.length; p++) {
    xSet[points[p]![0]!] = true
    ySet[points[p]![1]!] = true
  }
  const xCoords = Object.keys(xSet).map(Number).sort((a, b) => a - b)
  const yCoords = Object.keys(ySet).map(Number).sort((a, b) => b - a)

  if (xCoords.length < 2 || yCoords.length < 2) throw new Error('网格至少需要 2×2')

  const xMap: Record<number, number> = {}, yMap: Record<number, number> = {}
  for (let xi = 0; xi < xCoords.length; xi++) xMap[xCoords[xi]!] = xi
  for (let yi = 0; yi < yCoords.length; yi++) yMap[yCoords[yi]!] = yi

  const grid: number[][] = []
  for (let r = 0; r < yCoords.length; r++) grid.push(new Array(xCoords.length).fill(NaN))

  for (let k = 0; k < points.length; k++) {
    const ri = yMap[points[k]![1]!]!, ci = xMap[points[k]![0]!]!
    grid[ri]![ci] = points[k]![2]!
  }

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0]!.length; c++) {
      if (isNaN(grid[r]![c]!)) throw new Error('网格不完整，缺少 (' + xCoords[c] + ', ' + yCoords[r] + ') 处的值')
    }
  }

  return { grid, xCoords, yCoords }
}

/** 矩阵解析 */
export function parseMatrix(text: string, x0: number, y0: number, dx: number, dy: number): ParsedGrid {
  const lines = text.trim().split(/\r?\n/)
  const rows: number[][] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line || line.charAt(0) === '#') continue
    const vals = line.split(/[\s\t,;]+/).map(Number).filter((v) => isFinite(v))
    if (vals.length > 0) rows.push(vals)
  }
  if (rows.length < 2) throw new Error('矩阵至少需要 2 行')
  const ncols = rows[0]!.length
  for (let r = 1; r < rows.length; r++) {
    if (rows[r]!.length !== ncols) throw new Error('矩阵每行列数必须相同')
  }
  const nrows = rows.length
  const xCoords: number[] = [], yCoords: number[] = []
  for (let c = 0; c < ncols; c++) xCoords.push(x0 + c * dx)
  for (let r = 0; r < nrows; r++) yCoords.push(y0 + (nrows - 1 - r) * dy)
  return { grid: rows, xCoords, yCoords }
}

/** SVG 预览 */
export function buildContourSvg(fc: any, levels: number[]): string {
  if (!fc.features.length) return ''
  const vw = 500, vh = 400, pad = 20

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (let i = 0; i < fc.features.length; i++) {
    const coords = fc.features[i].geometry.coordinates
    for (let j = 0; j < coords.length; j++) {
      const c = coords[j]
      if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0]
      if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1]
    }
  }
  let bw = maxX - minX, bh = maxY - minY
  if (bw <= 0) bw = 1; if (bh <= 0) bh = 1
  const scale = Math.min((vw - pad * 2) / bw, (vh - pad * 2) / bh)
  const offX = pad + (vw - pad * 2 - bw * scale) / 2
  const offY = pad + (vh - pad * 2 - bh * scale) / 2

  const toXY = (c: number[]): [number, number] => [offX + (c[0]! - minX) * scale, offY + (maxY - c[1]!) * scale]

  const minL = Math.min(...levels)
  const maxL = Math.max(...levels)
  const range = maxL - minL || 1

  let paths = ''
  for (let f = 0; f < fc.features.length; f++) {
    const feat = fc.features[f]
    const coords = feat.geometry.coordinates
    const val = feat.properties.value
    const t = (val - minL) / range
    const r = Math.round(lerp(33, 220, t))
    const g = Math.round(lerp(102, 40, t))
    const b = Math.round(lerp(172, 40, t))
    const color = 'rgb(' + r + ',' + g + ',' + b + ')'

    let d = ''
    for (let p = 0; p < coords.length; p++) {
      const pt = toXY(coords[p])
      d += (p === 0 ? 'M' : 'L') + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1)
    }
    paths += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.2" stroke-linejoin="round"/>'
  }

  const legendY = vh - 6
  let legend = ''
  for (let li = 0; li < levels.length; li++) {
    const lt = (levels[li]! - minL) / range
    const lr = Math.round(lerp(33, 220, lt))
    const lg = Math.round(lerp(102, 40, lt))
    const lb = Math.round(lerp(172, 40, lt))
    const lx = pad + li * 30
    legend += '<rect x="' + lx + '" y="' + (legendY - 10) + '" width="28" height="8" fill="rgb(' + lr + ',' + lg + ',' + lb + ')" stroke="rgba(0,0,0,.2)" stroke-width="0.5"/>'
    legend += '<text x="' + (lx + 14) + '" y="' + (legendY + 4) + '" font-size="7" fill="#5b6b80" text-anchor="middle">' + levels[li]!.toFixed(1) + '</text>'
  }

  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + vw + '" height="' + vh + '" viewBox="0 0 ' + vw + ' ' + vh + '">' +
    '<rect width="' + vw + '" height="' + vh + '" fill="#fff"/>' + paths + '<g>' + legend + '</g></svg>'
}
