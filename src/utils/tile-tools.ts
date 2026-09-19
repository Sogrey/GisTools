/* ============================================================
 * 瓦片工具箱 · 核心：瓦片计算 + 需求估算
 * 合并自 doSometing/tile-calculator + tile-estimate
 * ============================================================ */

/* ---- 瓦片计算 ---- */

export function lngToTileX(lng: number, z: number): number {
  return Math.floor((lng + 180) / 360 * Math.pow(2, z))
}

export function latToTileY(lat: number, z: number): number {
  const latRad = lat * Math.PI / 180
  return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z))
}

export function tileXToLng(x: number, z: number): number {
  return x / Math.pow(2, z) * 360 - 180
}

export function tileYToLat(y: number, z: number): number {
  const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z)
  return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
}

export interface TileBounds {
  west: number
  south: number
  east: number
  north: number
}

export function tileBounds(x: number, y: number, z: number): TileBounds {
  return {
    west: tileXToLng(x, z),
    south: tileYToLat(y + 1, z),
    east: tileXToLng(x + 1, z),
    north: tileYToLat(y, z),
  }
}

export function tmsY(xyzY: number, z: number): number {
  return Math.pow(2, z) - 1 - xyzY
}

export function tmsToXyz(tmsYVal: number, z: number): number {
  return Math.pow(2, z) - 1 - tmsYVal
}

export function fmtUrl(template: string, x: number, y: number, z: number): string {
  return template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y)).replace(/\{s\}/g, '1')
}

export const TILE_URLS: Record<string, string> = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  google: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  gaode_s: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}',
  arcgis: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  tdt: 'https://t1.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=KEY',
  tdt_img: 'https://t1.tianditu.gov.cn/img_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=KEY',
  carto: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
}

export const TILE_SRC_NAMES: Record<string, string> = {
  osm: 'OpenStreetMap',
  google: 'Google Maps',
  gaode_s: '高德矢量',
  arcgis: 'ArcGIS 街道',
  tdt: '天地图矢量',
  tdt_img: '天地图影像',
  carto: 'CARTO 浅色',
}

export function multiUrl(x: number, y: number, z: number): string {
  const list: string[] = []
  for (const key of Object.keys(TILE_URLS)) {
    list.push('[' + key + '] ' + fmtUrl(TILE_URLS[key]!, x, y, z))
  }
  return list.join('\n')
}

export interface BoundResult {
  x0: number
  x1: number
  y0: number
  y1: number
  z: number
  count: number
}

export function calcBound(west: number, south: number, east: number, north: number, z: number): BoundResult {
  const x0 = lngToTileX(west, z)
  const x1 = lngToTileX(east, z)
  const y0 = latToTileY(north, z)
  const y1 = latToTileY(south, z)
  return { x0, x1, y0, y1, z, count: (x1 - x0 + 1) * (y1 - y0 + 1) }
}

export function listTiles(b: BoundResult): string[] {
  const lines: string[] = []
  for (let x = b.x0; x <= b.x1; x++) {
    for (let y = b.y0; y <= b.y1; y++) {
      lines.push('https://tile.openstreetmap.org/' + b.z + '/' + x + '/' + y + '.png')
    }
  }
  return lines
}

/* ---- 需求估算 ---- */

/** Web 墨卡托纬度 → 瓦片行号（非线性公式，带纬度钳制） */
export function latToTileYClamped(lat: number, n: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat))
  const rad = clamped * Math.PI / 180
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n
  return Math.floor(y)
}

export interface TileRange {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  count: number
}

export function calcTileRange(lonW: number, latS: number, lonE: number, latN: number, z: number): TileRange {
  const n = Math.pow(2, z)
  let xMin = Math.floor((lonW + 180) / 360 * n)
  let xMax = Math.floor((lonE + 180) / 360 * n)
  let yMin = latToTileYClamped(latN, n)
  let yMax = latToTileYClamped(latS, n)

  xMin = Math.max(0, Math.min(n - 1, xMin))
  xMax = Math.max(0, Math.min(n - 1, xMax))
  yMin = Math.max(0, Math.min(n - 1, yMin))
  yMax = Math.max(0, Math.min(n - 1, yMax))

  return { xMin, xMax, yMin, yMax, count: (xMax - xMin + 1) * (yMax - yMin + 1) }
}

export interface LevelResult {
  z: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
  count: number
  sizeKB: number
  sizeMB: number
  cumKB: number
  cumMB: number
}

export function calcAllLevels(lonW: number, latS: number, lonE: number, latN: number, minZ: number, maxZ: number, avgSizeKB: number): LevelResult[] {
  const results: LevelResult[] = []
  let cumKB = 0
  for (let z = minZ; z <= maxZ; z++) {
    const r = calcTileRange(lonW, latS, lonE, latN, z)
    const levelKB = r.count * avgSizeKB
    cumKB += levelKB
    results.push({
      z, xMin: r.xMin, xMax: r.xMax, yMin: r.yMin, yMax: r.yMax, count: r.count,
      sizeKB: levelKB, sizeMB: levelKB / 1024, cumKB, cumMB: cumKB / 1024,
    })
  }
  return results
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatSizeMB(mb: number): string {
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB'
  if (mb >= 1) return mb.toFixed(2) + ' MB'
  return (mb * 1024).toFixed(2) + ' KB'
}

export function formatTime(seconds: number): string {
  if (seconds < 1) return '< 1 秒'
  if (seconds < 60) return seconds.toFixed(1) + ' 秒'
  const minutes = seconds / 60
  if (minutes < 60) return minutes.toFixed(1) + ' 分钟'
  const hours = minutes / 60
  if (hours < 24) return hours.toFixed(2) + ' 小时'
  const days = hours / 24
  if (days < 30) return days.toFixed(2) + ' 天'
  return (days / 30).toFixed(1) + ' 月'
}

export interface BBoxResult {
  lonW: number
  latS: number
  lonE: number
  latN: number
}

/** 从 GeoJSON 对象提取 BBOX */
export function extractBBoxFromGeoJSON(geojson: any): BBoxResult | null {
  if (geojson && geojson.bbox && Array.isArray(geojson.bbox) && geojson.bbox.length >= 4) {
    return { lonW: geojson.bbox[0], latS: geojson.bbox[1], lonE: geojson.bbox[2], latN: geojson.bbox[3] }
  }

  let minLon = Infinity, minLat = Infinity
  let maxLon = -Infinity, maxLat = -Infinity
  let found = false

  const visitCoords = (coords: any) => {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      found = true
      if (coords[0] < minLon) minLon = coords[0]
      if (coords[0] > maxLon) maxLon = coords[0]
      if (coords[1] < minLat) minLat = coords[1]
      if (coords[1] > maxLat) maxLat = coords[1]
    } else if (Array.isArray(coords)) {
      for (let i = 0; i < coords.length; i++) visitCoords(coords[i])
    }
  }

  if (geojson) {
    if (geojson.type === 'FeatureCollection' && geojson.features) {
      for (let i = 0; i < geojson.features.length; i++) {
        if (geojson.features[i].geometry) visitCoords(geojson.features[i].geometry.coordinates)
      }
    } else if (geojson.type === 'Feature' && geojson.geometry) {
      visitCoords(geojson.geometry.coordinates)
    } else if (geojson.geometry) {
      visitCoords(geojson.geometry.coordinates)
    } else if (geojson.coordinates) {
      visitCoords(geojson.coordinates)
    }
  }

  if (!found || !isFinite(minLon)) return null
  return { lonW: minLon, latS: minLat, lonE: maxLon, latN: maxLat }
}
