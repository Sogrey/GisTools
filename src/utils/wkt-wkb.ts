/* ============================================================
 * WKT ↔ GeoJSON · WKB/EWKB ↔ GeoJSON 纯函数
 * 提取自 doSometing/wkt-wkb-toolbox/index.html
 * ============================================================ */

type Coord = number[]
type Ring = Coord[]

export interface WkbInfo {
  endian: number
  hasZ: boolean
  hasM: boolean
  hasSRID: boolean
  srid: number | null
  bytes: number
}

export interface WkbResult {
  geometry: any
  bytesRead: number
  totalBytes: number
  wkbInfo: WkbInfo
}

/* ==================== 通用工具 ==================== */

function splitTop(s: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '(') { depth++; cur += ch }
    else if (ch === ')') { depth--; cur += ch }
    else if (ch === ',' && depth === 0) { parts.push(cur); cur = '' }
    else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts
}

function coordList(s: string): Coord[] {
  const nums = s.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []
  const out: Coord[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([parseFloat(nums[i]!), parseFloat(nums[i + 1]!)])
  return out
}

function unwrap(s: string): string {
  if (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') return s.slice(1, -1)
  return s
}

/* ==================== WKT → GeoJSON ==================== */

export function wktToGeoJson(wkt: string): any {
  const m = wkt.trim().match(/^([A-Za-z]+)\s*\(([\s\S]*)\)\s*$/)
  if (!m) throw new Error('WKT 格式无效')
  const type = m[1]!.toUpperCase()
  const body = m[2]!
  switch (type) {
    case 'POINT': {
      const p = coordList(body)
      return { type: 'Point', coordinates: p[0] || [0, 0] }
    }
    case 'LINESTRING':
      return { type: 'LineString', coordinates: coordList(body) }
    case 'POLYGON': {
      const rings = splitTop(body).map((r) => coordList(unwrap(r)))
      return { type: 'Polygon', coordinates: rings }
    }
    case 'MULTIPOINT': {
      const parts = splitTop(body)
      if (parts.length === 1 && parts[0]!.indexOf('(') === 0) {
        return { type: 'MultiPoint', coordinates: splitTop(parts[0]!).map((s) => coordList(unwrap(s))[0]) }
      }
      return { type: 'MultiPoint', coordinates: coordList(body) }
    }
    case 'MULTILINESTRING':
      return { type: 'MultiLineString', coordinates: splitTop(body).map((s) => coordList(unwrap(s))) }
    case 'MULTIPOLYGON': {
      const polys: Ring[][] = []
      splitTop(body).forEach((pg) => {
        polys.push(splitTop(unwrap(pg)).map((r) => coordList(unwrap(r))))
      })
      return { type: 'MultiPolygon', coordinates: polys }
    }
    case 'GEOMETRYCOLLECTION': {
      const geoms: any[] = []
      splitTop(body).forEach((g) => geoms.push(wktToGeoJson(g)))
      return { type: 'GeometryCollection', geometries: geoms }
    }
    default:
      throw new Error('不支持的 WKT 类型: ' + type)
  }
}

/* ==================== GeoJSON → WKT ==================== */

function ptStr(c: Coord): string {
  return c.join(' ')
}
function ringStr(ring: Ring): string {
  return '(' + ring.map(ptStr).join(', ') + ')'
}
function polyStr(coords: Ring[]): string {
  return '(' + coords.map(ringStr).join(', ') + ')'
}
function lineStr(coords: Coord[]): string {
  return '(' + coords.map(ptStr).join(', ') + ')'
}

export function geoJsonToWkt(gj: any): string {
  if (!gj || !gj.type) throw new Error('GeoJSON 对象无效')
  switch (gj.type) {
    case 'Point':
      return 'POINT (' + ptStr(gj.coordinates) + ')'
    case 'MultiPoint':
      return 'MULTIPOINT (' + gj.coordinates.map(ptStr).join(', ') + ')'
    case 'LineString':
      return 'LINESTRING ' + lineStr(gj.coordinates)
    case 'MultiLineString':
      return 'MULTILINESTRING (' + gj.coordinates.map(lineStr).join(', ') + ')'
    case 'Polygon':
      return 'POLYGON ' + polyStr(gj.coordinates)
    case 'MultiPolygon':
      return 'MULTIPOLYGON (' + gj.coordinates.map(polyStr).join(', ') + ')'
    case 'GeometryCollection':
      return 'GEOMETRYCOLLECTION (' + gj.geometries.map(geoJsonToWkt).join(', ') + ')'
    default:
      throw new Error('不支持的 GeoJSON 类型: ' + gj.type)
  }
}

/* WKT 方向识别 */
export function wktDetect(s: string): string {
  const t = s.trim().match(/^([A-Za-z]+)/)
  return t ? t[1]!.toUpperCase() : ''
}

/* ==================== hex ↔ bytes ==================== */

export function hexToBytes(hex: string): Uint8Array {
  let h = hex.trim()
  if (h.slice(0, 2) === '0x' || h.slice(0, 2) === '0X') h = h.slice(2)
  h = h.replace(/[^0-9a-fA-F]/g, '').toLowerCase()
  if (h.length === 0) throw new Error('hex 字符串为空')
  if (h.length % 2 !== 0) throw new Error('hex 长度必须为偶数，当前 ' + h.length + ' 字符')
  const len = h.length / 2
  const bytes = new Uint8Array(len)
  const H = '0123456789abcdef'
  for (let i = 0; i < len; i++) {
    bytes[i] = (H.indexOf(h[i * 2]!) << 4) | H.indexOf(h[i * 2 + 1]!)
  }
  return bytes
}

export function bytesToHex(bytes: Uint8Array): string {
  const H = '0123456789abcdef'
  const out: string[] = []
  for (let i = 0; i < bytes.length; i++) {
    out.push(H[bytes[i]! >> 4]! + H[bytes[i]! & 0xf]!)
  }
  return out.join('')
}

/* ==================== WKB Reader ==================== */

class WKBReader {
  bytes: Uint8Array
  dv: DataView
  pos: number
  le: boolean

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    this.pos = 0
    this.le = true
  }

  readByte(): number {
    if (this.pos >= this.bytes.length) throw new Error('WKB 数据不完整：期望读取 1 字节但已到末尾')
    return this.bytes[this.pos++]!
  }

  readUint32(): number {
    if (this.pos + 4 > this.bytes.length) throw new Error('WKB 数据不完整：期望读取 uint32 但已到末尾')
    const v = this.dv.getUint32(this.pos, this.le)
    this.pos += 4
    return v
  }

  readDouble(): number {
    if (this.pos + 8 > this.bytes.length) throw new Error('WKB 数据不完整：期望读取 double 但已到末尾')
    const v = this.dv.getFloat64(this.pos, this.le)
    this.pos += 8
    return v
  }

  readCoord(hasZ: boolean, hasM: boolean): Coord {
    const c: Coord = [this.readDouble(), this.readDouble()]
    if (hasZ) c.push(this.readDouble())
    if (hasM) c.push(this.readDouble())
    return c
  }

  readPoint(hasZ: boolean, hasM: boolean): any {
    return { type: 'Point', coordinates: this.readCoord(hasZ, hasM) }
  }

  readLineString(hasZ: boolean, hasM: boolean): any {
    const n = this.readUint32()
    const c: Coord[] = []
    for (let i = 0; i < n; i++) c.push(this.readCoord(hasZ, hasM))
    return { type: 'LineString', coordinates: c }
  }

  readPolygon(hasZ: boolean, hasM: boolean): any {
    const nr = this.readUint32()
    const rings: Ring[] = []
    for (let i = 0; i < nr; i++) {
      const np = this.readUint32()
      const ring: Coord[] = []
      for (let j = 0; j < np; j++) ring.push(this.readCoord(hasZ, hasM))
      rings.push(ring)
    }
    return { type: 'Polygon', coordinates: rings }
  }

  readMultiPoint(): any {
    const n = this.readUint32()
    const c: Coord[] = []
    for (let i = 0; i < n; i++) { const g = this.readGeometry(); c.push(g.coordinates) }
    return { type: 'MultiPoint', coordinates: c }
  }

  readMultiLineString(): any {
    const n = this.readUint32()
    const c: Coord[][] = []
    for (let i = 0; i < n; i++) { const g = this.readGeometry(); c.push(g.coordinates) }
    return { type: 'MultiLineString', coordinates: c }
  }

  readMultiPolygon(): any {
    const n = this.readUint32()
    const c: Ring[][] = []
    for (let i = 0; i < n; i++) { const g = this.readGeometry(); c.push(g.coordinates) }
    return { type: 'MultiPolygon', coordinates: c }
  }

  readGeometryCollection(): any {
    const n = this.readUint32()
    const g: any[] = []
    for (let i = 0; i < n; i++) g.push(this.readGeometry())
    return { type: 'GeometryCollection', geometries: g }
  }

  readGeometry(): any {
    const startPos = this.pos
    const bo = this.readByte()
    this.le = bo === 1
    const tc = this.readUint32()

    /* EWKB flags */
    const hasSRID = (tc & 0x20000000) !== 0
    const hasZ = (tc & 0x80000000) !== 0 || (tc & 0x01000000) !== 0
    const hasM = (tc & 0x40000000) !== 0 || (tc & 0x02000000) !== 0
    const bt = tc & 0xff

    let srid: number | null = null
    if (hasSRID) srid = this.readUint32()

    let geom: any
    switch (bt) {
      case 1: geom = this.readPoint(hasZ, hasM); break
      case 2: geom = this.readLineString(hasZ, hasM); break
      case 3: geom = this.readPolygon(hasZ, hasM); break
      case 4: geom = this.readMultiPoint(); break
      case 5: geom = this.readMultiLineString(); break
      case 6: geom = this.readMultiPolygon(); break
      case 7: geom = this.readGeometryCollection(); break
      default: throw new Error('未知 WKB 类型: ' + bt)
    }

    geom._wkb = { endian: bo, hasZ, hasM, hasSRID, srid, bytes: this.pos - startPos }
    if (srid !== null) geom.srid = srid
    return geom
  }
}

export function wkbToGeoJSON(hex: string): WkbResult {
  const bytes = hexToBytes(hex)
  if (bytes.length < 5) throw new Error('WKB 数据过短（至少 5 字节）')
  const r = new WKBReader(bytes)
  const geom = r.readGeometry()
  return { geometry: geom, bytesRead: r.pos, totalBytes: bytes.length, wkbInfo: geom._wkb }
}

/* ==================== GeoJSON → WKB ==================== */

export function geomHasZ(geom: any): boolean {
  function chk(v: any): boolean {
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number') return v.length >= 3
      for (const item of v) if (chk(item)) return true
    }
    return false
  }
  if (geom.type === 'GeometryCollection') return geom.geometries.some(geomHasZ)
  return chk(geom.coordinates)
}

export function geomHasM(geom: any): boolean {
  function chk(v: any): boolean {
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number') return v.length >= 4
      for (const item of v) if (chk(item)) return true
    }
    return false
  }
  if (geom.type === 'GeometryCollection') return geom.geometries.some(geomHasM)
  return chk(geom.coordinates)
}

class WKBWriter {
  le: boolean
  buf: number[]

  constructor(le: boolean) {
    this.le = le
    this.buf = []
  }

  writeByte(v: number) { this.buf.push(v & 0xff) }

  writeUint32(v: number) {
    if (this.le) this.buf.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff)
    else this.buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff)
  }

  writeDouble(v: number) {
    const tmp = new ArrayBuffer(8)
    const dv = new DataView(tmp)
    dv.setFloat64(0, v, this.le)
    for (let i = 0; i < 8; i++) this.buf.push(dv.getUint8(i))
  }

  writeCoord(c: Coord) {
    this.writeDouble(c[0]!); this.writeDouble(c[1]!)
    if (c.length >= 3) this.writeDouble(c[2]!)
    if (c.length >= 4) this.writeDouble(c[3]!)
  }

  writeType(bt: number, hasZ: boolean, hasM: boolean, hasSRID: boolean) {
    let tc = bt
    if (hasZ) tc |= 0x80000000
    if (hasM) tc |= 0x40000000
    if (hasSRID) tc |= 0x20000000
    this.writeUint32(tc >>> 0)
  }

  writeGeometry(geom: any, includeSRID: boolean) {
    const hasZ = geomHasZ(geom)
    const hasM = geomHasM(geom)
    const hasSRID = includeSRID && geom.srid != null
    this.writeByte(this.le ? 1 : 0)

    switch (geom.type) {
      case 'Point':
        this.writeType(1, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeCoord(geom.coordinates)
        break
      case 'LineString':
        this.writeType(2, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeUint32(geom.coordinates.length)
        for (const c of geom.coordinates) this.writeCoord(c)
        break
      case 'Polygon':
        this.writeType(3, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeUint32(geom.coordinates.length)
        for (const ring of geom.coordinates) {
          this.writeUint32(ring.length)
          for (const c of ring) this.writeCoord(c)
        }
        break
      case 'MultiPoint':
        this.writeType(4, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeUint32(geom.coordinates.length)
        for (const c of geom.coordinates) this.writeGeometry({ type: 'Point', coordinates: c }, false)
        break
      case 'MultiLineString':
        this.writeType(5, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeUint32(geom.coordinates.length)
        for (const c of geom.coordinates) this.writeGeometry({ type: 'LineString', coordinates: c }, false)
        break
      case 'MultiPolygon':
        this.writeType(6, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeUint32(geom.coordinates.length)
        for (const c of geom.coordinates) this.writeGeometry({ type: 'Polygon', coordinates: c }, false)
        break
      case 'GeometryCollection':
        this.writeType(7, hasZ, hasM, hasSRID)
        if (hasSRID) this.writeUint32(geom.srid)
        this.writeUint32(geom.geometries.length)
        for (const g of geom.geometries) this.writeGeometry(g, false)
        break
      default:
        throw new Error('不支持类型: ' + geom.type)
    }
  }
}

export function geoJSONToWKB(geom: any, le: boolean, includeSRID: boolean): string {
  const w = new WKBWriter(le !== false)
  w.writeGeometry(geom, includeSRID !== false)
  return bytesToHex(new Uint8Array(w.buf))
}

/* ==================== GeoJSON → WKT (WKB mode) ==================== */

export function geoJSONToWKT(geom: any): string {
  function pt(c: Coord): string { return c.join(' ') }
  function ring(r: Ring): string { return '(' + r.map(pt).join(', ') + ')' }
  switch (geom.type) {
    case 'Point':
      return 'POINT (' + pt(geom.coordinates) + ')'
    case 'MultiPoint':
      return 'MULTIPOINT (' + geom.coordinates.map(pt).join(', ') + ')'
    case 'LineString':
      return 'LINESTRING (' + geom.coordinates.map(pt).join(', ') + ')'
    case 'MultiLineString':
      return 'MULTILINESTRING (' + geom.coordinates.map(ring).join(', ') + ')'
    case 'Polygon':
      return 'POLYGON (' + geom.coordinates.map(ring).join(', ') + ')'
    case 'MultiPolygon':
      return 'MULTIPOLYGON (' + geom.coordinates.map((p: Ring[]) => '(' + p.map(ring).join(', ') + ')').join(', ') + ')'
    case 'GeometryCollection':
      return 'GEOMETRYCOLLECTION (' + geom.geometries.map(geoJSONToWKT).join(', ') + ')'
    default:
      throw new Error('不支持类型: ' + geom.type)
  }
}

/* ==================== WKB 方向识别 ==================== */

export function wkbDetectDirection(text: string): 'geojson' | 'wkb' | 'unknown' {
  text = text.trim()
  if (text.charAt(0) === '{') return 'geojson'
  const s = text.replace(/^0[xX]/, '').replace(/\s/g, '')
  if (/^[0-9a-fA-F]+$/.test(s) && s.length >= 10) return 'wkb'
  return 'unknown'
}

/* ==================== 统计辅助 ==================== */

export function countPts(o: any): number {
  let n = 0
  function rec(v: any) {
    if (Array.isArray(v)) {
      if (v.length >= 2 && typeof v[0] === 'number') n++
      else v.forEach(rec)
    } else if (typeof v === 'object' && v) {
      if (v.type === 'GeometryCollection' && v.geometries) v.geometries.forEach(rec)
      else if (v.coordinates) rec(v.coordinates)
    }
  }
  rec(o)
  return n
}

/* 清除 _wkb 内部字段 */
export function cleanGeom(g: any): any {
  return JSON.parse(JSON.stringify(g, (k, val) => (k === '_wkb' ? undefined : val)))
}
