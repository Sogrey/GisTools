/* ============================================================
 * GeoHash 编解码器 · 核心算法
 * 经纬度↔GeoHash 双向，精度 1-12，bbox+邻居
 * 提取自 doSometing/geohash-tool/index.html
 * ============================================================ */

export const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
const LAT_MIN = -90, LAT_MAX = 90, LNG_MIN = -180, LNG_MAX = 180

export function geohashEncode(lat: number, lng: number, precision: number): string {
  lat = Number(lat)
  lng = Number(lng)
  precision = Math.round(Number(precision))
  if (!isFinite(lat) || !isFinite(lng)) throw new Error('经纬度必须是有效数字')
  if (lat < LAT_MIN || lat > LAT_MAX) throw new Error('纬度超出范围（-90 ~ 90）')
  if (lng < LNG_MIN || lng > LNG_MAX) throw new Error('经度超出范围（-180 ~ 180）')
  if (precision < 1 || precision > 12) throw new Error('精度需在 1 ~ 12 之间')

  let latLo = LAT_MIN, latHi = LAT_MAX
  let lngLo = LNG_MIN, lngHi = LNG_MAX
  let hash = ''
  let bits = 0, count = 0
  let isLng = true

  for (let i = 0; i < precision * 5; i++) {
    if (isLng) {
      const mid = (lngLo + lngHi) / 2
      if (lng >= mid) { bits = (bits << 1) | 1; lngLo = mid } else { bits = bits << 1; lngHi = mid }
    } else {
      const mid = (latLo + latHi) / 2
      if (lat >= mid) { bits = (bits << 1) | 1; latLo = mid } else { bits = bits << 1; latHi = mid }
    }
    isLng = !isLng
    if (++count === 5) {
      hash += BASE32[bits]
      bits = 0
      count = 0
    }
  }
  return hash
}

export interface GeoHashDecode {
  hash: string
  center: { lat: number; lng: number }
  bbox: { latMin: number; latMax: number; lngMin: number; lngMax: number }
}

export function geohashDecode(hash: string): GeoHashDecode {
  hash = String(hash).toLowerCase().trim()
  if (!hash) throw new Error('请输入 GeoHash 字符串')
  if (hash.length < 1 || hash.length > 12) throw new Error('GeoHash 长度需为 1 ~ 12 位')
  if (!/^[0123456789bcdefghjkmnpqrstuvwxyz]+$/.test(hash))
    throw new Error('包含非法字符（仅限 0-9 b c d e f g h j k m n p q r s t u v w x y z）')

  let latLo = LAT_MIN, latHi = LAT_MAX
  let lngLo = LNG_MIN, lngHi = LNG_MAX
  let isLng = true

  for (let i = 0; i < hash.length; i++) {
    const v = BASE32.indexOf(hash[i]!)
    for (let b = 4; b >= 0; b--) {
      const bit = (v >> b) & 1
      if (isLng) {
        const mid = (lngLo + lngHi) / 2
        if (bit) lngLo = mid
        else lngHi = mid
      } else {
        const mid = (latLo + latHi) / 2
        if (bit) latLo = mid
        else latHi = mid
      }
      isLng = !isLng
    }
  }
  return {
    hash,
    center: { lat: (latLo + latHi) / 2, lng: (lngLo + lngHi) / 2 },
    bbox: { latMin: latLo, latMax: latHi, lngMin: lngLo, lngMax: lngHi },
  }
}

export interface Neighbors {
  N: string; NE: string; E: string; SE: string
  S: string; SW: string; W: string; NW: string
}

export function geohashNeighbors(hash: string): Neighbors {
  const d = geohashDecode(hash)
  const latSpan = d.bbox.latMax - d.bbox.latMin
  const lngSpan = d.bbox.lngMax - d.bbox.lngMin
  const latC = d.center.lat, lngC = d.center.lng
  const p = hash.length

  const clampLat = (v: number) => Math.min(LAT_MAX, Math.max(LAT_MIN, v))
  const clampLng = (v: number) => Math.min(LNG_MAX, Math.max(LNG_MIN, v))

  const dirs: Record<string, { lat: number; lng: number }> = {
    N: { lat: latSpan, lng: 0 },
    NE: { lat: latSpan, lng: lngSpan },
    E: { lat: 0, lng: lngSpan },
    SE: { lat: -latSpan, lng: lngSpan },
    S: { lat: -latSpan, lng: 0 },
    SW: { lat: -latSpan, lng: -lngSpan },
    W: { lat: 0, lng: -lngSpan },
    NW: { lat: latSpan, lng: -lngSpan },
  }

  const out = {} as Neighbors
  for (const key of Object.keys(dirs)) {
    const t = dirs[key]!
    out[key as keyof Neighbors] = geohashEncode(clampLat(latC + t.lat), clampLng(lngC + t.lng), p)
  }
  return out
}

export interface PrecisionRow {
  n: number
  bits: number
  latDeg: number
  lngDeg: number
  size: string
}

export function precisionTable(): PrecisionRow[] {
  const rows: PrecisionRow[] = []
  for (let n = 1; n <= 12; n++) {
    const latBits = Math.floor((5 * n) / 2)
    const lngBits = Math.ceil((5 * n) / 2)
    const latDeg = 180 / Math.pow(2, latBits)
    const lngDeg = 360 / Math.pow(2, lngBits)
    rows.push({ n, bits: n * 5, latDeg, lngDeg, size: kmFmt(latDeg) + ' × ' + kmFmt(lngDeg) })
  }
  return rows
}

function kmFmt(deg: number): string {
  const d = deg * 111.32
  if (d >= 100) return d.toFixed(0) + 'km'
  if (d >= 1) return d.toFixed(1) + 'km'
  const m = d * 1000
  if (m >= 1) return m.toFixed(1) + 'm'
  return (m * 100).toFixed(1) + 'cm'
}
