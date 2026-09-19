/* ============================================================
 * 地图排版 · 核心：经纬网 + 比例尺 + 指北针 + 图例框
 * 提取自 doSometing/map-layout/index.html
 * ============================================================ */

export interface LegendItem {
  name: string
  color: string
}

/** 构建经纬网 */
export function buildGraticule(bbox: number[], interval: number, mapX: number, mapY: number, mapW: number, mapH: number): { svg: string; interval: number } {
  const west = bbox[0]!, south = bbox[1]!, east = bbox[2]!, north = bbox[3]!
  if (!interval || interval <= 0) {
    const range = Math.max(east - west, north - south)
    if (range > 30) interval = 10
    else if (range > 10) interval = 5
    else if (range > 5) interval = 1
    else if (range > 1) interval = 0.5
    else if (range > 0.2) interval = 0.1
    else if (range > 0.05) interval = 0.02
    else interval = 0.01
  }

  const bw = east - west, bh = north - south
  if (bw <= 0 || bh <= 0) return { svg: '', interval }

  const lngToX = (lng: number) => mapX + (lng - west) / bw * mapW
  const latToY = (lat: number) => mapY + (north - lat) / bh * mapH

  let lines = ''
  const lngStart = Math.ceil(west / interval) * interval
  for (let lng = lngStart; lng <= east + interval * 0.001; lng += interval) {
    const x = lngToX(lng)
    lines += '<line x1="' + x.toFixed(1) + '" y1="' + mapY + '" x2="' + x.toFixed(1) + '" y2="' + (mapY + mapH) + '" stroke="#c8d4e6" stroke-width="0.5"/>'
    lines += '<text x="' + x.toFixed(1) + '" y="' + (mapY - 3) + '" font-size="9" fill="#8fa0b5" text-anchor="middle">' + formatCoord(lng, 'lng') + '</text>'
  }
  const latStart = Math.ceil(south / interval) * interval
  for (let lat = latStart; lat <= north + interval * 0.001; lat += interval) {
    const y = latToY(lat)
    lines += '<line x1="' + mapX + '" y1="' + y.toFixed(1) + '" x2="' + (mapX + mapW) + '" y2="' + y.toFixed(1) + '" stroke="#c8d4e6" stroke-width="0.5"/>'
    lines += '<text x="' + (mapX - 4) + '" y="' + (y + 3).toFixed(1) + '" font-size="9" fill="#8fa0b5" text-anchor="end">' + formatCoord(lat, 'lat') + '</text>'
  }

  return { svg: lines, interval }
}

export function formatCoord(v: number, type: 'lng' | 'lat'): string {
  const deg = Math.floor(Math.abs(v))
  const min = (Math.abs(v) - deg) * 60
  const minStr = min.toFixed(0)
  if (type === 'lng') {
    return deg + '°' + (minStr !== '0' ? minStr + '′' : '') + (v >= 0 ? 'E' : 'W')
  } else {
    return deg + '°' + (minStr !== '0' ? minStr + '′' : '') + (v >= 0 ? 'N' : 'S')
  }
}

/** 构建比例尺 */
export function buildScaleBar(scaleDenom: number, dpi: number, x: number, y: number, maxW: number): string {
  const metersPerPx = scaleDenom * 0.0254 / dpi
  const candidates = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000]
  const targetPx = maxW * 0.6
  let bestDist = candidates[0]!
  for (let i = 0; i < candidates.length; i++) {
    const px = candidates[i]! / metersPerPx
    if (px <= targetPx) bestDist = candidates[i]!
  }
  const barPx = bestDist / metersPerPx

  const segW = barPx / 4
  let segs = ''
  for (let s = 0; s < 4; s++) {
    const sx = x + s * segW
    const fill = s % 2 === 0 ? '#333' : '#fff'
    segs += '<rect x="' + sx.toFixed(1) + '" y="' + y + '" width="' + segW.toFixed(1) + '" height="8" fill="' + fill + '" stroke="#333" stroke-width="0.5"/>'
  }
  let labels = ''
  for (let l = 0; l <= 4; l++) {
    const lx = x + l * segW
    const dist = bestDist * l / 4
    const label = dist >= 1000 ? dist / 1000 + 'km' : dist + 'm'
    labels += '<text x="' + lx.toFixed(1) + '" y="' + (y + 20) + '" font-size="8" fill="#5b6b80" text-anchor="middle">' + label + '</text>'
    labels += '<line x1="' + lx.toFixed(1) + '" y1="' + (y + 8) + '" x2="' + lx.toFixed(1) + '" y2="' + (y + 11) + '" stroke="#333" stroke-width="0.5"/>'
  }
  const scaleText = '1 : ' + scaleDenom.toLocaleString('zh-CN')

  return '<g>' +
    '<rect x="' + (x - 4) + '" y="' + (y - 4) + '" width="' + (barPx + 8).toFixed(1) + '" height="30" fill="rgba(255,255,255,.85)" stroke="#e3eaf3" stroke-width="0.5" rx="3"/>' +
    segs + labels +
    '<text x="' + (x + barPx / 2).toFixed(1) + '" y="' + (y - 8) + '" font-size="9" fill="#5b6b80" text-anchor="middle" font-weight="600">' + scaleText + '</text>' +
    '</g>'
}

/** 构建指北针 */
export function buildNorthArrow(cx: number, cy: number, size: number): string {
  const r = size / 2
  let arrow = ''
  arrow += '<polygon points="' + cx + ',' + (cy - r) + ' ' + (cx - r * 0.3) + ',' + (cy + r * 0.5) + ' ' + cx + ',' + (cy + r * 0.2) + ' ' + (cx + r * 0.3) + ',' + (cy + r * 0.5) + ' ' + cx + ',' + (cy - r) + '" fill="#333" stroke="none"/>'
  arrow += '<polygon points="' + cx + ',' + (cy - r) + ' ' + cx + ',' + (cy + r * 0.2) + ' ' + (cx - r * 0.3) + ',' + (cy + r * 0.5) + '" fill="#fff" stroke="#333" stroke-width="0.8"/>'
  arrow += '<polygon points="' + cx + ',' + (cy - r) + ' ' + (cx + r * 0.3) + ',' + (cy + r * 0.5) + ' ' + cx + ',' + (cy + r * 0.2) + '" fill="#333" stroke="#333" stroke-width="0.8"/>'
  arrow += '<text x="' + cx + '" y="' + (cy - r - 4) + '" font-size="11" fill="#333" text-anchor="middle" font-weight="700">N</text>'
  arrow += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#ccc" stroke-width="0.8"/>'
  return '<g>' + arrow + '</g>'
}

/** 构建图例框 */
export function buildLegend(x: number, y: number, items: LegendItem[], maxW: number): string {
  if (!items.length) return ''
  const w = Math.min(maxW, 140)
  const lineH = 18, headerH = 22
  const h = headerH + items.length * lineH + 8

  let svg = '<g>'
  svg += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="rgba(255,255,255,.9)" stroke="#b0bec5" stroke-width="1" rx="4"/>'
  svg += '<text x="' + (x + 8) + '" y="' + (y + 15) + '" font-size="11" fill="#37474f" font-weight="700">图例</text>'
  svg += '<line x1="' + (x + 4) + '" y1="' + (y + headerH - 2) + '" x2="' + (x + w - 4) + '" y2="' + (y + headerH - 2) + '" stroke="#e0e0e0" stroke-width="0.5"/>'
  for (let i = 0; i < items.length; i++) {
    const iy = y + headerH + i * lineH + 4
    const sw = 14, sh = 10
    svg += '<rect x="' + (x + 8) + '" y="' + iy + '" width="' + sw + '" height="' + sh + '" fill="' + items[i]!.color + '" stroke="#999" stroke-width="0.5" rx="2"/>'
    svg += '<text x="' + (x + 8 + sw + 6) + '" y="' + (iy + 9) + '" font-size="10" fill="#455a64">' + items[i]!.name + '</text>'
  }
  svg += '</g>'
  return svg
}

/** 解析图例项 */
export function parseLegendItems(str: string): LegendItem[] {
  if (!str) return []
  const parts = str.split(',')
  const items: LegendItem[] = []
  for (let i = 0; i < parts.length; i++) {
    const pair = parts[i]!.trim().split(':')
    if (pair.length >= 2) {
      items.push({ name: pair[0]!.trim(), color: pair.slice(1).join(':').trim() })
    }
  }
  return items
}
