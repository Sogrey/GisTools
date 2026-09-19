/* ============================================================
 * GeoJSON → SVG · 核心算法
 * GeoJSON 渲染为 SVG，可调画布/线宽/填充/投影
 * 提取自 doSometing/geojson-to-svg/index.html
 * ============================================================ */

export interface SvgRenderOptions {
  width: number
  height: number
  lineColor: string
  fillColor: string
  pointColor: string
  lineWidth: number
  pointR: number
  fillOpacity: number
  bg: 'light' | 'dark'
}

export interface BBox {
  west: number
  south: number
  east: number
  north: number
}

export interface SvgRenderResult {
  svg: string
  bbox: BBox
  count: { Point: number; LineString: number; Polygon: number }
  coords: number
  W: number
  H: number
}

export const escapeXml = (s: string): string =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))

export const fmt = (n: number): number => Math.round(n * 1000) / 1000

/** 递归收集所有坐标，计算 bbox */
export function computeBBox(geo: any): BBox | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  const walk = (c: number[] | number[][]) => {
    if (typeof (c as number[])[0] === 'number') {
      const x = (c as number[])[0]!, y = (c as number[])[1]!
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    } else {
      ;(c as number[][]).forEach(walk)
    }
  }
  const walkGeom = (g: any) => {
    if (!g) return
    switch (g.type) {
      case 'Point':
      case 'MultiPoint':
      case 'LineString':
        walk(g.coordinates); break
      case 'Polygon':
      case 'MultiLineString':
        g.coordinates.forEach((r: number[][]) => walk(r)); break
      case 'MultiPolygon':
        g.coordinates.forEach((p: number[][][]) => p.forEach((r: number[][]) => walk(r))); break
      case 'GeometryCollection':
        g.geometries.forEach(walkGeom); break
    }
  }
  if (geo.type === 'FeatureCollection') geo.features.forEach((f: any) => walkGeom(f.geometry))
  else if (geo.type === 'Feature') walkGeom(geo.geometry)
  else walkGeom(geo)
  if (!isFinite(minX)) return null
  if (minX === maxX) { const d = (Math.abs(minX) * 0.001) || 0.5; minX -= d; maxX += d }
  if (minY === maxY) { const d = (Math.abs(minY) * 0.001) || 0.5; minY -= d; maxY += d }
  return { west: minX, south: minY, east: maxX, north: maxY }
}

/** 统计坐标点个数 */
export function countCoords(geo: any): number {
  let n = 0
  const walk = (c: number[] | number[][]) => {
    if (typeof (c as number[])[0] === 'number') n++
    else (c as number[][]).forEach(walk)
  }
  const walkGeom = (g: any) => {
    if (!g) return
    if (g.type === 'GeometryCollection') g.geometries.forEach(walkGeom)
    else walk(g.coordinates)
  }
  if (geo.type === 'FeatureCollection') geo.features.forEach((f: any) => walkGeom(f.geometry))
  else if (geo.type === 'Feature') walkGeom(geo.geometry)
  else walkGeom(geo)
  return n
}

/** 核心：生成 SVG */
export function generateSVG(geo: any, opt: SvgRenderOptions): SvgRenderResult {
  const bbox = computeBBox(geo)
  if (!bbox) throw new Error('未找到任何有效坐标，请检查输入')

  const W = opt.width, H = opt.height, pad = 30
  const scale = Math.min(
    (W - pad * 2) / (bbox.east - bbox.west),
    (H - pad * 2) / (bbox.north - bbox.south),
  )
  const mapW = (bbox.east - bbox.west) * scale
  const mapH = (bbox.north - bbox.south) * scale
  const ox = (W - mapW) / 2, oy = (H - mapH) / 2

  const tx = (x: number) => ox + (x - bbox.west) * scale
  const ty = (y: number) => oy + (bbox.north - y) * scale
  const pt = (x: number, y: number) => fmt(tx(x)) + ',' + fmt(ty(y))
  const line = `stroke="${opt.lineColor}" stroke-width="${opt.lineWidth}" stroke-linejoin="round" stroke-linecap="round"`
  const halo = opt.bg === 'dark' ? '#0f172a' : '#ffffff'

  const count = { Point: 0, LineString: 0, Polygon: 0 }

  const renderGeom = (g: any): string[] => {
    const arr: string[] = []
    if (!g) return arr
    if (g.type === 'GeometryCollection') { g.geometries.forEach((x: any) => arr.push(...renderGeom(x))); return arr }
    switch (g.type) {
      case 'Point': {
        count.Point++
        const [x, y] = g.coordinates
        arr.push(`<circle cx="${fmt(tx(x))}" cy="${fmt(ty(y))}" r="${opt.pointR}" fill="${opt.pointColor}" stroke="${halo}" stroke-width="${Math.max(0.5, opt.lineWidth * 0.5)}"/>`)
        break
      }
      case 'MultiPoint': {
        count.Point++
        g.coordinates.forEach(([x, y]: [number, number]) =>
          arr.push(`<circle cx="${fmt(tx(x))}" cy="${fmt(ty(y))}" r="${opt.pointR}" fill="${opt.pointColor}" stroke="${halo}" stroke-width="${Math.max(0.5, opt.lineWidth * 0.5)}"/>`),
        )
        break
      }
      case 'LineString': {
        count.LineString++
        if (g.coordinates.length >= 2)
          arr.push(`<polyline points="${g.coordinates.map((p: number[]) => pt(p[0]!, p[1]!)).join(' ')}" fill="none" ${line}/>`)
        break
      }
      case 'MultiLineString': {
        count.LineString++
        g.coordinates.forEach((l: number[][]) => { if (l.length >= 2) arr.push(`<polyline points="${l.map((p: number[]) => pt(p[0]!, p[1]!)).join(' ')}" fill="none" ${line}/>`); })
        break
      }
      case 'Polygon': {
        count.Polygon++
        const rings = g.coordinates.map((r: number[][]) => r.map((p: number[]) => pt(p[0]!, p[1]!)).join(' '))
        arr.push(`<polygon points="${rings.join(' ')}" fill="${opt.fillColor}" fill-opacity="${opt.fillOpacity}" fill-rule="evenodd" ${line}/>`)
        break
      }
      case 'MultiPolygon': {
        count.Polygon++
        g.coordinates.forEach((poly: number[][][]) => {
          const rings = poly.map((r: number[][]) => r.map((p: number[]) => pt(p[0]!, p[1]!)).join(' '))
          arr.push(`<polygon points="${rings.join(' ')}" fill="${opt.fillColor}" fill-opacity="${opt.fillOpacity}" fill-rule="evenodd" ${line}/>`)
        })
        break
      }
    }
    return arr
  }

  const groups: string[] = []
  const wrap = (label: string, arr: string[]) => arr.length ? `<g data-name="${escapeXml(label)}">\n${arr.join('\n')}\n</g>` : ''
  if (geo.type === 'FeatureCollection') {
    geo.features.forEach((f: any, i: number) => {
      const name = (f.properties && (f.properties.name || f.properties.title)) || `要素 ${i + 1}`
      groups.push(wrap(name, renderGeom(f.geometry)))
    })
  } else if (geo.type === 'Feature') {
    const name = (geo.properties && (geo.properties.name || geo.properties.title)) || '要素 1'
    groups.push(wrap(name, renderGeom(geo.geometry)))
  } else {
    groups.push(wrap('数据', renderGeom(geo)))
  }
  const body = groups.filter(Boolean).join('\n')

  const bgFill = opt.bg === 'dark' ? '#0f172a' : '#ffffff'
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${bgFill}"/>`,
    body,
    `</svg>`,
  ].join('\n')

  return { svg, bbox, count, coords: countCoords(geo), W, H }
}
