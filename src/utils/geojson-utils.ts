/**
 * GeoJSON 工具集 — 纯函数库
 * 提取自 doSometing/geojson-toolbox、geojson-validator、geojson-meta
 * 所有函数无副作用（坐标纠偏除外，会深拷贝后再修改）
 */

import { wgs84ToGcj02, gcj02ToWgs84, gcj02ToBd09, bd09ToGcj02 } from './coord-transform'

/* ============================================================
 * 1. 类型定义
 * ============================================================ */

export type CoordSystem = 'wgs84' | 'gcj02' | 'bd09'

export type GeoJsonType =
  | 'FeatureCollection'
  | 'Feature'
  | 'GeometryCollection'
  | 'Point'
  | 'MultiPoint'
  | 'LineString'
  | 'MultiLineString'
  | 'Polygon'
  | 'MultiPolygon'

const GEOM_TYPES: readonly string[] = [
  'Point', 'MultiPoint', 'LineString', 'MultiLineString',
  'Polygon', 'MultiPolygon', 'GeometryCollection',
]

/* ============================================================
 * 2. 带行号追踪的 JSON 解析器（用于校验错误定位）
 * ============================================================ */

export interface ParseError extends Error {
  line?: number
  col?: number
}

export interface ParsedJson {
  value: unknown
  lineMap: Map<string, number>
}

export function parseJsonWithLines(text: string): ParsedJson {
  let pos = 0
  let line = 1
  let col = 1
  const lineMap = new Map<string, number>()

  // 去 BOM
  if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1)

  function err(msg: string): never {
    const e = new Error(msg) as ParseError
    e.line = line
    e.col = col
    throw e
  }
  function adv(n = 1): void {
    for (let k = 0; k < n; k++) {
      if (text[pos] === '\n') { line++; col = 1 } else { col++ }
      pos++
    }
  }
  function ws(): void {
    while (pos < text.length && /[\s]/.test(text[pos]!)) adv()
  }
  function cur(): string {
    return pos < text.length ? text[pos]! : ''
  }
  function expect(ch: string): void {
    ws()
    if (cur() !== ch) err(`期望 '${ch}'，但得到 '${cur() || 'EOF'}'`)
    adv()
  }

  function parseStr(): string {
    ws()
    if (cur() !== '"') err('期望字符串')
    adv()
    let r = ''
    while (pos < text.length && cur() !== '"') {
      if (cur() === '\\') {
        adv()
        const e = cur()
        if (e === 'u') {
          adv()
          let h = ''
          for (let k = 0; k < 4; k++) { h += cur(); adv() }
          r += String.fromCharCode(parseInt(h, 16))
          continue
        }
        const m: Record<string, string> = {
          n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f',
        }
        r += m[e] !== undefined ? m[e] : e
        adv()
      } else {
        r += cur()
        adv()
      }
    }
    if (pos >= text.length) err('字符串未闭合')
    adv()
    return r
  }

  function parseNum(): number {
    ws()
    const s = pos
    if (cur() === '-') adv()
    while (pos < text.length && /[0-9.eE+\-]/.test(cur())) adv()
    const str = text.substring(s, pos)
    if (!str || str === '-') err('无效数字')
    const n = Number(str)
    if (isNaN(n)) err('无效数字')
    return n
  }

  function parseVal(path: string): unknown {
    ws()
    const ln = line
    const ch = cur()
    if (ch === '{') return parseObj(path, ln)
    if (ch === '[') return parseArr(path, ln)
    if (ch === '"') { const s = parseStr(); lineMap.set(path, ln); return s }
    if (ch === 't') { if (text.substring(pos, pos + 4) !== 'true') err('期望 true'); adv(4); lineMap.set(path, ln); return true }
    if (ch === 'f') { if (text.substring(pos, pos + 5) !== 'false') err('期望 false'); adv(5); lineMap.set(path, ln); return false }
    if (ch === 'n') { if (text.substring(pos, pos + 4) !== 'null') err('期望 null'); adv(4); lineMap.set(path, ln); return null }
    if (ch === '-' || /[0-9]/.test(ch)) { const n = parseNum(); lineMap.set(path, ln); return n }
    err(`意外字符 '${ch}'`)
  }

  function parseObj(path: string, ln: number): Record<string, unknown> {
    const o: Record<string, unknown> = {}
    lineMap.set(path, ln)
    adv()
    ws()
    if (cur() === '}') { adv(); return o }
    for (;;) {
      ws()
      const k = parseStr()
      ws()
      expect(':')
      o[k] = parseVal(path ? path + '.' + k : k)
      ws()
      if (cur() === ',') { adv(); continue }
      if (cur() === '}') { adv(); break }
      err('期望 , 或 }')
    }
    return o
  }

  function parseArr(path: string, ln: number): unknown[] {
    const a: unknown[] = []
    lineMap.set(path, ln)
    adv()
    ws()
    if (cur() === ']') { adv(); return a }
    let i = 0
    for (;;) {
      a.push(parseVal(path + '[' + i + ']'))
      ws()
      if (cur() === ',') { adv(); i++; continue }
      if (cur() === ']') { adv(); break }
      err('期望 , 或 ]')
    }
    return a
  }

  const v = parseVal('root')
  ws()
  if (pos < text.length) err('JSON 后有多余内容')
  return { value: v, lineMap }
}

/* ============================================================
 * 3. RFC 7946 结构校验器
 * ============================================================ */

export type ValidationErrorType =
  | 'SYNTAX_ERROR'
  | 'TYPE_ERROR'
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_LENGTH'
  | 'INSUFFICIENT'
  | 'NOT_CLOSED'
  | 'EMPTY'

export interface ValidationError {
  type: ValidationErrorType
  path: string
  message: string
  suggestion: string
  line: number | null
}

export interface ValidationResult {
  syntaxError?: { message: string; line: number | null; col: number | null }
  errors: ValidationError[]
  ok: boolean
}

export function validateGeoJson(text: string): ValidationResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { errors: [], ok: false }
  }

  let parsed: ParsedJson
  try {
    parsed = parseJsonWithLines(trimmed)
  } catch (e) {
    const pe = e as ParseError
    return {
      errors: [],
      ok: false,
      syntaxError: {
        message: pe.message || '解析失败',
        line: pe.line ?? null,
        col: pe.col ?? null,
      },
    }
  }

  const errors = validateStructure(parsed.value, parsed.lineMap)
  return { errors, ok: errors.length === 0 }
}

function validateStructure(obj: unknown, lineMap: Map<string, number>): ValidationError[] {
  const errors: ValidationError[] = []

  function getLine(path: string): number | null {
    if (!lineMap) return null
    if (lineMap.has(path)) return lineMap.get(path) ?? null
    const parent = path.replace(/(\.[^.]+|\[\d+\])$/, '')
    if (parent !== path) return getLine(parent)
    return null
  }
  function addError(
    type: ValidationErrorType, path: string, message: string, suggestion: string,
  ): void {
    errors.push({ type, path, message, suggestion, line: getLine(path) })
  }

  function pointsEqual(a: unknown, b: unknown): boolean {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  function validateCoords(path: string, coords: unknown, depth: number): void {
    if (!Array.isArray(coords)) {
      addError('TYPE_ERROR', path, 'coordinates 必须是数组', '确保 coordinates 为数组')
      return
    }
    if (coords.length === 0) {
      addError('EMPTY', path, 'coordinates 数组为空', '提供有效坐标')
      return
    }
    if (depth <= 1) {
      for (let i = 0; i < coords.length; i++) {
        if (typeof coords[i] !== 'number')
          addError('TYPE_ERROR', path + '[' + i + ']', '坐标元素必须是数字，得到 ' + typeof coords[i], '确保叶子元素为 number')
      }
    } else {
      for (let j = 0; j < coords.length; j++) {
        if (!Array.isArray(coords[j]))
          addError('TYPE_ERROR', path + '[' + j + ']', '坐标嵌套不足，期望数组', '确保该层级为数组')
        else
          validateCoords(path + '[' + j + ']', coords[j], depth - 1)
      }
    }
  }

  function validateGeometry(path: string, geom: unknown): void {
    if (geom === null) return
    if (typeof geom !== 'object' || Array.isArray(geom)) {
      addError('TYPE_ERROR', path, 'geometry 必须是对象', '确保 geometry 为 GeoJSON Geometry 对象')
      return
    }
    const g = geom as Record<string, unknown>
    if (!g.type) { addError('MISSING_FIELD', path, 'geometry 缺少 type 字段', '添加 type 字段'); return }
    if (GEOM_TYPES.indexOf(g.type as string) === -1) {
      addError('INVALID_TYPE', path + '.type', '无效的 geometry type: ' + g.type, 'type 必须是: ' + GEOM_TYPES.join(' / '))
      return
    }
    if (g.type === 'GeometryCollection') {
      if (!('geometries' in g)) { addError('MISSING_FIELD', path + '.geometries', 'GeometryCollection 缺少 geometries', '添加 geometries 数组'); return }
      if (!Array.isArray(g.geometries)) { addError('TYPE_ERROR', path + '.geometries', 'geometries 必须是数组', '确保 geometries 为数组'); return }
      for (let i = 0; i < g.geometries.length; i++) validateGeometry(path + '.geometries[' + i + ']', g.geometries[i])
      return
    }
    if (!('coordinates' in g)) { addError('MISSING_FIELD', path + '.coordinates', g.type + ' 缺少 coordinates', '添加 coordinates 字段'); return }
    const cp = path + '.coordinates'
    const c = g.coordinates

    switch (g.type) {
      case 'Point':
        if (!Array.isArray(c)) { addError('TYPE_ERROR', cp, 'Point coordinates 必须是数组', '使用 [lng, lat] 格式'); break }
        if (c.length < 2) { addError('INSUFFICIENT', cp, 'Point coordinates 至少 2 个元素，得到 ' + c.length, '至少需要 [经度, 纬度]'); break }
        validateCoords(cp, c, 1)
        break
      case 'MultiPoint':
        if (!Array.isArray(c)) { addError('TYPE_ERROR', cp, 'coordinates 必须是数组', '使用 [[lng,lat],...] 格式'); break }
        validateCoords(cp, c, 2)
        if (c.length < 1) addError('INSUFFICIENT', cp, 'MultiPoint 至少 1 个点', '提供至少 1 个点')
        break
      case 'LineString':
        if (!Array.isArray(c)) { addError('TYPE_ERROR', cp, 'coordinates 必须是数组', '使用 [[lng,lat],...] 格式'); break }
        validateCoords(cp, c, 2)
        if (c.length < 2) addError('INSUFFICIENT', cp, 'LineString 至少 2 个点，得到 ' + c.length, '提供至少 2 个点')
        break
      case 'MultiLineString':
        if (!Array.isArray(c)) { addError('TYPE_ERROR', cp, 'coordinates 必须是数组', '使用 [[[lng,lat],...],...] 格式'); break }
        validateCoords(cp, c, 3)
        if (c.length < 1) addError('INSUFFICIENT', cp, 'MultiLineString 至少 1 条线', '提供至少 1 条线')
        for (let i = 0; i < c.length; i++) {
          if (Array.isArray(c[i]) && c[i].length < 2)
            addError('INSUFFICIENT', cp + '[' + i + ']', '第 ' + i + ' 条线至少 2 个点', '每条线至少 2 个点')
        }
        break
      case 'Polygon':
        if (!Array.isArray(c)) { addError('TYPE_ERROR', cp, 'coordinates 必须是数组', '使用 [[[lng,lat],...],...] 格式'); break }
        validateCoords(cp, c, 3)
        if (c.length < 1) { addError('INSUFFICIENT', cp, 'Polygon 至少 1 个环', '提供至少 1 个环'); break }
        for (let i = 0; i < c.length; i++) {
          const ring = c[i]
          if (!Array.isArray(ring)) { addError('TYPE_ERROR', cp + '[' + i + ']', '环必须是数组', '确保环为数组'); continue }
          if (ring.length < 4) {
            addError('INSUFFICIENT', cp + '[' + i + ']', '环 ' + i + ' 至少 4 个点，得到 ' + ring.length, '每个环至少 4 个点（首尾闭合）')
          } else {
            if (!pointsEqual(ring[0], ring[ring.length - 1]))
              addError('NOT_CLOSED', cp + '[' + i + ']', '环 ' + i + ' 未闭合（首尾点不同）', '首尾点必须相同以闭合环')
          }
        }
        break
      case 'MultiPolygon':
        if (!Array.isArray(c)) { addError('TYPE_ERROR', cp, 'coordinates 必须是数组', '使用 [[[[lng,lat],...],...],...] 格式'); break }
        validateCoords(cp, c, 4)
        if (c.length < 1) { addError('INSUFFICIENT', cp, 'MultiPolygon 至少 1 个多边形', '提供至少 1 个多边形'); break }
        for (let i = 0; i < c.length; i++) {
          const poly = c[i]
          if (!Array.isArray(poly)) { addError('TYPE_ERROR', cp + '[' + i + ']', '多边形必须是数组', '确保多边形为数组'); continue }
          if (poly.length < 1) { addError('INSUFFICIENT', cp + '[' + i + ']', '多边形 ' + i + ' 至少 1 个环', '至少 1 个环'); continue }
          for (let j = 0; j < poly.length; j++) {
            const ring = poly[j]
            if (!Array.isArray(ring)) { addError('TYPE_ERROR', cp + '[' + i + '][' + j + ']', '环必须是数组', '确保环为数组'); continue }
            if (ring.length < 4) {
              addError('INSUFFICIENT', cp + '[' + i + '][' + j + ']', '多边形 ' + i + ' 环 ' + j + ' 至少 4 个点，得到 ' + ring.length, '每个环至少 4 个点')
            } else {
              if (!pointsEqual(ring[0], ring[ring.length - 1]))
                addError('NOT_CLOSED', cp + '[' + i + '][' + j + ']', '多边形 ' + i + ' 环 ' + j + ' 未闭合', '首尾点必须相同')
            }
          }
        }
        break
    }
  }

  function validateFeature(path: string, f: unknown): void {
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      addError('TYPE_ERROR', path, 'Feature 必须是对象', '确保 Feature 为对象')
      return
    }
    const feat = f as Record<string, unknown>
    if (feat.type !== 'Feature') addError('INVALID_TYPE', path + '.type', '期望 "Feature"，得到 "' + feat.type + '"', 'type 应为 "Feature"')
    if (!('properties' in feat)) addError('MISSING_FIELD', path + '.properties', 'Feature 缺少 properties', '添加 properties（可为空对象 {}）')
    if (!('geometry' in feat)) {
      addError('MISSING_FIELD', path + '.geometry', 'Feature 缺少 geometry', '添加 geometry（可为 null）')
    } else {
      validateGeometry(path + '.geometry', feat.geometry)
    }
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    addError('TYPE_ERROR', 'root', '顶层必须是对象', 'GeoJSON 顶层必须是对象')
    return errors
  }
  const o = obj as Record<string, unknown>
  if (!o.type) { addError('MISSING_FIELD', 'root.type', '缺少 type 字段', '添加 type 字段'); return errors }

  if ('bbox' in o) {
    const bbox = o.bbox
    if (!Array.isArray(bbox)) {
      addError('TYPE_ERROR', 'root.bbox', 'bbox 必须是数组', 'bbox 应为数组')
    } else if (bbox.length !== 4 && bbox.length !== 6) {
      addError('INVALID_LENGTH', 'root.bbox', 'bbox 应为 4 或 6 个元素，得到 ' + bbox.length, 'bbox 为 [minX,minY,maxX,maxY] 或 [minX,minY,minZ,maxX,maxY,maxZ]')
    } else {
      for (let i = 0; i < bbox.length; i++) {
        if (typeof bbox[i] !== 'number') addError('TYPE_ERROR', 'root.bbox[' + i + ']', 'bbox 元素 ' + i + ' 必须是数字', 'bbox 元素为数字')
      }
    }
  }

  switch (o.type) {
    case 'FeatureCollection':
      if (!Array.isArray(o.features)) {
        addError('MISSING_FIELD', 'root.features', 'FeatureCollection 缺少 features 数组', '添加 features 数组')
      } else {
        for (let i = 0; i < o.features.length; i++) validateFeature('root.features[' + i + ']', o.features[i])
      }
      break
    case 'Feature':
      validateFeature('root', obj)
      break
    default:
      if (GEOM_TYPES.indexOf(o.type as string) !== -1) validateGeometry('root', obj)
      else addError('INVALID_TYPE', 'root.type', '无效的顶层 type: "' + o.type + '"', 'type 必须是 FeatureCollection / Feature / Geometry')
  }

  return errors
}

/* ============================================================
 * 4. 美化 / 压缩
 * ============================================================ */

export function prettyPrint(text: string, indent = 2): { output: string; error?: string } {
  const trimmed = text.trim()
  if (!trimmed) return { output: '', error: '请先输入 GeoJSON' }
  try {
    const obj = JSON.parse(trimmed)
    return { output: JSON.stringify(obj, null, indent) }
  } catch (e) {
    return { output: '', error: 'JSON 解析失败: ' + (e as Error).message }
  }
}

export function minify(text: string): { output: string; error?: string; saved?: number } {
  const trimmed = text.trim()
  if (!trimmed) return { output: '', error: '请先输入 GeoJSON' }
  try {
    const obj = JSON.parse(trimmed)
    const out = JSON.stringify(obj)
    return { output: out, saved: trimmed.length - out.length }
  } catch (e) {
    return { output: '', error: 'JSON 解析失败: ' + (e as Error).message }
  }
}

/* ============================================================
 * 5. 坐标纠偏 WGS84 ↔ GCJ02 ↔ BD09
 * ============================================================ */

/* 纠偏公式复用 coord-transform 底座 */
function convertPair(src: CoordSystem, dst: CoordSystem, lng: number, lat: number): [number, number] {
  if (src === dst) return [lng, lat]
  if (src === 'wgs84' && dst === 'gcj02') return wgs84ToGcj02(lng, lat)
  if (src === 'wgs84' && dst === 'bd09') {
    const g = wgs84ToGcj02(lng, lat)
    return gcj02ToBd09(g[0], g[1])
  }
  if (src === 'gcj02' && dst === 'wgs84') return gcj02ToWgs84(lng, lat)
  if (src === 'gcj02' && dst === 'bd09') return gcj02ToBd09(lng, lat)
  if (src === 'bd09' && dst === 'gcj02') return bd09ToGcj02(lng, lat)
  if (src === 'bd09' && dst === 'wgs84') {
    const g = bd09ToGcj02(lng, lat)
    return gcj02ToWgs84(g[0], g[1])
  }
  return [lng, lat]
}

/** 递归遍历坐标数组，对每个 [lng, lat] 点执行转换 */
function walkCoords(obj: unknown, fn: (lng: number, lat: number) => [number, number]): number {
  let count = 0
  function rec(o: unknown): void {
    if (o === null || o === undefined) return
    if (Array.isArray(o)) {
      if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number') {
        const r = fn(o[0], o[1])
        if (r) { o[0] = r[0]; o[1] = r[1] }
        count++
      } else {
        for (let i = 0; i < o.length; i++) rec(o[i])
      }
    } else if (typeof o === 'object') {
      for (const k in o) rec((o as Record<string, unknown>)[k])
    }
  }
  rec(obj)
  return count
}

export interface ConvertResult {
  output: string
  error?: string
  pointCount?: number
}

export function convertCoordinates(
  text: string,
  src: CoordSystem,
  dst: CoordSystem,
): ConvertResult {
  const trimmed = text.trim()
  if (!trimmed) return { output: '', error: '请先输入 GeoJSON' }
  let obj: unknown
  try {
    obj = JSON.parse(trimmed)
  } catch (e) {
    return { output: '', error: 'JSON 解析失败: ' + (e as Error).message }
  }
  if (src === dst) {
    return { output: JSON.stringify(obj, null, 2), pointCount: 0 }
  }
  // 深拷贝，不修改原数据
  const work = JSON.parse(JSON.stringify(obj))
  const n = walkCoords(work, (lng, lat) => convertPair(src, dst, lng, lat))
  return { output: JSON.stringify(work, null, 2), pointCount: n }
}

/* ============================================================
 * 6. 元数据报告
 * ============================================================ */

export interface BBoxInfo {
  minX: number
  minY: number
  maxX: number
  maxY: number
  minZ?: number
  maxZ?: number
}

export interface FieldStat {
  name: string
  types: Record<string, number>
  typeOrder: string[]
  nonNull: number
  total: number
  unique: Record<string, boolean>
}

export interface GeoJsonMeta {
  topLevelType: string
  featureCount: number
  geomTypes: Record<string, number>
  fieldStats: Record<string, FieldStat>
  bbox: BBoxInfo | null
  coordCount: number
  has3D: boolean
  has2D: boolean
  hasCrs: boolean
  crsInfo: string | null
  hasBboxField: boolean
  bboxField: number[] | null
  dataSize: { chars: number; bytes: number; kb: number }
}

function getCoordDepth(geomType: string): number {
  switch (geomType) {
    case 'Point': return 1
    case 'MultiPoint': return 2
    case 'LineString': return 2
    case 'MultiLineString': return 3
    case 'Polygon': return 3
    case 'MultiPolygon': return 4
    default: return 0
  }
}

function forEachCoord(coords: unknown, depth: number, cb: (pt: number[]) => void): void {
  if (!Array.isArray(coords)) return
  if (depth <= 1) {
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      cb(coords as number[])
    }
  } else {
    for (let i = 0; i < coords.length; i++) {
      forEachCoord(coords[i], depth - 1, cb)
    }
  }
}

function extractGeometryInfo(geom: unknown, stats: Pick<GeoJsonMeta, 'geomTypes' | 'bbox' | 'coordCount' | 'has3D' | 'has2D'>): void {
  if (geom === null || geom === undefined) return
  if (typeof geom !== 'object' || !geom) return
  const g = geom as Record<string, unknown>
  if (!g.type) return
  const gtype = g.type as string
  if (GEOM_TYPES.indexOf(gtype) === -1) return

  stats.geomTypes[gtype] = (stats.geomTypes[gtype] || 0) + 1

  if (gtype === 'GeometryCollection') {
    if (Array.isArray(g.geometries)) {
      for (let i = 0; i < g.geometries.length; i++) {
        extractGeometryInfo(g.geometries[i], stats)
      }
    }
    return
  }

  const coords = g.coordinates
  if (!Array.isArray(coords)) return

  const depth = getCoordDepth(gtype)
  forEachCoord(coords, depth, (pt) => {
    stats.coordCount++
    if (stats.bbox === null) {
      stats.bbox = { minX: pt[0]!, minY: pt[1]!, maxX: pt[0]!, maxY: pt[1]! }
    } else {
      if (pt[0]! < stats.bbox.minX) stats.bbox.minX = pt[0]!
      if (pt[1]! < stats.bbox.minY) stats.bbox.minY = pt[1]!
      if (pt[0]! > stats.bbox.maxX) stats.bbox.maxX = pt[0]!
      if (pt[1]! > stats.bbox.maxY) stats.bbox.maxY = pt[1]!
    }
    if (pt.length >= 3 && typeof pt[2] === 'number') {
      stats.has3D = true
      if (stats.bbox!.minZ === undefined || pt[2] < stats.bbox!.minZ) stats.bbox!.minZ = pt[2]
      if (stats.bbox!.maxZ === undefined || pt[2] > stats.bbox!.maxZ) stats.bbox!.maxZ = pt[2]
    } else {
      stats.has2D = true
    }
  })
}

function getTypeName(val: unknown): string {
  if (val === null || val === undefined) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}

function collectProperties(props: unknown, fieldStats: Record<string, FieldStat>): void {
  if (!props || typeof props !== 'object') return
  const p = props as Record<string, unknown>
  const keys = Object.keys(p)
  for (const key of keys) {
    const val = p[key]
    const t = getTypeName(val)

    if (!fieldStats[key]) {
      fieldStats[key] = { name: key, types: {}, nonNull: 0, total: 0, unique: {}, typeOrder: [] }
    }
    const fs = fieldStats[key]
    fs.total++
    if (fs.types[t] === undefined) { fs.types[t] = 0; fs.typeOrder.push(t) }
    fs.types[t]++
    if (val !== null && val !== undefined) {
      fs.nonNull++
      try {
        const key2 = typeof val === 'object' ? JSON.stringify(val) : String(val)
        fs.unique[key2] = true
      } catch { /* ignore */ }
    }
  }
}

function calcSize(text: string): { chars: number; bytes: number; kb: number } {
  const chars = text.length
  let bytes = 0
  for (let i = 0; i < chars; i++) {
    const c = text.charCodeAt(i)
    if (c < 0x80) bytes += 1
    else if (c < 0x800) bytes += 2
    else if (c >= 0xD800 && c <= 0xDBFF) { bytes += 4; i++ }
    else bytes += 3
  }
  return { chars, bytes, kb: bytes / 1024 }
}

export interface MetaResult {
  meta?: GeoJsonMeta
  error?: string
}

export function analyzeGeoJson(text: string): MetaResult {
  const trimmed = text.trim()
  if (!trimmed) return { error: '请先输入 GeoJSON' }

  const size = calcSize(trimmed)
  let obj: unknown
  try {
    obj = JSON.parse(trimmed)
  } catch (e) {
    return { error: 'JSON 解析失败: ' + (e as Error).message }
  }

  try {
    const stats: GeoJsonMeta = {
      topLevelType: 'Unknown',
      featureCount: 0,
      geomTypes: {},
      fieldStats: {},
      bbox: null,
      coordCount: 0,
      has3D: false,
      has2D: false,
      hasCrs: false,
      crsInfo: null,
      hasBboxField: false,
      bboxField: null,
      dataSize: size,
    }

    if (typeof obj !== 'object' || obj === null) throw new Error('顶层不是有效 JSON 对象')
    const o = obj as Record<string, unknown>
    if (!o.type) throw new Error('缺少 type 字段')

    stats.topLevelType = o.type as string

    if (o.crs !== undefined && o.crs !== null) {
      stats.hasCrs = true
      try { stats.crsInfo = JSON.stringify(o.crs) } catch { stats.crsInfo = String(o.crs) }
    }

    if (o.bbox !== undefined && o.bbox !== null && Array.isArray(o.bbox)) {
      stats.hasBboxField = true
      stats.bboxField = o.bbox as number[]
    }

    let features: unknown[] = []
    if (o.type === 'FeatureCollection') {
      if (Array.isArray(o.features)) features = o.features
    } else if (o.type === 'Feature') {
      features = [obj]
    } else if (GEOM_TYPES.indexOf(o.type as string) !== -1) {
      extractGeometryInfo(obj, stats)
    } else {
      throw new Error('无效的 type: "' + o.type + '"')
    }

    stats.featureCount = features.length

    for (let i = 0; i < features.length; i++) {
      const f = features[i]
      if (!f || typeof f !== 'object') continue
      const feat = f as Record<string, unknown>
      if (feat.properties) collectProperties(feat.properties, stats.fieldStats)
      if (feat.geometry) extractGeometryInfo(feat.geometry, stats)
    }

    return { meta: stats }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/* ============================================================
 * 7. 辅助函数
 * ============================================================ */

export function typeName(gj: unknown): string {
  if (!gj || typeof gj !== 'object') return '—'
  const o = gj as Record<string, unknown>
  if (o.type === 'FeatureCollection') return '要素集合'
  if (o.type === 'Feature') return '要素'
  if (o.type === 'GeometryCollection') return '几何集合'
  return '几何:' + (o.type || '?')
}

export function countCoords(obj: unknown): number {
  let n = 0
  function rec(o: unknown): void {
    if (Array.isArray(o)) {
      if (o.length >= 2 && typeof o[0] === 'number' && typeof o[1] === 'number') n++
      else for (let i = 0; i < o.length; i++) rec(o[i])
    } else if (typeof o === 'object' && o) {
      for (const k in o) rec((o as Record<string, unknown>)[k])
    }
  }
  rec(obj)
  return n
}

export function parseFeatures(gj: unknown): Record<string, unknown>[] {
  if (!gj || typeof gj !== 'object') return []
  const o = gj as Record<string, unknown>
  if (o.type === 'FeatureCollection') return (o.features as Record<string, unknown>[]) || []
  if (o.type === 'Feature') return [o]
  return []
}

export function fmtSize(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return bytes + ' B'
}

export function fmtNum(n: number | undefined | null, digits?: number): string {
  if (n === undefined || n === null) return '—'
  if (typeof n !== 'number' || !isFinite(n)) return String(n)
  if (digits !== undefined) return n.toFixed(digits)
  return String(n)
}

export function fmtBbox(bbox: BBoxInfo | null): string {
  if (!bbox) return '—'
  if (bbox.minZ !== undefined) {
    return `[${fmtNum(bbox.minX, 6)}, ${fmtNum(bbox.minY, 6)}, ${fmtNum(bbox.minZ, 3)}, ${fmtNum(bbox.maxX, 6)}, ${fmtNum(bbox.maxY, 6)}, ${fmtNum(bbox.maxZ, 3)}]`
  }
  return `[${fmtNum(bbox.minX, 6)}, ${fmtNum(bbox.minY, 6)}, ${fmtNum(bbox.maxX, 6)}, ${fmtNum(bbox.maxY, 6)}]`
}
