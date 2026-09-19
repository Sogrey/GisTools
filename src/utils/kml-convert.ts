/* ============================================================
 * KML ↔ GeoJSON 双向转换纯函数
 * 提取自 doSometing/kml-converter/index.html
 * ============================================================ */

export type Coord = number[]
export type Ring = Coord[]
export type Geometry =
  | { type: 'Point'; coordinates: Coord }
  | { type: 'LineString'; coordinates: Coord[] }
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPoint'; coordinates: Coord[] }
  | { type: 'MultiLineString'; coordinates: Coord[][] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
  | { type: 'GeometryCollection'; geometries: Geometry[] }

export interface Feature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: Geometry | null
}

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

/* ---- 通用工具 ---- */

export function decodeXml(s: string): string {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#10;/g, '\n')
    .replace(/&#13;/g, '\r')
    .replace(/&amp;/g, '&')
}

export function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* 解析坐标元组字符串 "lng,lat[,elev] lng,lat,elev ..." → [[lng,lat(,elev)],...] */
export function parseCoordList(s: string): Coord[] {
  const result: Coord[] = []
  const tokens = String(s).trim().split(/\s+/)
  for (const t of tokens) {
    if (!t) continue
    const parts = t.split(/[,，]/)
    const lng = parseFloat(parts[0]!)
    const lat = parseFloat(parts[1]!)
    if (isNaN(lng) || isNaN(lat)) continue
    const coord: Coord = [lng, lat]
    if (parts.length >= 3) {
      const e = parseFloat(parts[2]!)
      if (!isNaN(e)) coord.push(e)
    }
    result.push(coord)
  }
  return result
}

/* 单点坐标 → [lng,lat(,elev)] */
export function parseCoord(s: string): Coord {
  const list = parseCoordList(s)
  return list.length ? list[0]! : [0, 0]
}

/* 单坐标 → "lng,lat,elev" 字符串（高程缺省 0） */
export function coordToStr(c: Coord): string {
  const lng = c[0]
  const lat = c[1]
  const elev = c.length >= 3 && !isNaN(c[2]!) ? c[2]! : 0
  return lng + ',' + lat + ',' + elev
}

/* 坐标数组 → "lng,lat,elev lng,lat,elev ..." */
export function coordListToStr(list: Coord[]): string {
  return list.map(coordToStr).join(' ')
}

/* ---- KML → GeoJSON ---- */

function extractGeometry(block: string): Geometry | null {
  /* Point */
  const p = block.match(/<Point\b[^>]*>([\s\S]*?)<\/Point>/i)
  if (p) {
    const cm = p[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
    return { type: 'Point', coordinates: cm ? parseCoord(cm[1]!) : [0, 0] } as Geometry
  }

  /* LineString */
  const ls = block.match(/<LineString\b[^>]*>([\s\S]*?)<\/LineString>/i)
  if (ls) {
    const cm2 = ls[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
    return { type: 'LineString', coordinates: cm2 ? parseCoordList(cm2[1]!) : [] } as Geometry
  }

  /* Polygon */
  const pg = block.match(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/i)
  if (pg) {
    const rings: Ring[] = []
    const outer = pg[1]!.match(/<outerBoundaryIs\b[^>]*>([\s\S]*?)<\/outerBoundaryIs>/i)
    if (outer) {
      const lr = outer[1]!.match(/<LinearRing\b[^>]*>([\s\S]*?)<\/LinearRing>/i)
      if (lr) {
        const cm3 = lr[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
        if (cm3) rings.push(parseCoordList(cm3[1]!))
      }
    }
    const innerRe = /<innerBoundaryIs\b[^>]*>([\s\S]*?)<\/innerBoundaryIs>/gi
    let im: RegExpExecArray | null
    while ((im = innerRe.exec(pg[1]!)) !== null) {
      const lr2 = im[1]!.match(/<LinearRing\b[^>]*>([\s\S]*?)<\/LinearRing>/i)
      if (lr2) {
        const cm4 = lr2[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
        if (cm4) rings.push(parseCoordList(cm4[1]!))
      }
    }
    return { type: 'Polygon', coordinates: rings } as Geometry
  }

  /* MultiGeometry → 递归提取子几何 */
  const mg = block.match(/<MultiGeometry\b[^>]*>([\s\S]*?)<\/MultiGeometry>/i)
  if (mg) {
    return extractMultiGeometry(mg[1]!)
  }

  return null
}

function extractMultiGeometry(block: string): Geometry | null {
  const pts: Coord[] = []
  const lss: Coord[][] = []
  const pgs: Ring[][] = []
  let pm: RegExpExecArray | null

  const pre = /<Point\b[^>]*>([\s\S]*?)<\/Point>/gi
  while ((pm = pre.exec(block)) !== null) {
    const cm = pm[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
    if (cm) pts.push(parseCoord(cm[1]!))
  }

  const lsre = /<LineString\b[^>]*>([\s\S]*?)<\/LineString>/gi
  while ((pm = lsre.exec(block)) !== null) {
    const cm2 = pm[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
    if (cm2) lss.push(parseCoordList(cm2[1]!))
  }

  const pgre = /<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/gi
  while ((pm = pgre.exec(block)) !== null) {
    const rings: Ring[] = []
    const outer = pm[1]!.match(/<outerBoundaryIs\b[^>]*>([\s\S]*?)<\/outerBoundaryIs>/i)
    if (outer) {
      const lr = outer[1]!.match(/<LinearRing\b[^>]*>([\s\S]*?)<\/LinearRing>/i)
      if (lr) {
        const cm3 = lr[1]!.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
        if (cm3) rings.push(parseCoordList(cm3[1]!))
      }
    }
    if (rings.length) pgs.push(rings)
  }

  if (pts.length && !lss.length && !pgs.length) return { type: 'MultiPoint', coordinates: pts } as Geometry
  if (lss.length && !pts.length && !pgs.length) return { type: 'MultiLineString', coordinates: lss } as Geometry
  if (pgs.length && !pts.length && !lss.length) return { type: 'MultiPolygon', coordinates: pgs } as Geometry

  /* 混合 → GeometryCollection */
  const geoms: Geometry[] = []
  pts.forEach((c) => geoms.push({ type: 'Point', coordinates: c } as Geometry))
  lss.forEach((c) => geoms.push({ type: 'LineString', coordinates: c } as Geometry))
  pgs.forEach((c) => geoms.push({ type: 'Polygon', coordinates: c } as Geometry))
  if (geoms.length) return { type: 'GeometryCollection', geometries: geoms } as Geometry
  return null
}

export function kmlToGeoJson(kml: string): FeatureCollection {
  if (typeof kml !== 'string') throw new Error('KML 输入需为字符串')
  const features: Feature[] = []
  const placemarkRe = /<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi
  let pm: RegExpExecArray | null
  let count = 0
  while ((pm = placemarkRe.exec(kml)) !== null) {
    count++
    const block = pm[1]!
    const props: Record<string, unknown> = {}
    const nameM = block.match(/<name\b[^>]*>([\s\S]*?)<\/name>/i)
    if (nameM) props['name'] = decodeXml(nameM[1]!.trim())
    const descM = block.match(/<description\b[^>]*>([\s\S]*?)<\/description>/i)
    if (descM) props['description'] = decodeXml(descM[1]!.trim())
    const geom = extractGeometry(block)
    if (geom) {
      features.push({ type: 'Feature', properties: props, geometry: geom })
    }
  }

  if (features.length === 0) {
    /* 无 Placemark，尝试顶层几何 */
    const g = extractGeometry(kml)
    if (g) features.push({ type: 'Feature', properties: {}, geometry: g })
  }

  if (features.length === 0 && count === 0 && kml.indexOf('<Placemark') === -1) {
    throw new Error('未找到 Placemark 或几何元素')
  }

  return { type: 'FeatureCollection', features }
}

/* ---- GeoJSON → KML ---- */

export function normalizeGeoJson(obj: any): FeatureCollection {
  if (!obj || typeof obj !== 'object') throw new Error('GeoJSON 输入需为对象')
  if (obj.type === 'FeatureCollection') {
    if (!Array.isArray(obj.features)) throw new Error('FeatureCollection 缺少 features 数组')
    return obj as FeatureCollection
  }
  if (obj.type === 'Feature') {
    return { type: 'FeatureCollection', features: [obj as Feature] }
  }
  if (obj.type && obj.coordinates) {
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: obj as Geometry }] }
  }
  if (obj.type === 'GeometryCollection' && Array.isArray(obj.geometries)) {
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: obj as Geometry }] }
  }
  throw new Error('无法识别的 GeoJSON（需 FeatureCollection/Feature/Geometry）')
}

function placemarkToKml(f: Feature): string {
  const props = (f && f.properties) || {}
  const geom = f && f.geometry
  const name = props.name != null ? String(props.name) : ''
  const desc = props.description != null ? String(props.description) : ''
  const out: string[] = []
  out.push('  <Placemark>')
  if (name) out.push('    <name>' + escapeXml(name) + '</name>')
  if (desc) out.push('    <description>' + escapeXml(desc) + '</description>')
  const g = geometryToKml(geom)
  if (g) out.push(g)
  out.push('  </Placemark>')
  return out.join('\n')
}

function geometryToKml(geom: Geometry | null): string {
  if (!geom || !geom.type) return ''
  const t = geom.type
  const c = (geom as any).coordinates
  if (t === 'Point') {
    return '    <Point><coordinates>' + coordToStr(c) + '</coordinates></Point>'
  }
  if (t === 'LineString') {
    return '    <LineString><coordinates>' + coordListToStr(c) + '</coordinates></LineString>'
  }
  if (t === 'Polygon') {
    const rings: Ring[] = c || []
    let s = '    <Polygon>'
    if (rings.length > 0) {
      s += '<outerBoundaryIs><LinearRing><coordinates>' + coordListToStr(rings[0]!) + '</coordinates></LinearRing></outerBoundaryIs>'
    }
    for (let i = 1; i < rings.length; i++) {
      s += '<innerBoundaryIs><LinearRing><coordinates>' + coordListToStr(rings[i]!) + '</coordinates></LinearRing></innerBoundaryIs>'
    }
    s += '</Polygon>'
    return s
  }
  if (t === 'MultiPoint') {
    let mp = '    <MultiGeometry>'
    for (let i = 0; i < c.length; i++) mp += '<Point><coordinates>' + coordToStr(c[i]) + '</coordinates></Point>'
    mp += '</MultiGeometry>'
    return mp
  }
  if (t === 'MultiLineString') {
    let ml = '    <MultiGeometry>'
    for (let i = 0; i < c.length; i++) ml += '<LineString><coordinates>' + coordListToStr(c[i]) + '</coordinates></LineString>'
    ml += '</MultiGeometry>'
    return ml
  }
  if (t === 'MultiPolygon') {
    let mpoly = '    <MultiGeometry>'
    for (let i = 0; i < c.length; i++) {
      const rings: Ring[] = c[i] || []
      let ps = '<Polygon>'
      if (rings.length > 0) ps += '<outerBoundaryIs><LinearRing><coordinates>' + coordListToStr(rings[0]!) + '</coordinates></LinearRing></outerBoundaryIs>'
      for (let j = 1; j < rings.length; j++) ps += '<innerBoundaryIs><LinearRing><coordinates>' + coordListToStr(rings[j]!) + '</coordinates></LinearRing></innerBoundaryIs>'
      ps += '</Polygon>'
      mpoly += ps
    }
    mpoly += '</MultiGeometry>'
    return mpoly
  }
  if (t === 'GeometryCollection' && Array.isArray((geom as any).geometries)) {
    let gc = '    <MultiGeometry>'
    for (const sg of (geom as any).geometries) {
      const sub = geometryToKml(sg as Geometry)
      if (sub) gc += sub.replace(/^\s+/, '')
    }
    gc += '</MultiGeometry>'
    return gc
  }
  return ''
}

export function geoJsonToKml(input: any): string {
  const fc = normalizeGeoJson(input)
  const lines: string[] = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2">')
  lines.push('<Document>')
  for (const f of fc.features) {
    if (!f) continue
    const pl = placemarkToKml(f)
    if (pl) lines.push(pl)
  }
  lines.push('</Document>')
  lines.push('</kml>')
  return lines.join('\n')
}

/* ---- 方向识别 ---- */
export function detectDirection(text: string): 'kml2geojson' | 'geojson2kml' | 'unknown' {
  const t = String(text ?? '').trim()
  if (!t) return 'unknown'
  if (t.charAt(0) === '<') return 'kml2geojson'
  if (t.charAt(0) === '{') return 'geojson2kml'
  return 'unknown'
}

/* ---- 统计辅助 ---- */
export function countVertices(fc: FeatureCollection): number {
  let n = 0
  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Point') n++
    else if (g.type === 'MultiPoint') n += g.coordinates.length
    else if (g.type === 'LineString') n += g.coordinates.length
    else if (g.type === 'MultiLineString') g.coordinates.forEach((c) => (n += c.length))
    else if (g.type === 'Polygon') g.coordinates.forEach((r) => (n += r.length))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => (n += r.length)))
    else if (g.type === 'GeometryCollection') g.geometries.forEach(() => n++)
  }
  return n
}
