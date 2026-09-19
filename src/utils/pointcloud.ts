/* ============================================================
 * 点云元信息查看器 · 核心逻辑
 * LAS/LAZ 二进制头部解析 · 签名 / 版本 / 点数 / 格式 / 缩放偏移 / BBOX
 * 提取自 doSometing/pointcloud-info/index.html
 * ============================================================ */

function readUint16LE(dv: DataView, off: number): number { return dv.getUint16(off, true) }
function readUint32LE(dv: DataView, off: number): number { return dv.getUint32(off, true) }
function readDoubleLE(dv: DataView, off: number): number { return dv.getFloat64(off, true) }
function readUint64LE(dv: DataView, off: number): number {
  return dv.getUint32(off, true) + dv.getUint32(off + 4, true) * 4294967296
}

function readString(dv: DataView, off: number, len: number): string {
  let s = ''
  for (let i = 0; i < len; i++) {
    const c = dv.getUint8(off + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s.replace(/\s+$/, '')
}

function readGuid(dv: DataView, off: number): string {
  const hex32 = (n: number, swap?: boolean) => {
    let h = ('00000000' + (n >>> 0).toString(16)).slice(-8)
    if (swap) h = h.slice(6, 8) + h.slice(4, 6) + h.slice(2, 4) + h.slice(0, 2)
    return h
  }
  const hex16 = (n: number, swap?: boolean) => {
    let h = ('0000' + (n >>> 0).toString(16)).slice(-4)
    if (swap) h = h.slice(2, 4) + h.slice(0, 2)
    return h
  }
  const d1 = hex32(dv.getUint32(off, true), true)
  const d2 = hex16(dv.getUint16(off + 4, true), true)
  const d3 = hex16(dv.getUint16(off + 6, true), true)
  let d4 = ''
  for (let i = 0; i < 2; i++) d4 += ('00' + dv.getUint8(off + 8 + i).toString(16)).slice(-2)
  let d5 = ''
  for (let i = 0; i < 6; i++) d5 += ('00' + dv.getUint8(off + 10 + i).toString(16)).slice(-2)
  return (d1 + '-' + d2 + '-' + d3 + '-' + d4 + '-' + d5).toUpperCase()
}

const POINT_FORMATS: Record<number, { name: string; size: number }> = {
  0: { name: '基本点', size: 20 },
  1: { name: '基本点 + GPS 时间', size: 28 },
  2: { name: '基本点 + RGB', size: 26 },
  3: { name: '基本点 + GPS + RGB', size: 34 },
  4: { name: '基本点 + GPS + 波形（旧）', size: 57 },
  5: { name: '基本点 + GPS + RGB + 波形（旧）', size: 63 },
  6: { name: '扩展点（1.4）', size: 30 },
  7: { name: '扩展点 + RGB', size: 36 },
  8: { name: '扩展点 + RGB + NIR', size: 38 },
  9: { name: '扩展点 + 波形', size: 59 },
  10: { name: '扩展点 + RGB + NIR + 波形', size: 67 }
}

interface VlrEntry { userId: string; recordId: number; recLen: number; desc: string }

function scanVlrs(dv: DataView, headerSize: number, offsetToPointData: number, count: number): VlrEntry[] {
  const list: VlrEntry[] = []
  let pos = headerSize
  const end = (offsetToPointData > headerSize && offsetToPointData <= dv.byteLength) ? offsetToPointData : dv.byteLength
  const max = Math.min(count, 200)
  for (let i = 0; i < max; i++) {
    if (pos + 54 > end) break
    const userId = readString(dv, pos + 2, 16)
    const recordId = readUint16LE(dv, pos + 18)
    const recLen = readUint16LE(dv, pos + 20)
    const desc = readString(dv, pos + 24, 32)
    list.push({ userId, recordId, recLen, desc })
    if (pos + 54 + recLen > end) break
    pos += 54 + recLen
  }
  return list
}

export interface LasResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  fileLength: number
  signature: string
  fileSourceId: number
  globalEncoding: number
  guid: string
  versionMajor: number
  versionMinor: number
  versionText: string
  systemIdentifier: string
  generatingSoftware: string
  creationDayOfYear: number
  creationYear: number
  creationDate: string
  headerSize: number
  expectedHeaderSize: number
  offsetToPointData: number
  vlrCount: number
  pointFormatRaw: number
  pointFormat: number
  pointFormatName: string
  pointRecordLength: number
  numPoints: number
  legacyNumPoints: number
  legacyPointsByReturn: number[]
  scale: { x: number; y: number; z: number }
  offset: { x: number; y: number; z: number }
  bbox: { maxX: number; minX: number; maxY: number; minY: number; maxZ: number; minZ: number }
  vlrList: VlrEntry[]
  isCompressed: boolean
  globalEncodingFlags: string[]
  evlrStart?: number
  evlrCount?: number
  pointsByReturn64?: number[]
  estimatedPoints?: number
}

export function parseLasHeader(buf: ArrayBuffer): LasResult {
  const out = {} as LasResult
  out.ok = false
  out.errors = []
  out.warnings = []
  if (!buf || !buf.byteLength) { out.errors.push('无数据：文件为空'); return out }
  out.fileLength = buf.byteLength
  if (buf.byteLength < 227) {
    out.errors.push(`文件过小（${buf.byteLength} 字节），不足以容纳 227 字节 LAS 公共头`)
    return out
  }
  const dv = new DataView(buf)

  out.signature = readString(dv, 0, 4)
  if (out.signature !== 'LASF') {
    out.errors.push(`文件签名不是 LASF（实际 "${out.signature}"），不是标准 LAS/LAZ 文件`)
    return out
  }
  out.fileSourceId = readUint16LE(dv, 4)
  out.globalEncoding = readUint16LE(dv, 6)
  out.guid = readGuid(dv, 8)
  out.versionMajor = dv.getUint8(24)
  out.versionMinor = dv.getUint8(25)
  out.versionText = out.versionMajor + '.' + out.versionMinor
  out.systemIdentifier = readString(dv, 26, 32)
  out.generatingSoftware = readString(dv, 58, 32)
  out.creationDayOfYear = readUint16LE(dv, 90)
  out.creationYear = readUint16LE(dv, 92)
  out.headerSize = readUint16LE(dv, 94)
  out.offsetToPointData = readUint32LE(dv, 96)
  out.vlrCount = readUint32LE(dv, 100)
  out.pointFormatRaw = dv.getUint8(104)
  out.pointFormat = out.pointFormatRaw & 0x3F
  out.pointRecordLength = readUint16LE(dv, 105)
  out.legacyNumPoints = readUint32LE(dv, 107)
  out.legacyPointsByReturn = []
  for (let i = 0; i < 5; i++) out.legacyPointsByReturn.push(readUint32LE(dv, 111 + 4 * i))
  out.scale = { x: readDoubleLE(dv, 131), y: readDoubleLE(dv, 139), z: readDoubleLE(dv, 147) }
  out.offset = { x: readDoubleLE(dv, 155), y: readDoubleLE(dv, 163), z: readDoubleLE(dv, 171) }
  out.bbox = {
    maxX: readDoubleLE(dv, 179), minX: readDoubleLE(dv, 187),
    maxY: readDoubleLE(dv, 195), minY: readDoubleLE(dv, 203),
    maxZ: readDoubleLE(dv, 211), minZ: readDoubleLE(dv, 219)
  }

  let numPoints64 = 0
  if (out.versionMinor >= 3 && buf.byteLength >= 235) {
    (out as unknown as Record<string, unknown>).waveformStart = readUint64LE(dv, 227)
  }
  if (out.versionMinor >= 4 && buf.byteLength >= 375) {
    out.evlrStart = readUint64LE(dv, 235)
    out.evlrCount = readUint32LE(dv, 243)
    numPoints64 = readUint64LE(dv, 247)
    out.pointsByReturn64 = []
    for (let i = 0; i < 15; i++) out.pointsByReturn64.push(readUint64LE(dv, 255 + 8 * i))
  }
  out.numPoints = (numPoints64 && numPoints64 > 0) ? numPoints64 : out.legacyNumPoints
  out.expectedHeaderSize = ({ 0: 227, 1: 227, 2: 227, 3: 235, 4: 375 } as Record<number, number>)[out.versionMinor] || 227
  out.vlrList = scanVlrs(dv, out.headerSize, out.offsetToPointData, out.vlrCount)
  out.isCompressed = false
  for (const v of out.vlrList) {
    if (/laszip/i.test(v.userId)) { out.isCompressed = true; break }
  }

  if (!out.isCompressed && out.pointRecordLength > 0 && out.offsetToPointData > 0 && out.offsetToPointData <= buf.byteLength) {
    const pointBytes = buf.byteLength - out.offsetToPointData
    out.estimatedPoints = Math.floor(pointBytes / out.pointRecordLength)
    if (out.numPoints > 0 && Math.abs(out.estimatedPoints - out.numPoints) > Math.max(2, out.numPoints * 0.001)) {
      out.warnings.push(`头部点数（${out.numPoints}）与按字节估算值（${out.estimatedPoints}）不一致，数据区可能被截断或存在尾部附加数据`)
    }
  }

  if (out.isCompressed) out.warnings.push('检测到 laszip 压缩 VLR（LAZ 文件）：头部可解析，点数据为压缩存储，需专用解压库读取')
  if (out.scale.x === 0 || out.scale.y === 0 || out.scale.z === 0) out.warnings.push('缩放因子含 0，整型坐标换算将异常')
  if (out.numPoints === 0) out.warnings.push('头部记录点数为 0，文件可能仅含头部或点数记录不完整')
  const fmtInfo = POINT_FORMATS[out.pointFormat]
  out.pointFormatName = fmtInfo ? fmtInfo.name : '未知格式'
  if (fmtInfo && out.pointRecordLength !== fmtInfo.size) {
    out.warnings.push(`点记录长度（${out.pointRecordLength}）与标准格式 ${out.pointFormat}（${fmtInfo.size} 字节）不一致，可能含自定义扩展字节`)
  }
  if (out.pointFormat >= 6 && out.versionMinor < 4) out.warnings.push(`点格式 ${out.pointFormat} 为 LAS 1.4 扩展格式，与版本 ${out.versionText} 不匹配`)
  if (out.headerSize < out.expectedHeaderSize) out.warnings.push(`头部大小（${out.headerSize}）小于该版本期望值（${out.expectedHeaderSize}）`)

  const flags: string[] = []
  if (out.globalEncoding & 1) flags.push('GPS 时间为标准 GPS 时间')
  if (out.globalEncoding & 2) flags.push('波形数据内嵌')
  if (out.globalEncoding & 4) flags.push('合成回波点')
  if (out.globalEncoding & 8) flags.push('WKT 坐标系（EVLR）')
  out.globalEncodingFlags = flags

  out.creationDate = ''
  if (out.creationYear > 0 && out.creationDayOfYear > 0 && out.creationDayOfYear <= 366) {
    const d = new Date(Date.UTC(out.creationYear, 0, out.creationDayOfYear))
    out.creationDate = d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2)
  }

  out.ok = true
  return out
}

export function makeDemoLas(): ArrayBuffer {
  const headerSize = 227, recLen = 20, n = 3
  const buf = new ArrayBuffer(headerSize + recLen * n)
  const dv = new DataView(buf)
  const wr = (off: number, s: string) => {
    for (let j = 0; j < s.length; j++) dv.setUint8(off + j, s.charCodeAt(j) & 0xFF)
  }
  wr(0, 'LASF')
  dv.setUint16(4, 0, true)
  dv.setUint16(6, 0, true)
  dv.setUint8(24, 1); dv.setUint8(25, 2)
  wr(26, 'GIS Toolbox')
  wr(58, 'demo generator v1.0')
  dv.setUint16(90, 258, true)
  dv.setUint16(92, 2026, true)
  dv.setUint16(94, headerSize, true)
  dv.setUint32(96, headerSize, true)
  dv.setUint32(100, 0, true)
  dv.setUint8(104, 0)
  dv.setUint16(105, recLen, true)
  dv.setUint32(107, n, true)
  for (let i = 0; i < 5; i++) dv.setUint32(111 + 4 * i, i === 0 ? n : 0, true)
  dv.setFloat64(131, 0.001, true)
  dv.setFloat64(139, 0.001, true)
  dv.setFloat64(147, 0.001, true)
  dv.setFloat64(155, 116.000, true)
  dv.setFloat64(163, 39.900, true)
  dv.setFloat64(171, 50.000, true)
  dv.setFloat64(179, 116.002, true)
  dv.setFloat64(187, 116.000, true)
  dv.setFloat64(195, 39.902, true)
  dv.setFloat64(203, 39.900, true)
  dv.setFloat64(211, 53.000, true)
  dv.setFloat64(219, 50.000, true)
  const pts = [[0, 0, 0], [1000, 1000, 1000], [2000, 2000, 3000]]
  for (let i = 0; i < n; i++) {
    const p = headerSize + i * recLen
    dv.setUint32(p, pts[i]![0]!, true)
    dv.setUint32(p + 4, pts[i]![1]!, true)
    dv.setUint32(p + 8, pts[i]![2]!, true)
    dv.setUint16(p + 12, 100, true)
    dv.setUint8(p + 14, 1)
    dv.setUint8(p + 15, 2)
    dv.setInt8(p + 16, 0)
    dv.setUint8(p + 17, 0)
    dv.setUint16(p + 18, 0, true)
  }
  return buf
}
