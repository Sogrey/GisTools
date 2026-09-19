/* ============================================================
 * table-convert.ts — 表格转换纯函数
 * 提取自 doSometing/geojson-table 和 doSometing/excel-to-json
 * 包含：CSV/Excel → GeoJSON、GeoJSON → CSV、Excel/表格 → JSON
 * ============================================================ */

/* ---- 类型定义 ---- */

export type NumberOrAuto = number | 'auto'

export interface GeoJSONGeometry {
  type: string
  coordinates: unknown
  geometries?: GeoJSONGeometry[]
}

export interface GeoJSONFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: GeoJSONGeometry | null
}

export interface TableToGeoJsonOptions {
  hasHeader?: boolean
  lngIdx?: NumberOrAuto
  latIdx?: NumberOrAuto
  nameIdx?: NumberOrAuto
  latLngOrder?: boolean
}

export interface TableToGeoJsonSuccess {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  _meta: { features: number; props: number }
}

export interface TableToGeoJsonError {
  error: string
}

export type TableToGeoJsonResult = TableToGeoJsonSuccess | TableToGeoJsonError

export type GeomMode = 'wkt' | 'lonlat' | 'none'

export interface GeoJsonToCsvOptions {
  geomMode?: GeomMode
  addBom?: boolean
}

export interface GeoJsonToCsvResult {
  csv: string
  featureCount: number
  fieldCount: number
  rowCount: number
  byteSize: number
}

export interface TableToJsonOptions {
  hasHeader?: boolean
  inferTypes?: boolean
  mode?: 'array' | 'object'
  keyCol?: number
}

export interface TableToJsonResult {
  result: unknown
  info: string
}

/* ============================================================
 * Part 1: 表 → GeoJSON
 * ============================================================ */

/** 自动检测分隔符并拆分行 */
export function splitLine(line: string): string[] {
  let sep = '\t'
  if (line.indexOf('\t') !== -1) sep = '\t'
  else if (line.indexOf(',') !== -1) sep = ','
  else if (line.indexOf(';') !== -1) sep = ';'
  else if (line.indexOf('，') !== -1) sep = '，'
  return line.split(sep).map((s) => s.trim())
}

/** 解析数字，支持度分秒格式 */
export function parseNum(s: string): number {
  s = String(s).trim()
  if (!s) return NaN
  const m = s.match(/^(-?\d+)\s*[°度]\s*(\d+)\s*[′'分]?\s*(\d+(?:\.\d+)?)?\s*[″"]?/)
  if (m) {
    const v =
      parseFloat(m[1]!) +
      (m[2] ? parseFloat(m[2]!) / 60 : 0) +
      (m[3] ? parseFloat(m[3]!) / 3600 : 0)
    if (/[SWsw西$]/.test(s)) return -v
    return v
  }
  const v2 = parseFloat(s)
  return isNaN(v2) ? NaN : v2
}

const NAME_KEYS = ['name', '名称', '名', '标题', 'title', 'label']
const LNG_KEYS = ['lng', 'lon', '经度', '经', 'longitude', 'x', 'easting', '东']
const LAT_KEYS = ['lat', '纬度', '纬', 'latitude', 'y', 'northing', '北']

/** 从表头自动识别名称/经度/纬度列索引 */
export function detectCols(header: string[]): { name: number; lng: number; lat: number } {
  let name = -1
  let lng = -1
  let lat = -1
  for (let i = 0; i < header.length; i++) {
    const h = String(header[i]).toLowerCase().replace(/[\(（].*?[\)）]/g, '')
    if (lng === -1 && LNG_KEYS.some((k) => h.indexOf(k.toLowerCase()) !== -1)) lng = i
    if (lat === -1 && LAT_KEYS.some((k) => h.indexOf(k.toLowerCase()) !== -1)) lat = i
    if (name === -1 && NAME_KEYS.some((k) => h.indexOf(k.toLowerCase()) !== -1)) name = i
  }
  return { name, lng, lat }
}

/** 表格文本 → GeoJSON FeatureCollection */
export function tableToGeoJson(text: string, opts: TableToGeoJsonOptions = {}): TableToGeoJsonResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return { error: '无数据' }

  const header = splitLine(lines[0]!)
  let start = 0
  let headerUsed = false
  if (opts.hasHeader) {
    const det = detectCols(header)
    if (det.lng !== -1 || det.lat !== -1) {
      headerUsed = true
      start = 1
    }
  }

  // 解析列索引
  const rawLng = opts.lngIdx ?? 'auto'
  const rawLat = opts.latIdx ?? 'auto'
  const rawName = opts.nameIdx ?? 'auto'

  let lngIdx: number
  let latIdx: number
  let nameIdx: number

  if (rawLng === 'auto') {
    let detLng = -1
    let detLat = -1
    let detName = -1
    if (headerUsed) {
      const det = detectCols(header)
      detLng = det.lng
      detLat = det.lat
      if (rawName === 'auto') detName = det.name
    }
    lngIdx = detLng !== -1 ? detLng : 0
    latIdx = detLat !== -1 ? detLat : 1
    nameIdx = rawName !== 'auto' ? rawName : detName
  } else {
    lngIdx = rawLng
    latIdx = rawLat === 'auto' ? 1 : rawLat
    nameIdx = rawName === 'auto' ? -1 : rawName
  }

  // 属性字段（排除经纬度列）
  const propsKeys: string[] = []
  if (headerUsed) {
    for (let i = 0; i < header.length; i++) {
      if (i !== lngIdx && i !== latIdx) propsKeys.push(header[i]!)
    }
  }

  const features: GeoJSONFeature[] = []
  for (let r = start; r < lines.length; r++) {
    const cells = splitLine(lines[r]!)
    let vLng = parseNum(cells[lngIdx] ?? '')
    let vLat = parseNum(cells[latIdx] ?? '')
    if (isNaN(vLng) || isNaN(vLat)) continue
    if (opts.latLngOrder) {
      const t = vLng
      vLng = vLat
      vLat = t
    }

    const props: Record<string, unknown> = {}
    if (nameIdx >= 0 && cells[nameIdx]) {
      props['name'] = cells[nameIdx]
    } else {
      props['name'] = r - start + 1
    }

    if (headerUsed) {
      for (let p = 0; p < propsKeys.length; p++) {
        const ci = header.indexOf(propsKeys[p]!)
        if (ci >= 0 && ci < cells.length && cells[ci] !== '' && !isNaN(parseFloat(cells[ci]!))) {
          props[propsKeys[p]!] = parseFloat(cells[ci]!)
        } else if (ci >= 0 && ci < cells.length) {
          props[propsKeys[p]!] = cells[ci]!
        }
      }
    }

    features.push({
      type: 'Feature',
      properties: props,
      geometry: { type: 'Point', coordinates: [vLng, vLat] },
    })
  }

  if (features.length === 0) return { error: '未解析到有效点（请检查经纬度列选择）' }

  return {
    type: 'FeatureCollection',
    features,
    _meta: { features: features.length, props: propsKeys.length },
  }
}

/* ============================================================
 * Part 2: GeoJSON → CSV
 * ============================================================ */

/** CSV 转义（RFC 4180） */
export function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/** 格式化值为字符串 */
export function formatValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (typeof val === 'number') {
    if (!isFinite(val)) return ''
    return String(val)
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val)
    } catch {
      return ''
    }
  }
  return String(val)
}

/** 坐标点 → 字符串 */
function coordStr(pt: unknown): string {
  if (!Array.isArray(pt) || pt.length < 2) return ''
  let s = String(pt[0]) + ' ' + String(pt[1])
  if (pt.length >= 3 && typeof pt[2] === 'number' && isFinite(pt[2])) {
    s += ' ' + String(pt[2])
  }
  return s
}

/** 几何 → WKT */
export function geomToWKT(geom: GeoJSONGeometry | null): string {
  if (!geom || !geom.type) return ''
  const type = geom.type
  const coords = geom.coordinates

  if (type === 'Point') {
    if (!Array.isArray(coords) || coords.length < 2) return ''
    return 'POINT(' + coordStr(coords) + ')'
  }
  if (type === 'MultiPoint') {
    if (!Array.isArray(coords)) return ''
    return 'MULTIPOINT(' + coords.map((p) => '(' + coordStr(p) + ')').join(', ') + ')'
  }
  if (type === 'LineString') {
    if (!Array.isArray(coords)) return ''
    return 'LINESTRING(' + coords.map(coordStr).join(', ') + ')'
  }
  if (type === 'MultiLineString') {
    if (!Array.isArray(coords)) return ''
    return (
      'MULTILINESTRING(' +
      coords
        .map((line) => '(' + (line as unknown[]).map(coordStr).join(', ') + ')')
        .join(', ') +
      ')'
    )
  }
  if (type === 'Polygon') {
    if (!Array.isArray(coords)) return ''
    return (
      'POLYGON(' +
      coords
        .map((ring) => '(' + (ring as unknown[]).map(coordStr).join(', ') + ')')
        .join(', ') +
      ')'
    )
  }
  if (type === 'MultiPolygon') {
    if (!Array.isArray(coords)) return ''
    return (
      'MULTIPOLYGON(' +
      coords
        .map((poly) =>
          '(' +
          (poly as unknown[])
            .map((ring) => '(' + (ring as unknown[]).map(coordStr).join(', ') + ')')
            .join(', ') +
          ')'
        )
        .join(', ') +
      ')'
    )
  }
  if (type === 'GeometryCollection') {
    if (!Array.isArray(geom.geometries)) return ''
    return 'GEOMETRYCOLLECTION(' + geom.geometries.map(geomToWKT).join(', ') + ')'
  }
  return ''
}

/** 几何 → 经纬度（取第一个点） */
export function geomToLonLat(geom: GeoJSONGeometry | null): { lon: string; lat: string } {
  if (!geom || !geom.type) return { lon: '', lat: '' }
  const type = geom.type
  const coords = geom.coordinates
  let pt: unknown = null

  if (type === 'Point') {
    pt = coords
  } else if (type === 'MultiPoint' || type === 'LineString') {
    pt = Array.isArray(coords) ? coords[0] : null
  } else if (type === 'MultiLineString' || type === 'Polygon') {
    pt = Array.isArray(coords) && Array.isArray(coords[0]) ? (coords[0] as unknown[])[0] : null
  } else if (type === 'MultiPolygon') {
    pt =
      Array.isArray(coords) && Array.isArray(coords[0]) && Array.isArray((coords[0] as unknown[])[0])
        ? ((coords[0] as unknown[])[0] as unknown[])[0]
        : null
  }

  if (!pt || !Array.isArray(pt) || pt.length < 2) return { lon: '', lat: '' }
  return { lon: String(pt[0]), lat: String(pt[1]) }
}

/** 扫描所有属性字段（字段并集，保持出现顺序） */
export function scanFields(features: GeoJSONFeature[]): string[] {
  const keys: string[] = []
  const seen: Record<string, boolean> = {}
  for (const f of features) {
    if (!f || !f.properties || typeof f.properties !== 'object') continue
    for (const k of Object.keys(f.properties)) {
      if (!seen[k]) {
        seen[k] = true
        keys.push(k)
      }
    }
  }
  return keys
}

/** 计算字符串字节大小（UTF-8） */
export function calcByteSize(str: string): number {
  let bytes = 0
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4
      i++
    } else bytes += 3
  }
  return bytes
}

/** 格式化字节大小 */
export function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

/** GeoJSON → CSV */
export function geojsonToCsv(geojson: unknown, options: GeoJsonToCsvOptions = {}): GeoJsonToCsvResult {
  const geomMode = options.geomMode || 'wkt'
  const addBom = options.addBom || false

  if (!geojson || typeof geojson !== 'object') {
    throw new Error('输入不是有效的 JSON 对象')
  }

  const gj = geojson as Record<string, unknown>
  let features: GeoJSONFeature[] = []

  if (gj.type === 'FeatureCollection' && Array.isArray(gj.features)) {
    features = gj.features as GeoJSONFeature[]
  } else if (gj.type === 'Feature') {
    features = [gj as unknown as GeoJSONFeature]
  } else if (gj.type && gj.coordinates !== undefined) {
    features = [{ type: 'Feature', properties: {}, geometry: gj as unknown as GeoJSONGeometry }]
  } else {
    throw new Error('无效的 GeoJSON：需要 FeatureCollection 或 Feature')
  }

  const propKeys = scanFields(features)
  const headers = propKeys.slice()
  if (geomMode === 'wkt') {
    headers.push('geometry_wkt')
  } else if (geomMode === 'lonlat') {
    headers.push('lon')
    headers.push('lat')
  }

  const rows: string[] = [headers.map(csvEscape).join(',')]

  for (const f of features) {
    const props = (f && f.properties) || {}
    const row: string[] = []
    for (const k of propKeys) {
      row.push(csvEscape(formatValue(props[k])))
    }
    if (geomMode === 'wkt') {
      row.push(csvEscape(geomToWKT(f ? f.geometry : null)))
    } else if (geomMode === 'lonlat') {
      const ll = geomToLonLat(f ? f.geometry : null)
      row.push(csvEscape(ll.lon))
      row.push(csvEscape(ll.lat))
    }
    rows.push(row.join(','))
  }

  let csv = rows.join('\n')
  if (addBom) csv = '\uFEFF' + csv

  return {
    csv,
    featureCount: features.length,
    fieldCount: headers.length,
    rowCount: rows.length,
    byteSize: calcByteSize(csv),
  }
}

/* ============================================================
 * Part 3: Excel / 表格文本 → JSON
 * ============================================================ */

const DELIMITER_MAP: Record<string, string> = {
  '\\t': '\t',
  ',': ',',
  ';': ';',
  '，': '，',
  '|': '|',
}

/** 获取分隔符 */
export function getDelimiter(value: string): string {
  return DELIMITER_MAP[value] || '\t'
}

/** 自动检测分隔符：统计每行出现频率最高的 */
export function autoDetectDelimiter(text: string): string {
  const candidates = ['\t', ',', ';', '，', '|']
  let best = '\t'
  let bestScore = 0
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() !== '')
  if (lines.length === 0) return '\t'

  for (const d of candidates) {
    const scores: number[] = []
    for (let j = 0; j < Math.min(lines.length, 10); j++) {
      scores.push(lines[j]!.split(d).length)
    }
    const consistent = scores.every((s) => s === scores[0]!)
    if (consistent && scores[0]! > 1) {
      if (scores[0]! > bestScore) {
        bestScore = scores[0]!
        best = d
      }
    }
  }

  if (bestScore === 0) {
    for (const d of candidates) {
      let count = 0
      for (const line of lines) {
        count += line.split(d).length - 1
      }
      if (count > bestScore) {
        bestScore = count
        best = d
      }
    }
  }
  return best
}

/** 类型推断：字符串 → boolean / number / string / null */
export function inferType(val: string): null | boolean | number | string {
  if (val === '') return null
  const trimmed = val.trim()
  if (trimmed === '') return null
  if (trimmed.toLowerCase() === 'true') return true
  if (trimmed.toLowerCase() === 'false') return false
  if (
    /^-?\d+$/.test(trimmed) ||
    /^-?\d+\.\d+$/.test(trimmed) ||
    /^-?\d+(\.\d+)?[eE][-+]?\d+$/.test(trimmed)
  ) {
    const num = Number(trimmed)
    if (!isNaN(num) && isFinite(num)) return num
  }
  return val
}

/** 解析表格文本为二维数组 */
export function parseTable(text: string, delimiter: string): string[][] {
  if (!text || !text.trim()) return []
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === '') lines.pop()
  if (lines.length === 0) return []

  return lines.map((line) =>
    line.split(delimiter).map((c) => c.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '')),
  )
}

/** 表格二维数组 → JSON */
export function convertToJSON(rows: string[][], opts: TableToJsonOptions = {}): TableToJsonResult {
  if (rows.length === 0) return { result: '[]', info: '0 条记录' }

  const hasHeader = opts.hasHeader ?? true
  const inferTypes = opts.inferTypes ?? true
  const mode = opts.mode ?? 'array'
  const keyCol = opts.keyCol ?? 0

  let headers: string[]
  let dataRows: string[][]

  if (hasHeader) {
    headers = rows[0]!.map((h, idx) => (h !== '' ? h : 'column_' + (idx + 1)))
    dataRows = rows.slice(1)
  } else {
    headers = rows[0]!.map((_, idx) => 'column_' + (idx + 1))
    dataRows = rows
  }

  dataRows = dataRows.filter((r) => r.some((c) => c.trim() !== ''))

  if (mode === 'object') {
    const obj: Record<string, unknown> = {}
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]!
      let key = String(row[keyCol] || 'row_' + i)
      if (key.trim() === '') key = 'row_' + i
      const valObj: Record<string, unknown> = {}
      for (let j = 0; j < headers.length; j++) {
        if (j === keyCol) continue
        const cellVal = row[j] !== undefined ? row[j]! : ''
        valObj[headers[j]!] = inferTypes ? inferType(cellVal) : cellVal
      }
      const fallbackKey = headers[keyCol === 0 ? 1 : 0]!
      obj[key] =
        Object.keys(valObj).length === 1 && valObj[fallbackKey] !== undefined
          ? valObj[fallbackKey]
          : valObj
    }
    return { result: obj, info: dataRows.length + ' 条记录 → 对象' }
  }

  const arr: Record<string, unknown>[] = []
  for (let a = 0; a < dataRows.length; a++) {
    const item: Record<string, unknown> = {}
    for (let b = 0; b < headers.length; b++) {
      const cell = dataRows[a]![b] !== undefined ? dataRows[a]![b]! : ''
      item[headers[b]!] = inferTypes ? inferType(cell) : cell
    }
    arr.push(item)
  }
  return { result: arr, info: arr.length + ' 条记录' }
}
