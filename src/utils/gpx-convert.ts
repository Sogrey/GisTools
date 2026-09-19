/* ============================================================
 * GPX ↔ GeoJSON 互转 · GPX 轨迹统计纯函数
 * 提取自 doSometing/gpx-toolbox/index.html
 * ============================================================ */

import { haversine } from './geo-math'

type Coord = number[]

export interface Feature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: any
}

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

/* ---- 通用工具 ---- */

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i')
  const m = attrs.match(re)
  return m ? m[1]!.trim() : null
}

function getTag(inner: string, name: string): string | null {
  const re = new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i')
  const m = inner.match(re)
  return m ? decodeXml(m[1]!.trim()) : null
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/* ---- 格式探测 ---- */

export function detectFormat(text: string): 'gpx' | 'geojson' | 'unknown' {
  const t = text.trim()
  if (!t) return 'unknown'
  if (/^\s*</.test(t) && /<gpx\b/i.test(t)) return 'gpx'
  if (/^\s*[{[]/.test(t)) {
    try {
      const obj = JSON.parse(t)
      if (obj && (obj.type === 'FeatureCollection' || obj.type === 'Feature' ||
        obj.type === 'Point' || obj.type === 'LineString' || obj.type === 'Polygon' ||
        obj.type === 'MultiPoint' || obj.type === 'MultiLineString' || obj.type === 'MultiPolygon')) {
        return 'geojson'
      }
      if (obj && obj.features) return 'geojson'
    } catch { /* ignore */ }
    return 'geojson'
  }
  if (/<gpx\b/i.test(t)) return 'gpx'
  return 'unknown'
}

/* ---- GPX → GeoJSON ---- */

export function gpxToGeoJson(gpxText: string): FeatureCollection {
  const features: Feature[] = []
  let m: RegExpExecArray | null

  /* --- 航点 wpt --- */
  const wptRe = /<wpt\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/wpt>)/gi
  while ((m = wptRe.exec(gpxText)) !== null) {
    const attrs = m[1]!
    const inner = m[2] || ''
    const lat = parseFloat(getAttr(attrs, 'lat') || '')
    const lon = parseFloat(getAttr(attrs, 'lon') || '')
    if (isNaN(lat) || isNaN(lon)) continue
    const props: Record<string, unknown> = {}
    const name = getTag(inner, 'name')
    const ele = getTag(inner, 'ele')
    const time = getTag(inner, 'time')
    const desc = getTag(inner, 'desc')
    const sym = getTag(inner, 'sym')
    if (name) props.name = name
    if (ele !== null) props.ele = parseFloat(ele)
    if (time) props.time = time
    if (desc) props.desc = desc
    if (sym) props.sym = sym
    const coord: Coord = [lon, lat]
    if (ele !== null) coord.push(parseFloat(ele))
    features.push({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: coord } })
  }

  /* --- 轨迹 trk/trkseg/trkpt --- */
  const trkRe = /<trk\b([^>]*)>([\s\S]*?)<\/trk>/gi
  while ((m = trkRe.exec(gpxText)) !== null) {
    const trkInner = m[2]!
    const trkName = getTag(trkInner, 'name')
    const trkDesc = getTag(trkInner, 'desc')
    const segRe = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi
    let segM: RegExpExecArray | null
    while ((segM = segRe.exec(trkInner)) !== null) {
      const segInner = segM[1]!
      const coords: Coord[] = []
      const times: string[] = []
      const ptRe = /<trkpt\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/trkpt>)/gi
      let ptM: RegExpExecArray | null
      while ((ptM = ptRe.exec(segInner)) !== null) {
        const ptAttrs = ptM[1]!
        const ptInner = ptM[2] || ''
        const ptLat = parseFloat(getAttr(ptAttrs, 'lat') || '')
        const ptLon = parseFloat(getAttr(ptAttrs, 'lon') || '')
        if (isNaN(ptLat) || isNaN(ptLon)) continue
        const ptEle = getTag(ptInner, 'ele')
        const ptTime = getTag(ptInner, 'time')
        const coord: Coord = [ptLon, ptLat]
        if (ptEle !== null) coord.push(parseFloat(ptEle))
        coords.push(coord)
        if (ptTime) times.push(ptTime)
      }
      if (coords.length > 0) {
        const props: Record<string, unknown> = {}
        if (trkName) props.name = trkName
        if (trkDesc) props.desc = trkDesc
        if (times.length > 0) props.times = times
        features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } })
      }
    }
  }

  /* --- 路由 rte/rtept --- */
  const rteRe = /<rte\b([^>]*)>([\s\S]*?)<\/rte>/gi
  while ((m = rteRe.exec(gpxText)) !== null) {
    const rteInner = m[2]!
    const rteName = getTag(rteInner, 'name')
    const coords: Coord[] = []
    const rtePtRe = /<rtept\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/rtept>)/gi
    let rtePtM: RegExpExecArray | null
    while ((rtePtM = rtePtRe.exec(rteInner)) !== null) {
      const rtePtAttrs = rtePtM[1]!
      const rtePtLat = parseFloat(getAttr(rtePtAttrs, 'lat') || '')
      const rtePtLon = parseFloat(getAttr(rtePtAttrs, 'lon') || '')
      if (isNaN(rtePtLat) || isNaN(rtePtLon)) continue
      const rtePtInner = rtePtM[2] || ''
      const rtePtEle = getTag(rtePtInner, 'ele')
      const coord: Coord = [rtePtLon, rtePtLat]
      if (rtePtEle !== null) coord.push(parseFloat(rtePtEle))
      coords.push(coord)
    }
    if (coords.length > 0) {
      const props: Record<string, unknown> = {}
      if (rteName) props.name = rteName
      features.push({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } })
    }
  }

  return { type: 'FeatureCollection', features }
}

/* ---- GeoJSON → GPX ---- */

function buildWpt(lat: number, lon: number, ele: number | null, props: Record<string, unknown>): string {
  let s = '  <wpt lat="' + lat + '" lon="' + lon + '">\n'
  if (props.name) s += '    <name>' + escapeXml(String(props.name)) + '</name>\n'
  if (ele !== null && ele !== undefined && !isNaN(ele)) s += '    <ele>' + ele + '</ele>\n'
  if (props.time) s += '    <time>' + props.time + '</time>\n'
  if (props.desc) s += '    <desc>' + escapeXml(String(props.desc)) + '</desc>\n'
  if (props.sym) s += '    <sym>' + escapeXml(String(props.sym)) + '</sym>\n'
  s += '  </wpt>\n'
  return s
}

function buildTrkSeg(coords: Coord[], times: string[] | undefined): string {
  let s = '    <trkseg>\n'
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i]!
    const lon = c[0], lat = c[1]
    const ele = c.length > 2 ? c[2] : null
    s += '      <trkpt lat="' + lat + '" lon="' + lon + '">\n'
    if (ele !== null && ele !== undefined && !isNaN(ele)) s += '        <ele>' + ele + '</ele>\n'
    if (times && times[i]) s += '        <time>' + times[i] + '</time>\n'
    s += '      </trkpt>\n'
  }
  s += '    </trkseg>\n'
  return s
}

function buildTrk(name: string, segXml: string): string {
  let s = '  <trk>\n'
  if (name) s += '    <name>' + escapeXml(name) + '</name>\n'
  s += segXml
  s += '  </trk>\n'
  return s
}

export function geoJsonToGpx(geoJson: any): string {
  if (typeof geoJson === 'string') geoJson = JSON.parse(geoJson)
  const features = geoJson.features || (geoJson.type === 'Feature' ? [geoJson] : [])
  const wpts: string[] = []
  const trks: string[] = []

  for (const f of features) {
    const geom = f.geometry
    if (!geom) continue
    const props = f.properties || {}
    const name = props.name || ''
    const gtype = geom.type

    if (gtype === 'Point') {
      const lon = geom.coordinates[0]
      const lat = geom.coordinates[1]
      const ele = (geom.coordinates.length > 2 && geom.coordinates[2] !== null && geom.coordinates[2] !== undefined)
        ? geom.coordinates[2] : (props.ele !== undefined ? props.ele : null)
      wpts.push(buildWpt(lat, lon, ele, props))
    } else if (gtype === 'MultiPoint') {
      for (const c of geom.coordinates) {
        const ele = (c.length > 2 ? c[2] : null) || (props.ele !== undefined ? props.ele : null)
        wpts.push(buildWpt(c[1], c[0], ele, props))
      }
    } else if (gtype === 'LineString') {
      trks.push(buildTrk(name, buildTrkSeg(geom.coordinates, props.times)))
    } else if (gtype === 'MultiLineString') {
      let segs = ''
      for (const line of geom.coordinates) segs += buildTrkSeg(line, props.times)
      trks.push(buildTrk(name, segs))
    } else if (gtype === 'Polygon') {
      const ring = geom.coordinates[0] || []
      trks.push(buildTrk(name, buildTrkSeg(ring, props.times)))
    } else if (gtype === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        const ring = poly[0] || []
        trks.push(buildTrk(name, buildTrkSeg(ring, props.times)))
      }
    }
  }

  const now = new Date().toISOString()
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<gpx version="1.1" creator="gpx-converter" xmlns="http://www.topografix.com/GPX/1/1">\n'
  xml += '  <metadata><time>' + now + '</time></metadata>\n'
  for (const w of wpts) xml += w
  for (const t of trks) xml += t
  xml += '</gpx>'
  return xml
}

/* ==================== GPX 轨迹统计 ==================== */

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  return haversine(lng1, lat1, lng2, lat2) / 1000
}

export interface GpxPoint {
  lat: number
  lon: number
  ele: number | null
  time: number | null
}

export interface GpxStats {
  points: number
  dist: number
  climb: number
  drop: number
  eleMax: number | null
  eleMin: number | null
  eleAvg: number | null
  durationS: number | null
  speed: number | null
  avgSpeed: number | null
}

export function parseGpx(gpx: string): GpxPoint[] {
  const pts: GpxPoint[] = []
  const trkRe = /<trkpt[^>]*>([\s\S]*?)<\/trkpt>/gi
  let m: RegExpExecArray | null
  while ((m = trkRe.exec(gpx)) !== null) {
    const tag = m[0]
    const lat = parseFloat((tag.match(/lat="([-+]?\d+\.?\d*)"/) || [])[1]!)
    const lon = parseFloat((tag.match(/lon="([-+]?\d+\.?\d*)"/) || [])[1]!)
    if (isNaN(lat) || isNaN(lon)) continue
    const inner = m[1]!
    const eleM = inner.match(/<ele[^>]*>([\d.+-]+)<\/ele>/i)
    const timeM = inner.match(/<time[^>]*>([\d\-:TZ\.]+)<\/time>/i)
    pts.push({
      lat,
      lon,
      ele: eleM ? parseFloat(eleM[1]!) : null,
      time: timeM ? Date.parse(timeM[1]!) : null,
    })
  }
  return pts
}

export function analyze(pts: GpxPoint[]): GpxStats {
  let dist = 0, climb = 0, drop = 0, eleMax = -Infinity, eleMin = Infinity, eleSum = 0, eleN = 0
  let t0: number | null = null, t1: number | null = null

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!
    if (p.ele !== null) {
      if (p.ele > eleMax) eleMax = p.ele
      if (p.ele < eleMin) eleMin = p.ele
      eleSum += p.ele
      eleN++
    }
    if (p.time !== null) {
      if (t0 === null) t0 = p.time
      t1 = p.time
    }
    if (i > 0) {
      const prev = pts[i - 1]!
      dist += haversineKm(prev.lon, prev.lat, p.lon, p.lat)
      if (p.ele !== null && prev.ele !== null) {
        const d = p.ele - prev.ele
        if (d > 0) climb += d
        else drop += -d
      }
    }
  }

  const durationS = t0 !== null && t1 !== null ? (t1 - t0) / 1000 : null
  const speedKph = durationS && durationS > 0 ? dist / (durationS / 3600) : null
  const avgSpeed = durationS ? dist / (durationS / 3600) : null

  return {
    points: pts.length,
    dist,
    climb,
    drop,
    eleMax: eleMax === -Infinity ? null : eleMax,
    eleMin: eleMin === Infinity ? null : eleMin,
    eleAvg: eleN ? eleSum / eleN : null,
    durationS,
    speed: speedKph,
    avgSpeed,
  }
}

/* ---- 统计辅助 ---- */

export function countPoints(fc: FeatureCollection): number {
  let n = 0
  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Point') n += 1
    else if (g.type === 'MultiPoint') n += g.coordinates.length
    else if (g.type === 'LineString') n += g.coordinates.length
    else if (g.type === 'MultiLineString') g.coordinates.forEach((l: Coord[]) => (n += l.length))
    else if (g.type === 'Polygon') g.coordinates.forEach((r: Coord[]) => (n += r.length))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p: Coord[][]) => p.forEach((r: Coord[]) => (n += r.length)))
  }
  return n
}
