/* ============================================================
 * H3/S2 网格编码器 · 核心算法
 * Plus Codes (OLC) 完整实现 · S2 简化实现 · H3 简化近似实现
 * 提取自 doSometing/h3-s2-grid/index.html
 * ============================================================ */

/* ===== Plus Codes (Open Location Code) ===== */
const OLC_ALPHABET = '23456789CFGHJMPQRVWX'
const OLC_BASE = 20

export interface OlcDecodeResult {
  lat: number
  lng: number
  south: number
  north: number
  west: number
  east: number
  latRes: number
  lngRes: number
  precision: number
}

export function olcEncode(lat: number, lng: number, strLen: number = 11): string {
  let codeLength = strLen - 1
  if (codeLength < 2) codeLength = 2
  if (codeLength > 15) codeLength = 15

  if (lat < -90) lat = -90
  if (lat > 90) lat = 90
  lng = ((lng + 180) % 360 + 360) % 360 - 180

  let adjLat = lat + 90
  let adjLng = lng + 180

  let code = ''
  let latRes = 180
  let lngRes = 360

  for (let i = 0; i < codeLength; i++) {
    if (i % 2 === 0) {
      latRes = latRes / OLC_BASE
      let d = Math.floor(adjLat / latRes)
      if (d > 19) d = 19
      if (d < 0) d = 0
      adjLat -= d * latRes
      code += OLC_ALPHABET[d]
    } else {
      lngRes = lngRes / OLC_BASE
      let d = Math.floor(adjLng / lngRes)
      if (d > 19) d = 19
      if (d < 0) d = 0
      adjLng -= d * lngRes
      code += OLC_ALPHABET[d]
    }
    if (i === 7) code += '+'
  }

  if (codeLength <= 8) {
    while (code.length < 8) code += OLC_ALPHABET[0]
    code += '+'
  }

  return code
}

export function olcDecode(code: string): OlcDecodeResult {
  if (!code) throw new Error('空输入')
  code = code.toUpperCase().trim()
  const cleanCode = code.replace(/\+/g, '')
  for (let i = 0; i < cleanCode.length; i++) {
    if (OLC_ALPHABET.indexOf(cleanCode[i]!) === -1) {
      throw new Error('非法字符: ' + cleanCode[i])
    }
  }
  if (cleanCode.length < 2) throw new Error('码长不足')

  let south = -90
  let west = -180
  let latRes = 180
  let lngRes = 360

  for (let i = 0; i < cleanCode.length; i++) {
    const d = OLC_ALPHABET.indexOf(cleanCode[i]!)
    if (i % 2 === 0) {
      latRes = latRes / OLC_BASE
      south += d * latRes
    } else {
      lngRes = lngRes / OLC_BASE
      west += d * lngRes
    }
  }

  const north = south + latRes
  const east = west + lngRes
  const centerLat = (south + north) / 2
  const centerLng = (west + east) / 2

  return {
    lat: centerLat,
    lng: centerLng,
    south,
    north,
    west,
    east,
    latRes,
    lngRes,
    precision: Math.max(latRes, lngRes),
  }
}

export function olcIsValid(code: string): boolean {
  if (!code) return false
  code = code.toUpperCase().trim()
  const clean = code.replace(/\+/g, '')
  if (clean.length < 2 || clean.length > 15) return false
  for (let i = 0; i < clean.length; i++) {
    if (OLC_ALPHABET.indexOf(clean[i]!) === -1) return false
  }
  return true
}

/* ===== S2 Cell ID (简化实现) ===== */
export interface S2Result {
  cellId: bigint
  cellIdDec: string
  cellIdHex: string
  face: number
  level: number
  center: { lat: number; lng: number }
  corners: { lat: number; lng: number }[]
  bbox: { south: number; north: number; west: number; east: number }
}

function s2Forward(lat: number, lng: number): { face: number; u: number; v: number } {
  const latRad = (lat * Math.PI) / 180
  const lngRad = (lng * Math.PI) / 180
  const x = Math.cos(latRad) * Math.cos(lngRad)
  const y = Math.cos(latRad) * Math.sin(lngRad)
  const z = Math.sin(latRad)

  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let face: number, a: number, b: number, c: number

  if (ax >= ay && ax >= az) {
    c = x
    if (x > 0) { face = 0; a = y; b = z } else { face = 3; a = y; b = z }
  } else if (ay >= ax && ay >= az) {
    c = y
    if (y > 0) { face = 1; a = -x; b = z } else { face = 4; a = x; b = -z }
  } else {
    c = z
    if (z > 0) { face = 2; a = -y; b = x } else { face = 5; a = y; b = -x }
  }

  const absC = Math.abs(c) < 1e-15 ? 1e-15 : Math.abs(c)
  return { face, u: a / absC, v: b / absC }
}

function s2Inverse(face: number, u: number, v: number): { lat: number; lng: number } {
  let x: number, y: number, z: number
  switch (face) {
    case 0: x = 1; y = u; z = v; break
    case 1: x = -u; y = 1; z = v; break
    case 2: x = v; y = -u; z = 1; break
    case 3: x = -1; y = u; z = v; break
    case 4: x = u; y = -1; z = -v; break
    case 5: x = -v; y = u; z = -1; break
    default: x = 1; y = 0; z = 0
  }
  let len = Math.sqrt(x * x + y * y + z * z)
  if (len < 1e-15) len = 1e-15
  x /= len; y /= len; z /= len
  const lat = (Math.asin(Math.max(-1, Math.min(1, z))) * 180) / Math.PI
  const lng = (Math.atan2(y, x) * 180) / Math.PI
  return { lat, lng }
}

export function s2Encode(lat: number, lng: number, level: number): S2Result {
  level = Math.max(0, Math.min(30, level | 0))
  if (lat < -90) lat = -90
  if (lat > 90) lat = 90
  lng = ((lng + 180) % 360 + 360) % 360 - 180

  const proj = s2Forward(lat, lng)
  const face = proj.face

  let u01 = (proj.u + 1) / 2
  let v01 = (proj.v + 1) / 2
  const eps = 1e-12
  u01 = Math.max(eps, Math.min(1 - eps, u01))
  v01 = Math.max(eps, Math.min(1 - eps, v01))

  let cellId = BigInt(face) << 61n
  for (let i = 0; i < level; i++) {
    const uBit = u01 >= 0.5 ? 1 : 0
    const vBit = v01 >= 0.5 ? 1 : 0
    u01 = (u01 * 2) % 1
    v01 = (v01 * 2) % 1
    const shift = BigInt(60 - 2 * i)
    cellId |= BigInt(uBit) << shift
    cellId |= BigInt(vBit) << (shift - 1n)
  }
  cellId |= 1n << BigInt(60 - 2 * level)

  const origU01 = Math.max(eps, Math.min(1 - eps, (proj.u + 1) / 2))
  const origV01 = Math.max(eps, Math.min(1 - eps, (proj.v + 1) / 2))
  const scale = Math.pow(2, level)
  const cellSize = 1 / scale
  const cellU0 = Math.floor(origU01 * scale)
  const cellV0 = Math.floor(origV01 * scale)
  const uMin = cellU0 * cellSize
  const uMax = (cellU0 + 1) * cellSize
  const vMin = cellV0 * cellSize
  const vMax = (cellV0 + 1) * cellSize

  const corners = [
    s2Inverse(face, uMin, vMin),
    s2Inverse(face, uMax, vMin),
    s2Inverse(face, uMax, vMax),
    s2Inverse(face, uMin, vMax),
  ]

  const center = s2Inverse(face, (uMin + uMax) / 2, (vMin + vMax) / 2)
  const lats = corners.map((c) => c.lat)
  const lngs = corners.map((c) => c.lng)
  const bbox = {
    south: Math.min(...lats),
    north: Math.max(...lats),
    west: Math.min(...lngs),
    east: Math.max(...lngs),
  }

  let hex = cellId.toString(16).toUpperCase()
  while (hex.length < 16) hex = '0' + hex

  return { cellId, cellIdDec: cellId.toString(), cellIdHex: '0x' + hex, face, level, center, corners, bbox }
}

/* ===== H3 Index (简化近似实现) ===== */
const EDGE_KM = [1107.71, 418.76, 158.24, 59.81, 22.61, 8.54, 3.23, 1.22, 0.46, 0.174, 0.066, 0.025, 0.0094, 0.0036, 0.00135, 0.00051]

export interface H3Result {
  h3Index: string
  baseCell: number
  resolution: number
  center: { lat: number; lng: number }
  vertices: { lng: number; lat: number }[]
  edgeKm: number
  edgeDeg: number
}

export function h3Encode(lat: number, lng: number, res: number): H3Result {
  res = Math.max(0, Math.min(15, res | 0))
  if (lat < -90) lat = -90
  if (lat > 90) lat = 90
  lng = ((lng + 180) % 360 + 360) % 360 - 180

  let baseLat = Math.floor(((lat + 90) / 180) * 11)
  let baseLng = Math.floor(((lng + 180) / 360) * 11)
  if (baseLat > 10) baseLat = 10
  if (baseLng > 10) baseLng = 10
  if (baseLat < 0) baseLat = 0
  if (baseLng < 0) baseLng = 0
  const baseCell = baseLat * 11 + baseLng

  const subLat = ((lat + 90) / 180) * 11 - baseLat
  const subLng = ((lng + 180) / 360) * 11 - baseLng
  const gridScale = Math.pow(2, res)
  const subLatIdx = Math.floor(subLat * gridScale * 100000)
  const subLngIdx = Math.floor(subLng * gridScale * 100000)
  const subIndex = (subLatIdx * 100000 + subLngIdx) % Math.pow(2, 45)

  let idx = 0n
  idx |= 1n << 59n
  idx |= BigInt(res) << 52n
  idx |= BigInt(baseCell) << 45n
  idx |= BigInt(Math.floor(subIndex)) & ((1n << 45n) - 1n)

  let h3Str = idx.toString(16).toUpperCase()
  while (h3Str.length < 15) h3Str = '0' + h3Str

  const edgeKm = EDGE_KM[res]!
  const edgeDeg = edgeKm / 111.0
  const cosLat = Math.max(Math.cos((lat * Math.PI) / 180), 0.01)
  const vertices: { lng: number; lat: number }[] = []
  for (let k = 0; k < 6; k++) {
    const angle = ((k * 60 + 30) * Math.PI) / 180
    const dLat = edgeDeg * Math.sin(angle)
    const dLng = (edgeDeg * Math.cos(angle)) / cosLat
    vertices.push({ lng: lng + dLng, lat: lat + dLat })
  }

  return { h3Index: h3Str, baseCell, resolution: res, center: { lat, lng }, vertices, edgeKm, edgeDeg }
}
