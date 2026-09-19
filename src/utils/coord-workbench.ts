/* ============================================================
 * 坐标转换工作台 · 核心算法
 * 坐标：WGS84/GCJ02/BD09/WebMercator/高斯/UTM/ECEF
 * 椭球：CGCS2000/WGS84/西安80/北京54
 * 提取自 doSometing/gis-coordinate-workbench/index.html
 * ============================================================ */

import { wgs84ToGcj02, gcj02ToWgs84 as _gcj02ToWgs84, gcj02ToBd09, bd09ToGcj02 } from './coord-transform'

const PI = Math.PI
const MERC = 20037508.342789244
const FAKE_EAST = 500000
const UTM_K0 = 0.9996
const UTM_FAKE_NORTH = 10000000

export interface Ellipsoid {
  name: string
  a: number
  f: number
}

export const ELLIPSOIDS: Record<string, Ellipsoid> = {
  cgcs2000: { name: 'CGCS2000', a: 6378137.0, f: 1 / 298.257222101 },
  wgs84: { name: 'WGS84', a: 6378137.0, f: 1 / 298.257223563 },
  xian80: { name: '西安80', a: 6378140.0, f: 1 / 298.257 },
  beijing54: { name: '北京54', a: 6378245.0, f: 1 / 298.3 },
}

export type Srid = 'wgs84' | 'gcj02' | 'bd09' | 'webm' | 'gauss' | 'utm' | 'ecef'

export interface ConvertOptions {
  ell?: string
  bandType?: string
  south?: boolean
}

export interface ConvertResult {
  ok: boolean
  src?: string
  out?: { a: number; b: number; c: number; label: string; band?: number }
  wgs?: [number, number]
  err?: string
}

function ellE2(ell: Ellipsoid): number {
  return ell.f * (2 - ell.f)
}
function ellEp2(ell: Ellipsoid): number {
  const e2 = ellE2(ell)
  return e2 / (1 - e2)
}
function toRad(d: number): number {
  return (d * PI) / 180
}
function toDeg(r: number): number {
  return (r * 180) / PI
}
/* ---------- WGS84 <-> GCJ02 / BD09（复用 coord-transform 底座） ---------- */
export { wgs84ToGcj02, gcj02ToBd09, bd09ToGcj02 }

/** GCJ02 → WGS84，迭代反解（默认 3 次，保持本模块历史接口）。 */
export function gcj02ToWgs84(lng: number, lat: number, iter = 3): [number, number] {
  return _gcj02ToWgs84(lng, lat, iter)
}

/* ---------- Web 墨卡托 ---------- */
export function wgs84ToWebMercator(lng: number, lat: number): [number, number] {
  const x = (lng * MERC) / 180
  const y = (Math.log(Math.tan(((90 + lat) * PI) / 360)) / (PI / 180)) * (MERC / 180)
  return [x, y]
}
export function webMercatorToWgs84(x: number, y: number): [number, number] {
  let lng = (x / MERC) * 180
  let lat = (y / MERC) * 180
  lat = (180 / PI) * (2 * Math.atan(Math.exp((lat * PI) / 180)) - PI / 2)
  return [lng, lat]
}

/* ---------- 高斯克吕格 ---------- */
export function gaussBand3(lng: number): number {
  return Math.floor((lng + 1.5) / 3)
}
export function gaussBand6(lng: number): number {
  return Math.floor(lng / 6) + 1
}
export function gaussCM3(band: number): number {
  return band * 3
}
export function gaussCM6(band: number): number {
  return band * 6 - 3
}

function meridianArc(ell: Ellipsoid, b: number): number {
  const e2 = ellE2(ell)
  const e4 = e2 * e2, e6 = e4 * e2
  const m0 = 1 - e2 / 4 - (3 * e4) / 64 - (5 * e6) / 256
  const m2 = (3 * (e2 + e4 / 4 + (15 * e6) / 128)) / 8
  const m4 = (15 * (e4 + (3 * e6) / 4)) / 256
  const m6 = (35 * e6) / 3072
  return ell.a * (m0 * b - (m2 * Math.sin(2 * b)) / 2 + (m4 * Math.sin(4 * b)) / 4 - (m6 * Math.sin(6 * b)) / 8)
}
function meridianArcD(ell: Ellipsoid, b: number): number {
  const s = Math.sin(b)
  return (ell.a * (1 - ellE2(ell))) / Math.pow(1 - ellE2(ell) * s * s, 1.5)
}

export function gaussForward(lng: number, lat: number, cm: number, ell: Ellipsoid): { x: number; y: number } {
  const b = toRad(lat)
  const l = toRad(lng - cm)
  const e2 = ellE2(ell)
  const ep2 = ellEp2(ell)
  const sinB = Math.sin(b), cosB = Math.cos(b)
  const t = Math.tan(b)
  const eta2 = ep2 * cosB * cosB
  const N = ell.a / Math.sqrt(1 - e2 * sinB * sinB)
  const l2 = l * l, l3 = l2 * l, l4 = l3 * l, l5 = l4 * l, l6 = l5 * l
  const x =
    meridianArc(ell, b) +
    (N / 2) * sinB * cosB * l2 +
    (N / 24) * sinB * Math.pow(cosB, 3) * (5 - t * t + 9 * eta2 + 4 * eta2 * eta2) * l4 +
    (N / 720) * sinB * Math.pow(cosB, 5) * (61 - 58 * t * t + t * t * t * t) * l6
  const y =
    N * cosB * l +
    (N / 6) * Math.pow(cosB, 3) * (1 - t * t + eta2) * l3 +
    (N / 120) * Math.pow(cosB, 5) * (5 - 18 * t * t + t * t * t * t + 14 * eta2 - 58 * eta2 * t * t) * l5
  return { x, y }
}

export function gaussInverse(x: number, y: number, cm: number, ell: Ellipsoid): [number, number] {
  const e2 = ellE2(ell)
  const ep2 = ellEp2(ell)
  let bf = (x / ell.a) * 1.0000001
  for (let i = 0; i < 30; i++) {
    const f = meridianArc(ell, bf) - x
    const fp = meridianArcD(ell, bf)
    const nb = bf - f / fp
    if (Math.abs(nb - bf) < 1e-15) {
      bf = nb
      break
    }
    bf = nb
  }
  const sinB = Math.sin(bf), cosB = Math.cos(bf)
  const t = Math.tan(bf)
  const eta2 = ep2 * cosB * cosB
  const V2 = 1 + eta2
  const N = ell.a / Math.sqrt(1 - e2 * sinB * sinB)
  const m = y / N
  const m2 = m * m, m3 = m2 * m, m4 = m3 * m, m5 = m4 * m, m6 = m5 * m
  const lat =
    bf -
    (t / (2 * V2)) * m2 +
    (t / (24 * V2 * V2)) * (5 + 3 * t * t + eta2 - 9 * eta2 * t * t) * m4 -
    (t / (720 * V2 * V2 * V2)) * (61 + 90 * t * t + 45 * t * t * t * t) * m6
  const lng =
    toRad(cm) +
    (1 / cosB) * m -
    (1 / (6 * cosB * V2)) * (1 + 2 * t * t + eta2) * m3 +
    (1 / (120 * cosB * V2 * V2)) * (5 + 28 * t * t + 24 * t * t * t * t + 6 * eta2 + 8 * eta2 * t * t) * m5
  return [toDeg(lng), toDeg(lat)]
}

/* ---------- UTM ---------- */
export function utmZone(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1
}
export function utmCM(zone: number): number {
  return -180 + zone * 6 - 3
}
export function wgs84ToUtm(lng: number, lat: number): { zone: number; east: number; north: number } {
  const zone = utmZone(lng)
  const ell = ELLIPSOIDS.wgs84!
  const g = gaussForward(lng, lat, utmCM(zone), ell)
  const east = g.y * UTM_K0 + 500000
  let north = g.x * UTM_K0
  if (lat < 0) north += 10000000
  return { zone, east, north }
}
export function utmToWgs84(east: number, north: number, zone: number, south: boolean): [number, number] {
  const y = (east - 500000) / UTM_K0
  let x = north / UTM_K0
  if (south) x = (north - 10000000) / UTM_K0
  return gaussInverse(x, y, utmCM(zone), ELLIPSOIDS.wgs84!)
}

/* ---------- ECEF ---------- */
export function wgs84ToEcef(lng: number, lat: number, h: number, ell: Ellipsoid): [number, number, number] {
  const e2 = ellE2(ell)
  const b = toRad(lat), l = toRad(lng)
  const sinB = Math.sin(b), cosB = Math.cos(b)
  const N = ell.a / Math.sqrt(1 - e2 * sinB * sinB)
  return [(N + h) * cosB * Math.cos(l), (N + h) * cosB * Math.sin(l), (N * (1 - e2) + h) * sinB]
}
export function ecefToWgs84(x: number, y: number, z: number, ell: Ellipsoid): [number, number, number] {
  const e2 = ellE2(ell)
  const lng = toDeg(Math.atan2(y, x))
  const p = Math.sqrt(x * x + y * y)
  let lat = Math.atan2(z, p * (1 - e2))
  let h = 0
  for (let i = 0; i < 8; i++) {
    const sinB = Math.sin(lat)
    const N = ell.a / Math.sqrt(1 - e2 * sinB * sinB)
    h = p / Math.cos(lat) - N
    lat = Math.atan2(z, p * (1 - (e2 * N) / (N + h)))
  }
  return [lng, toDeg(lat), h]
}

/* ---------- Vincenty 反解 ---------- */
export function vincenty(lng1: number, lat1: number, lng2: number, lat2: number): { dist: number; az1: number; az2: number } {
  const a = 6378137.0, f = 1 / 298.257223563, b = a * (1 - f)
  const L = toRad(lng2 - lng1)
  const U1 = Math.atan((1 - f) * Math.tan(toRad(lat1)))
  const U2 = Math.atan((1 - f) * Math.tan(toRad(lat2)))
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1)
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2)
  let lam = L, lamPrev: number, iter = 0
  let sinAlpha = 0, cosSqAlpha = 1, cos2SigmaM = 0, sigma = 0, sinSigma = 0, cosSigma = 1, C = 0
  do {
    const sinLam = Math.sin(lam), cosLam = Math.cos(lam)
    sinSigma = Math.sqrt(
      cosU2 * sinLam * (cosU2 * sinLam) +
        (cosU1 * sinU2 - sinU1 * cosU2 * cosLam) * (cosU1 * sinU2 - sinU1 * cosU2 * cosLam),
    )
    if (sinSigma === 0) return { dist: 0, az1: 0, az2: 0 }
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLam
    sigma = Math.atan2(sinSigma, cosSigma)
    sinAlpha = (cosU1 * cosU2 * sinLam) / sinSigma
    cosSqAlpha = 1 - sinAlpha * sinAlpha
    cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha
    if (!isFinite(cos2SigmaM)) cos2SigmaM = 0
    C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha))
    lamPrev = lam
    lam = L + (1 - C) * f * sinAlpha * (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)))
  } while (Math.abs(lam - lamPrev) > 1e-12 && ++iter < 200)
  const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b)
  const A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)))
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)))
  const dSigma =
    B *
    sinSigma *
    (cos2SigmaM + (B / 4) * (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) - (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma * sinSigma) * (-3 + 4 * cos2SigmaM * cos2SigmaM)))
  const s = b * A * (sigma - dSigma)
  let az1 = toDeg(Math.atan2(cosU2 * Math.sin(lam), cosU1 * sinU2 - sinU1 * cosU2 * Math.cos(lam)))
  let az2 = toDeg(Math.atan2(cosU1 * Math.sin(lam), -sinU1 * cosU2 + cosU1 * sinU2 * Math.cos(lam)))
  if (az1 < 0) az1 += 360
  if (az2 < 0) az2 += 360
  return { dist: s, az1, az2 }
}

export function haversineKm(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const R = 6371.0088
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(a))
}

/* ---------- 格式化 ---------- */
export function num(v: number): string {
  if (!isFinite(v)) return '—'
  let s = v.toFixed(7)
  s = s.replace(/\.?0+$/, '')
  if (s === '' || s === '-') s = '0'
  return s
}
export function toDMS(v: number, kind: 'lng' | 'lat'): string {
  const sign = v < 0 ? '-' : ''
  v = Math.abs(v)
  let d = Math.floor(v)
  const mf = (v - d) * 60
  let m = Math.floor(mf)
  let s = (mf - m) * 60
  s = Math.round(s * 1000) / 1000
  if (s >= 60) {
    s -= 60
    m++
  }
  if (m >= 60) {
    m -= 60
    d++
  }
  let sf = s.toFixed(3).replace(/\.?0+$/, '')
  if (sf === '') sf = '0'
  let dir = ''
  if (kind === 'lng') dir = v >= 0 ? 'E' : 'W'
  if (kind === 'lat') dir = v >= 0 ? 'N' : 'S'
  return sign + d + '°' + m + '′' + sf + '″' + dir
}
export function fmtLngLat(lng: number, lat: number, dms: boolean): string {
  if (dms) return toDMS(lng, 'lng') + ' ' + toDMS(lat, 'lat')
  return num(lng) + ', ' + num(lat)
}
function fmtXY(x: number, y: number): string {
  return num(x) + ' ' + num(y)
}
function fmtXYZ(x: number, y: number, z: number): string {
  return num(x) + ' ' + num(y) + ' ' + num(z)
}

/* ---------- 解析器 ---------- */
function normalizeLine(line: string): string {
  return line
    .replace(/[″"′']/g, ' ')
    .replace(/[°度]/g, ' ')
    .replace(/[分秒]/g, ' ')
    .replace(/[：:]/g, ' ')
    .replace(/[,，;；|\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function isNumericToken(t: string): boolean {
  return /^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)
}
function isDirToken(t: string): boolean {
  return /^[NSEWnsew]+$/.test(t)
}
function isInt(x: number): boolean {
  return typeof x === 'number' && isFinite(x) && Math.floor(x) === x
}

interface Token {
  v: number
  dir: string
  isDir?: boolean
}

function tokenizeLine(line: string): Token[] {
  const toks = normalizeLine(line).split(' ').filter((t) => t !== '')
  const out: Token[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]!
    if (isDirToken(t)) {
      if (out.length > 0 && !out[out.length - 1]!.dir) {
        out[out.length - 1]!.dir = t.toUpperCase()
      } else if (i + 1 < toks.length && isNumericToken(toks[i + 1]!)) {
        toks[i + 1] = t.toUpperCase() + toks[i + 1]!
      } else {
        out.push({ v: NaN, dir: t.toUpperCase(), isDir: true })
      }
      continue
    }
    let dir = '', numStr = t
    const m1 = t.match(/^([NSEWnsew])(.*)$/)
    if (m1) {
      dir = m1[1]!.toUpperCase()
      numStr = m1[2]!
    } else {
      const m2 = t.match(/^(.*?)([NSEWnsew])$/)
      if (m2) {
        dir = m2[2]!.toUpperCase()
        numStr = m2[1]!
      }
    }
    if (isNumericToken(numStr)) out.push({ v: parseFloat(numStr), dir })
  }
  return out
}

function groupTokens(toks: Token[]): Token[] {
  const gs: Token[] = []
  let i = 0
  while (i < toks.length) {
    const t = toks[i]!
    if (t.isDir) {
      if (gs.length > 0 && !gs[gs.length - 1]!.dir) gs[gs.length - 1]!.dir = t.dir
      i++
      continue
    }
    const n1 = toks[i + 1], n2 = toks[i + 2]
    if (n1 && n2 && isInt(t.v) && t.v <= 180 && isInt(n1.v) && n1.v < 60 && isInt(n2.v) && n2.v < 60) {
      const d = t.dir || n1.dir || n2.dir || ''
      gs.push({ v: t.v + n1.v / 60 + n2.v / 3600, dir: d })
      i += 3
      continue
    }
    if (n1 && isInt(t.v) && t.v <= 180 && isInt(n1.v) && n1.v < 60) {
      const d2 = t.dir || n1.dir || ''
      gs.push({ v: t.v + n1.v / 60, dir: d2 })
      i += 2
      continue
    }
    gs.push(t)
    i++
  }
  return gs
}

export function parseGeoLine(line: string, latOrder: string): [number, number] | null {
  const toks = groupTokens(tokenizeLine(line))
  let lng: number | null = null, lat: number | null = null
  for (let i = 0; i < toks.length; i++) {
    const g = toks[i]!
    if (g.dir === 'N' || g.dir === 'S') lat = g.v * (g.dir === 'S' ? -1 : 1)
    else if (g.dir === 'E' || g.dir === 'W') lng = g.v * (g.dir === 'W' ? -1 : 1)
  }
  const und: number[] = []
  for (let j = 0; j < toks.length; j++) if (!toks[j]!.dir) und.push(toks[j]!.v)
  for (let k = 0; k < und.length; k++) {
    if (lat !== null && lng !== null) break
    if (latOrder === 'lat-lng') {
      if (lat === null) lat = und[k]!
      else if (lng === null) lng = und[k]!
    } else {
      if (lng === null) lng = und[k]!
      else if (lat === null) lat = und[k]!
    }
  }
  if (lng === null || lat === null) return null
  return [lng, lat]
}

function autoLatLngOrder(aLng: number, aLat: number, bLng: number, bLat: number): string {
  const okA = aLng >= 70 && aLng <= 145 && aLat >= 0 && aLat <= 60
  const okB = bLng >= 70 && bLng <= 145 && bLat >= 0 && bLat <= 60
  if (okA && !okB) return 'lng-lat'
  if (okB && !okA) return 'lat-lng'
  return 'lng-lat'
}

export function parseProjLine(line: string): number[] {
  const parts = line.replace(/[,，;；|\t]+/g, ' ').split(' ').filter(Boolean)
  const nums: number[] = []
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!.trim()
    if (isNumericToken(p)) nums.push(parseFloat(p))
  }
  return nums
}

/* ---------- 坐标链 ---------- */
function sridToWgs84(srid: Srid, a: number, b: number, c: number, opts: ConvertOptions): [number, number, number] | null {
  const ell = opts.ell ? ELLIPSOIDS[opts.ell]! : ELLIPSOIDS.cgcs2000!
  const bandType = opts.bandType || '3'
  switch (srid) {
    case 'wgs84':
      return [a, b, c || 0]
    case 'gcj02': {
      const g = gcj02ToWgs84(a, b)
      return [g[0], g[1], c || 0]
    }
    case 'bd09': {
      const g2 = bd09ToGcj02(a, b)
      const w = gcj02ToWgs84(g2[0], g2[1])
      return [w[0], w[1], c || 0]
    }
    case 'webm': {
      const w = webMercatorToWgs84(a, b)
      return [w[0], w[1], c || 0]
    }
    case 'gauss': {
      let easting = a, band: number | null = null
      if (Math.abs(a) >= 1000000) {
        band = Math.floor(a / 1000000)
        easting = a - band * 1000000
      }
      let cm: number
      if (band === null) {
        cm = bandType === '6' ? gaussCM6(20) : gaussCM3(39)
      } else {
        cm = bandType === '6' ? gaussCM6(band) : gaussCM3(band)
      }
      const w = gaussInverse(b, easting, cm, ell)
      return [w[0], w[1], c || 0]
    }
    case 'utm': {
      let zone: number | null = null, east = a
      if (Math.abs(a) >= 1000000) {
        zone = Math.floor(a / 1000000)
        east = a - zone * 1000000
      }
      if (!zone && c) zone = Math.round(c)
      if (!zone) zone = 50
      const w = utmToWgs84(east, b, zone, !!opts.south)
      return [w[0], w[1], 0]
    }
    case 'ecef': {
      const w = ecefToWgs84(a, b, c, ell)
      return [w[0], w[1], w[2]]
    }
    default:
      return null
  }
}

function wgs84ToTarget(
  srid: Srid,
  lng: number,
  lat: number,
  h: number,
  opts: ConvertOptions,
  gaussBandFlag: boolean,
  fmt: boolean,
): { a: number; b: number; c: number; label: string; band?: number } | null {
  const ell = opts.ell ? ELLIPSOIDS[opts.ell]! : ELLIPSOIDS.cgcs2000!
  const bandType = opts.bandType || '3'
  h = h || 0
  switch (srid) {
    case 'wgs84':
      return { a: lng, b: lat, c: h, label: fmtLngLat(lng, lat, fmt) }
    case 'gcj02': {
      const g = wgs84ToGcj02(lng, lat)
      return { a: g[0], b: g[1], c: h, label: fmtLngLat(g[0], g[1], fmt) }
    }
    case 'bd09': {
      const g2 = wgs84ToGcj02(lng, lat)
      const b = gcj02ToBd09(g2[0], g2[1])
      return { a: b[0], b: b[1], c: h, label: fmtLngLat(b[0], b[1], fmt) }
    }
    case 'webm': {
      const w = wgs84ToWebMercator(lng, lat)
      return { a: w[0], b: w[1], c: h, label: fmtXY(w[0], w[1]) }
    }
    case 'gauss': {
      const band = bandType === '6' ? gaussBand6(lng) : gaussBand3(lng)
      const cm = bandType === '6' ? gaussCM6(band) : gaussCM3(band)
      const f = gaussForward(lng, lat, cm, ell)
      const east = f.y + 500000
      const val = gaussBandFlag ? band * 1000000 + east : east
      return { a: val, b: f.x, c: h, band, label: fmtXY(val, f.x) }
    }
    case 'utm': {
      const u = wgs84ToUtm(lng, lat)
      const val = gaussBandFlag ? u.zone * 1000000 + u.east : u.east
      return { a: val, b: u.north, c: h, band: u.zone, label: fmtXY(val, u.north) }
    }
    case 'ecef': {
      const e = wgs84ToEcef(lng, lat, h, ell)
      return { a: e[0], b: e[1], c: e[2], label: fmtXYZ(e[0], e[1], e[2]) }
    }
  }
  return null
}

/* ---------- 主转换入口 ---------- */
export function convertLine(
  srcSrid: Srid,
  dstSrid: Srid,
  line: string,
  latOrder: string,
  gaussBandFlag: boolean,
  fmt: boolean,
  opts: ConvertOptions,
): ConvertResult {
  if (srcSrid === 'gauss' || srcSrid === 'webm' || srcSrid === 'utm' || srcSrid === 'ecef') {
    const nums = parseProjLine(line)
    if (nums.length < 2) return { ok: false, err: '投影/直角坐标至少需 2 个数值' }
    let x: number, y: number, z: number | null
    if (srcSrid === 'ecef') {
      if (nums.length < 3) return { ok: false, err: 'ECEF 需 X Y Z 三个数值' }
      x = nums[0]!; y = nums[1]!; z = nums[2]!
    } else if (srcSrid === 'utm') {
      if (nums.length >= 3) {
        x = nums[0]!; y = nums[1]!; z = nums[2]!
      } else {
        x = nums[0]!; y = nums[1]!; z = null
      }
    } else {
      x = nums[nums.length - 2]!; y = nums[nums.length - 1]!; z = null
    }
    const w = sridToWgs84(srcSrid, x, y, z || 0, opts)
    if (!w) return { ok: false, err: '源坐标转换失败' }
    return { ok: true, src: line.trim(), out: wgs84ToTarget(dstSrid, w[0], w[1], w[2], opts, gaussBandFlag, fmt)!, wgs: [w[0], w[1]] }
  }
  let order = latOrder
  if (latOrder === 'auto') {
    const pA = parseGeoLine(line, 'lng-lat')
    const pB = parseGeoLine(line, 'lat-lng')
    if (pA && pB) order = autoLatLngOrder(pA[0], pA[1], pB[0], pB[1])
    else order = 'lng-lat'
  }
  const p = parseGeoLine(line, order)
  if (!p) return { ok: false, err: '无法解析该行' }
  const w = sridToWgs84(srcSrid, p[0], p[1], 0, opts)
  if (!w) return { ok: false, err: '源坐标转换失败' }
  return { ok: true, src: line.trim(), out: wgs84ToTarget(dstSrid, w[0], w[1], w[2], opts, gaussBandFlag, fmt)!, wgs: [w[0], w[1]] }
}
