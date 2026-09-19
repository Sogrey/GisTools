/**
 * SHP/DBF 二进制解析工具 — 纯前端实现
 * 提取自 doSometing/shp-toolbox/index.html 的核心解析逻辑
 * 支持 SHP→GeoJSON 转换、SHP/DBF 元信息提取、ZIP 解压
 */

// ── 常量 ────────────────────────────────────────────────────

export const SHP_TYPE_NAMES: Record<number, string> = {
  0: 'Null', 1: 'Point', 3: 'PolyLine', 5: 'Polygon', 8: 'MultiPoint',
  11: 'PointZ', 13: 'PolyLineZ', 15: 'PolygonZ', 18: 'MultiPointZ',
  21: 'PointM', 23: 'PolyLineM', 25: 'PolygonM', 28: 'MultiPointM'
}

export const SHAPE_TYPES: Record<number, string> = {
  0: 'Null Shape', 1: 'Point', 3: 'PolyLine', 5: 'Polygon', 8: 'MultiPoint',
  11: 'PointZ', 13: 'PolyLineZ', 15: 'PolygonZ', 18: 'MultiPointZ',
  21: 'PointM', 23: 'PolyLineM', 25: 'PolygonM', 28: 'MultiPointM', 31: 'MultiPatch'
}

export const DBF_TYPES: Record<string, string> = {
  C: 'Character (字符)', N: 'Numeric (数值)', D: 'Date (日期)',
  L: 'Logical (逻辑)', F: 'Float (浮点)', M: 'Memo (备注)',
  T: 'DateTime (日期时间)', I: 'Integer (整数)', Y: 'Currency (货币)'
}

export const CPG_ENC_MAP: Record<string, string> = {
  'utf-8': 'utf-8', utf8: 'utf-8',
  gbk: 'gbk', gb2312: 'gbk', gb18030: 'gbk',
  big5: 'big5',
  shift_jis: 'shift_jis', 'shift-jis': 'shift_jis', sjis: 'shift_jis',
  'euc-kr': 'euc-kr',
  latin1: 'windows-1252', 'iso-8859-1': 'windows-1252'
}

// ── 类型声明 ────────────────────────────────────────────────

export type ShpCoordinates = number[] | number[][] | number[][][]

export interface ShpGeometry {
  type: string
  coordinates: ShpCoordinates
}

export interface ShpResult {
  shapeType: number
  shapeTypeName: string
  bbox: [number, number, number, number]
  records: (ShpGeometry | null)[]
}

export interface DbfField {
  name: string
  type: string
  length: number
}

export interface DbfResult {
  fields: DbfField[]
  records: Record<string, unknown>[]
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    geometry: ShpGeometry | null
    properties: Record<string, unknown>
  }[]
}

export interface ShpInfo {
  fileCode: number
  fileLengthWords: number
  fileLengthBytes: number
  totalBytes: number
  shapeType: number
  shapeTypeName: string
  minX: number
  minY: number
  maxX: number
  maxY: number
  recordCount: number
}

export interface DbfInfoField {
  name: string
  type: string
  length: number
  decimal: number
  dataOffset: number
}

export interface DbfInfo {
  version: number
  recordCount: number
  headerSize: number
  recordSize: number
  ldm: number
  fields: DbfInfoField[]
  records: string[][]
  encoding: string
}

// ── 内部类型 ────────────────────────────────────────────────

interface BitReader {
  data: Uint8Array
  pos: number
  bitBuf: number
  bitCnt: number
  readBits(n: number): number
  readBit(): number
  alignByte(): void
}

interface HuffTable {
  lookup: Record<string, number | undefined>
  maxBits: number
}

// ── Compact INFLATE (RFC 1951) ──────────────────────────────

function inflate(src: Uint8Array): Uint8Array {
  const reader: BitReader = {
    data: src, pos: 0, bitBuf: 0, bitCnt: 0,
    readBits(n: number): number {
      if (n === 0) return 0
      while (this.bitCnt < n) {
        if (this.pos >= this.data.length) throw new Error('inflate: unexpected end of data')
        this.bitBuf += this.data[this.pos++]! * Math.pow(2, this.bitCnt)
        this.bitCnt += 8
      }
      const v = this.bitBuf & ((1 << n) - 1)
      this.bitBuf = Math.floor(this.bitBuf / Math.pow(2, n))
      this.bitCnt -= n
      return v
    },
    readBit(): number { return this.readBits(1) },
    alignByte(): void { this.bitBuf = 0; this.bitCnt = 0 }
  }

  function buildHuff(lengths: number[]): HuffTable {
    let maxBits = 0
    for (let i = 0; i < lengths.length; i++) if (lengths[i]! > maxBits) maxBits = lengths[i]!
    const blCount: number[] = new Array(maxBits + 1).fill(0)
    for (let i = 0; i < lengths.length; i++) if (lengths[i]! > 0) blCount[lengths[i]!] = blCount[lengths[i]!]! + 1
    const nextCode: number[] = new Array(maxBits + 1).fill(0)
    let code = 0
    for (let bits = 1; bits <= maxBits; bits++) {
      code = (code + blCount[bits - 1]!) << 1
      nextCode[bits] = code
    }
    const lookup: Record<string, number | undefined> = {}
    for (let sym = 0; sym < lengths.length; sym++) {
      if (lengths[sym]! > 0) {
        const nc = nextCode[lengths[sym]!]!
        lookup[lengths[sym]! + ':' + nc] = sym
        nextCode[lengths[sym]!] = nc + 1
      }
    }
    return { lookup, maxBits }
  }

  function decodeHuff(huff: HuffTable): number {
    let code = 0, len = 0
    while (len++ <= huff.maxBits) {
      code = (code << 1) | reader.readBit()
      const sym = huff.lookup[len + ':' + code]
      if (sym !== undefined) return sym
    }
    throw new Error('inflate: huffman decode error')
  }

  const distBase = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577]
  const distExtra = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13]
  const lenBase = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258]
  const lenExtra = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0]

  const out: number[] = []

  function inflateBlock(litHuff: HuffTable, distHuff: HuffTable): void {
    while (true) {
      const sym = decodeHuff(litHuff)
      if (sym < 256) {
        out.push(sym)
      } else if (sym === 256) {
        break
      } else {
        const li = sym - 257
        const len = lenBase[li]! + reader.readBits(lenExtra[li]!)
        const dsym = decodeHuff(distHuff)
        const dist = distBase[dsym]! + reader.readBits(distExtra[dsym]!)
        const start = out.length - dist
        for (let i = 0; i < len; i++) out.push(out[start + i]!)
      }
    }
  }

  while (true) {
    const bfinal = reader.readBit()
    const btype = reader.readBits(2)

    if (btype === 0) {
      reader.alignByte()
      const len = reader.data[reader.pos]! | (reader.data[reader.pos + 1]! << 8)
      reader.pos += 4
      for (let i = 0; i < len; i++) out.push(reader.data[reader.pos++]!)
    } else if (btype === 1) {
      const litLens: number[] = []
      for (let i = 0; i < 144; i++) litLens.push(8)
      for (let i = 0; i < 112; i++) litLens.push(9)
      for (let i = 0; i < 24; i++) litLens.push(7)
      for (let i = 0; i < 8; i++) litLens.push(8)
      const distLens: number[] = new Array(30).fill(5)
      inflateBlock(buildHuff(litLens), buildHuff(distLens))
    } else if (btype === 2) {
      const hlit = reader.readBits(5) + 257
      const hdist = reader.readBits(5) + 1
      const hclen = reader.readBits(4) + 4
      const order = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]
      const clLens: number[] = new Array(19).fill(0)
      for (let i = 0; i < hclen; i++) clLens[order[i]!] = reader.readBits(3)
      const clHuff = buildHuff(clLens)
      const allLens: number[] = []
      while (allLens.length < hlit + hdist) {
        const sym = decodeHuff(clHuff)
        if (sym < 16) {
          allLens.push(sym)
        } else if (sym === 16) {
          const rep = reader.readBits(2) + 3
          for (let j = 0; j < rep; j++) allLens.push(allLens[allLens.length - 1]!)
        } else if (sym === 17) {
          const rep = reader.readBits(3) + 3
          for (let j = 0; j < rep; j++) allLens.push(0)
        } else {
          const rep = reader.readBits(7) + 11
          for (let j = 0; j < rep; j++) allLens.push(0)
        }
      }
      inflateBlock(buildHuff(allLens.slice(0, hlit)), buildHuff(allLens.slice(hlit)))
    } else {
      throw new Error('inflate: invalid block type ' + btype)
    }

    if (bfinal) break
  }

  return new Uint8Array(out)
}

// ── ZIP 解析（Central Directory 方式）──────────────────────

export function parseZip(data: Uint8Array): Record<string, Uint8Array> {
  let eocd = -1
  const minPos = Math.max(0, data.length - 65557)
  for (let i = data.length - 22; i >= minPos; i--) {
    if (data[i] === 0x50 && data[i + 1] === 0x4b && data[i + 2] === 0x05 && data[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd === -1) throw new Error('ZIP: EOCD record not found')

  const cdCount = data[eocd + 10]! | (data[eocd + 11]! << 8)
  const cdOffset = (data[eocd + 16]! | (data[eocd + 17]! << 8) | (data[eocd + 18]! << 16) | (data[eocd + 19]! << 24)) >>> 0

  const files: Record<string, Uint8Array> = {}
  let pos = cdOffset

  for (let e = 0; e < cdCount; e++) {
    if (pos + 46 > data.length) break
    const sig = (data[pos]! | (data[pos + 1]! << 8) | (data[pos + 2]! << 16) | (data[pos + 3]! << 24)) >>> 0
    if (sig !== 0x02014b50) break

    const compMethod = data[pos + 10]! | (data[pos + 11]! << 8)
    const compSize = (data[pos + 20]! | (data[pos + 21]! << 8) | (data[pos + 22]! << 16) | (data[pos + 23]! << 24)) >>> 0
    const fnLen = data[pos + 28]! | (data[pos + 29]! << 8)
    const exLen = data[pos + 30]! | (data[pos + 31]! << 8)
    const cmLen = data[pos + 32]! | (data[pos + 33]! << 8)
    const localOff = (data[pos + 42]! | (data[pos + 43]! << 8) | (data[pos + 44]! << 16) | (data[pos + 45]! << 24)) >>> 0

    const filename = new TextDecoder('utf-8').decode(data.slice(pos + 46, pos + 46 + fnLen))

    const localFnLen = data[localOff + 26]! | (data[localOff + 27]! << 8)
    const localExLen = data[localOff + 28]! | (data[localOff + 29]! << 8)
    const dataStart = localOff + 30 + localFnLen + localExLen
    const compData = data.slice(dataStart, dataStart + compSize)

    let fileData: Uint8Array
    if (compMethod === 0) {
      fileData = compData
    } else if (compMethod === 8) {
      fileData = inflate(compData)
    } else {
      throw new Error('ZIP: unsupported compression method ' + compMethod + ' for ' + filename)
    }

    files[filename.toLowerCase()] = fileData
    pos += 46 + fnLen + exLen + cmLen
  }

  return files
}

// ── SHP 解析（转换器版本，返回几何记录）──────────────────

export function parseSHP(buf: ArrayBuffer): ShpResult {
  const dv = new DataView(buf)

  if (buf.byteLength < 100) throw new Error('SHP: file too small (min 100 bytes for header)')

  const fileCode = dv.getInt32(0, false)
  if (fileCode !== 9994) throw new Error('SHP: invalid file code ' + fileCode + ' (expected 9994)')

  const fileLength = dv.getInt32(24, false)
  const shapeType = dv.getInt32(32, true)
  const bbox: [number, number, number, number] = [
    dv.getFloat64(36, true),
    dv.getFloat64(44, true),
    dv.getFloat64(52, true),
    dv.getFloat64(60, true)
  ]

  const records: (ShpGeometry | null)[] = []
  let offset = 100
  const totalBytes = fileLength * 2

  while (offset < totalBytes - 12 && offset < buf.byteLength - 12) {
    const contentLength = dv.getInt32(offset + 4, false)
    offset += 8

    if (contentLength <= 0) break
    const contentBytes = contentLength * 2
    if (offset + contentBytes > buf.byteLength) break

    const recShapeType = dv.getInt32(offset, true)
    let geometry: ShpGeometry | null = null

    let baseType: number
    if (recShapeType === 0) baseType = 0
    else if (recShapeType === 1 || recShapeType === 11 || recShapeType === 21) baseType = 1
    else if (recShapeType === 3 || recShapeType === 13 || recShapeType === 23) baseType = 3
    else if (recShapeType === 5 || recShapeType === 15 || recShapeType === 25) baseType = 5
    else if (recShapeType === 8 || recShapeType === 18 || recShapeType === 28) baseType = 8
    else baseType = -1

    if (baseType === 0) {
      geometry = null
    } else if (baseType === 1) {
      const x = dv.getFloat64(offset + 4, true)
      const y = dv.getFloat64(offset + 12, true)
      geometry = { type: 'Point', coordinates: [x, y] }
    } else if (baseType === 3 || baseType === 5) {
      const numParts = dv.getInt32(offset + 36, true)
      const numPoints = dv.getInt32(offset + 40, true)

      if (numParts === 0 || numPoints === 0) {
        geometry = null
      } else {
        const partsStart = offset + 44
        const pointsStart = partsStart + numParts * 4

        const parts: number[] = []
        for (let i = 0; i < numParts; i++) {
          parts.push(dv.getInt32(partsStart + i * 4, true))
        }

        const points: number[][] = []
        for (let i = 0; i < numPoints; i++) {
          points.push([
            dv.getFloat64(pointsStart + i * 16, true),
            dv.getFloat64(pointsStart + i * 16 + 8, true)
          ])
        }

        const coords: number[][][] = []
        for (let p = 0; p < numParts; p++) {
          const startIdx = parts[p]!
          const endIdx = (p === numParts - 1) ? numPoints : parts[p + 1]!
          const part: number[][] = []
          for (let i = startIdx; i < endIdx; i++) {
            part.push(points[i]!)
          }
          coords.push(part)
        }

        if (baseType === 3) {
          geometry = (numParts === 1)
            ? { type: 'LineString', coordinates: coords[0]! }
            : { type: 'MultiLineString', coordinates: coords }
        } else {
          geometry = { type: 'Polygon', coordinates: coords }
        }
      }
    } else if (baseType === 8) {
      const numPoints = dv.getInt32(offset + 36, true)
      const pointsStart = offset + 40
      const coords: number[][] = []
      for (let i = 0; i < numPoints; i++) {
        coords.push([
          dv.getFloat64(pointsStart + i * 16, true),
          dv.getFloat64(pointsStart + i * 16 + 8, true)
        ])
      }
      geometry = { type: 'MultiPoint', coordinates: coords }
    } else {
      geometry = null
    }

    records.push(geometry)
    offset += contentBytes
  }

  return {
    shapeType,
    shapeTypeName: SHP_TYPE_NAMES[shapeType] || 'Unknown(' + shapeType + ')',
    bbox,
    records
  }
}

// ── DBF 解析（转换器版本，返回所有记录）──────────────────

export function parseDBF(buf: ArrayBuffer, encoding?: string): DbfResult {
  const dv = new DataView(buf)
  const u8 = new Uint8Array(buf)

  if (buf.byteLength < 32) throw new Error('DBF: file too small')

  const recordCount = dv.getUint32(4, true)
  const headerLength = dv.getUint16(8, true)
  const recordLength = dv.getUint16(10, true)

  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(encoding || 'utf-8')
  } catch {
    decoder = new TextDecoder('utf-8')
  }

  const fields: { name: string; type: string; length: number; decimal: number }[] = []
  let pos = 32
  while (pos < headerLength - 1 && pos + 32 <= buf.byteLength) {
    if (u8[pos] === 0x0D) break
    const nameBytes = u8.slice(pos, pos + 11)
    const name = decoder.decode(nameBytes).replace(/\0+$/, '').trim()
    if (!name) break
    const type = String.fromCharCode(u8[pos + 11]!)
    const fieldLength = u8[pos + 16]!
    const decimal = u8[pos + 17]!
    fields.push({ name, type, length: fieldLength, decimal })
    pos += 32
  }

  const records: Record<string, unknown>[] = []
  let recOffset = headerLength
  for (let r = 0; r < recordCount; r++) {
    if (recOffset + recordLength > buf.byteLength) break
    const record: Record<string, unknown> = {}
    let fieldPos = recOffset + 1
    for (let f = 0; f < fields.length; f++) {
      const field = fields[f]!
      const raw = decoder.decode(u8.slice(fieldPos, fieldPos + field.length)).trim()
      if (field.type === 'N' || field.type === 'F') {
        record[field.name] = raw === '' ? null : parseFloat(raw)
      } else if (field.type === 'L') {
        if (/^[TtYy]$/.test(raw)) record[field.name] = true
        else if (/^[FfNn]$/.test(raw)) record[field.name] = false
        else record[field.name] = null
      } else if (field.type === 'D') {
        record[field.name] = raw || null
      } else {
        record[field.name] = raw || null
      }
      fieldPos += field.length
    }
    records.push(record)
    recOffset += recordLength
  }

  return {
    fields: fields.map(f => ({ name: f.name, type: f.type, length: f.length })),
    records
  }
}

// ── GeoJSON 构建 ──────────────────────────────────────────

export function buildGeoJSON(shpResult: ShpResult, dbfResult: DbfResult | null): GeoJSONFeatureCollection {
  const features: GeoJSONFeatureCollection['features'] = []
  const shpRecords = shpResult.records
  const dbfRecords = dbfResult ? dbfResult.records : []

  for (let i = 0; i < shpRecords.length; i++) {
    features.push({
      type: 'Feature',
      geometry: shpRecords[i]!,
      properties: dbfRecords[i] || {}
    })
  }

  return {
    type: 'FeatureCollection',
    features
  }
}

// ── SHP 元信息解析（信息版本，返回头部元数据）────────────

export function parseShpInfo(buffer: ArrayBuffer): ShpInfo {
  if (buffer.byteLength < 100) throw new Error('SHP 文件过小（< 100 字节），无法解析 header')
  const dv = new DataView(buffer)
  const totalBytes = buffer.byteLength

  const fileCode = dv.getInt32(0, false)
  const fileLengthWords = dv.getInt32(24, false)
  const fileLengthBytes = fileLengthWords * 2

  const shapeType = dv.getInt32(32, true)
  const shapeTypeName = SHAPE_TYPES[shapeType] || 'Unknown(' + shapeType + ')'

  const minX = dv.getFloat64(36, true)
  const minY = dv.getFloat64(44, true)
  const maxX = dv.getFloat64(52, true)
  const maxY = dv.getFloat64(60, true)

  let recordCount = 0
  let offset = 100
  while (offset + 8 <= totalBytes) {
    const contentLength = dv.getInt32(offset + 4, false)
    if (contentLength <= 0) break
    offset += 8 + contentLength * 2
    recordCount++
  }

  return { fileCode, fileLengthWords, fileLengthBytes, totalBytes, shapeType, shapeTypeName, minX, minY, maxX, maxY, recordCount }
}

// ── DBF 元信息解析（信息版本，返回字段定义 + 预览）──────

export function parseDbfInfo(buffer: ArrayBuffer, encoding?: string): DbfInfo {
  if (buffer.byteLength < 32) throw new Error('DBF 文件过小（< 32 字节），无法解析 header')
  const dv = new DataView(buffer)
  const u8 = new Uint8Array(buffer)

  const version = dv.getUint8(0)
  const recordCount = dv.getInt32(4, true)
  const headerSize = dv.getUint16(8, true)
  const recordSize = dv.getUint16(10, true)
  const ldm = dv.getUint8(29)

  const fields: DbfInfoField[] = []
  let pos = 32
  let fieldDataOffset = 1

  while (pos + 32 <= headerSize) {
    if (u8[pos] === 0x0D) break
    if (u8[pos] === 0x00) break

    let name = ''
    for (let i = 0; i < 11; i++) {
      const b = u8[pos + i]!
      if (b === 0) break
      name += String.fromCharCode(b)
    }
    name = name.trim()

    const type = String.fromCharCode(u8[pos + 11]!)
    const length = u8[pos + 16]!
    const decimal = u8[pos + 17]!

    if (name.length === 0 && type === '\0') break

    fields.push({ name, type, length, decimal, dataOffset: fieldDataOffset })
    fieldDataOffset += length
    pos += 32
  }

  const sampleCount = Math.min(50, recordCount)
  const records: string[][] = []
  const decoder = new TextDecoder(encoding || 'utf-8', { fatal: false })

  for (let r = 0; r < sampleCount; r++) {
    const recordStart = headerSize + r * recordSize
    if (recordStart + recordSize > buffer.byteLength) break

    const flag = u8[recordStart]
    if (flag === 0x2A) continue

    const row: string[] = []
    for (let f = 0; f < fields.length; f++) {
      const field = fields[f]!
      const valStart = recordStart + field.dataOffset
      const valBytes = u8.slice(valStart, valStart + field.length)
      let val = decoder.decode(valBytes).trim()

      if (field.type === 'L') {
        val = (val === 'T' || val === 't' || val === 'Y' || val === 'y') ? '是' :
              (val === 'F' || val === 'f' || val === 'N' || val === 'n') ? '否' : val
      } else if (field.type === 'N' || field.type === 'F' || field.type === 'I') {
        if (val !== '') {
          const num = parseFloat(val)
          if (!isNaN(num)) val = String(num)
        }
      }
      row.push(val)
    }
    records.push(row)
  }

  return { version, recordCount, headerSize, recordSize, ldm, fields, records, encoding: encoding || 'utf-8' }
}

// ── 编码检测 ──────────────────────────────────────────────

export function detectEncoding(dv: DataView): string {
  const ldm = dv.getUint8(29)
  if (ldm >= 0x78 && ldm <= 0x7F) return 'gbk'
  return 'utf-8'
}
