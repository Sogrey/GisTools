/* ============================================================
 * TileJSON 查看器 · 核心逻辑
 * 瓦片服务元数据解析 · tiles / bounds / zoom / 校验 / 中心瓦片预览
 * 提取自 doSometing/tilejson-viewer/index.html
 * ============================================================ */

import { lngToTileX, latToTileYClamped } from './tile-tools'

const TILE_JSON_KEYS = ['tilejson', 'name', 'description', 'version', 'scheme', 'tiles', 'grids', 'data',
  'bounds', 'center', 'minzoom', 'maxzoom', 'attribution', 'template', 'format', 'vector_layers']

export interface TileJsonValidation {
  errors: string[]
  warnings: string[]
  format: string
  isVector: boolean
}

export function validateTileJson(obj: unknown): TileJsonValidation {
  const errors: string[] = []
  const warnings: string[] = []
  let format = ''
  let isVector = false
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errors.push('根节点必须是 JSON 对象')
    return { errors, warnings, format, isVector }
  }
  const o = obj as Record<string, unknown>
  if (!o.tilejson) {
    warnings.push('缺少 tilejson 版本字段（如 "2.2.0"）')
  } else if (!/^"?\d+\.\d+/.test(String(o.tilejson))) {
    warnings.push(`tilejson 字段值 "${o.tilejson}" 不像版本号`)
  }
  if (!Array.isArray(o.tiles) || !o.tiles.length) {
    errors.push('缺少 tiles 字段（必需，瓦片 URL 模板数组）')
  } else {
    for (let i = 0; i < o.tiles.length; i++) {
      const t = o.tiles[i] as string
      if (typeof t !== 'string' || !t) {
        errors.push(`tiles[${i}] 不是有效字符串`)
        continue
      }
      if (!/^https?:\/\//i.test(t) && t.indexOf('://') < 0) {
        warnings.push(`tiles[${i}] 不是 http(s) URL：${t.slice(0, 60)}`)
      }
      if (!/\{z\}|\{x\}|\{y\}|\{-y\}/.test(t)) {
        errors.push(`tiles[${i}] 缺少 {z}/{x}/{y} 占位符`)
      }
    }
  }
  if (o.bounds !== undefined && o.bounds !== null) {
    const b = o.bounds as number[]
    if (!Array.isArray(b) || b.length !== 4 || !b.every(x => typeof x === 'number' && isFinite(x))) {
      errors.push('bounds 必须为 [西, 南, 东, 北] 4 个数字')
    } else {
      if (!(b[0]! < b[2]!)) errors.push(`bounds 经度方向错误：西(${b[0]!}) 应小于东(${b[2]!})`)
      if (!(b[1]! < b[3]!)) errors.push(`bounds 纬度方向错误：南(${b[1]!}) 应小于北(${b[3]!})`)
      if (b[0]! < -180.0001 || b[2]! > 180.0001 || b[1]! < -90.0001 || b[3]! > 85.0513) {
        warnings.push('bounds 超出 Web 墨卡托有效范围（经 ±180°，纬约 ±85.05°）')
      }
    }
  } else {
    warnings.push('缺少 bounds 字段，预览将按全球范围中心计算')
  }
  if (o.center !== undefined && o.center !== null) {
    const c = o.center as number[]
    if (!Array.isArray(c) || c.length !== 3 || !c.every(x => typeof x === 'number')) {
      warnings.push('center 应为 [经度, 纬度, 缩放级别] 3 个数字')
    }
  }
  const minz = o.minzoom as number, maxz = o.maxzoom as number
  if (minz === undefined) warnings.push('缺少 minzoom（默认按 0 处理）')
  if (maxz === undefined) warnings.push('缺少 maxzoom（默认按 22 处理）')
  if (typeof minz === 'number' && typeof maxz === 'number' && minz > maxz) {
    errors.push(`minzoom(${minz}) 大于 maxzoom(${maxz})`)
  }
  if (o.scheme !== undefined && o.scheme !== null && o.scheme !== 'xyz' && o.scheme !== 'tms') {
    warnings.push(`scheme 值 "${o.scheme}" 非规范取值（应为 xyz 或 tms）`)
  }
  format = (o.format as string) || ''
  if (!format) {
    const first = Array.isArray(o.tiles) && o.tiles.length ? String(o.tiles[0]) : ''
    const m = first.match(/\.(png|jpe?g|webp|mvt|pbf|gif)(?=[?#]|$)/i)
    if (m) {
      format = m[1]!.toLowerCase()
      if (format === 'jpeg') format = 'jpg'
      warnings.push(`未声明 format，按瓦片扩展名推断为 "${format}"`)
    }
  }
  isVector = /^(pbf|mvt|vector)$/.test(String(format)) ||
    (Array.isArray(o.vector_layers) && (o.vector_layers as unknown[]).length > 0)
  return { errors, warnings, format, isVector }
}

export interface TileJsonData {
  tilejson: string
  name: string
  description: string
  version: string
  scheme: string
  tiles: string[]
  grids: string[]
  data: string[]
  bounds: number[] | null
  center: number[] | null
  minzoom: number
  maxzoom: number
  attribution: string
  template: string
  vectorLayers: Record<string, unknown>[]
  otherKeys: string[]
}

export interface TileJsonResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  format: string
  isVector: boolean
  data: TileJsonData
}

export function parseTileJson(text: string): TileJsonResult {
  const out = { ok: false, errors: [] as string[], warnings: [] as string[], format: '', isVector: false } as TileJsonResult
  if (!text || !String(text).trim()) { out.errors.push('输入为空'); return out }
  let obj: Record<string, unknown>
  try {
    obj = JSON.parse(text)
  } catch (e) {
    out.errors.push('JSON 解析失败：' + (e as Error).message)
    return out
  }
  const v = validateTileJson(obj)
  out.errors = v.errors
  out.warnings = v.warnings
  out.format = v.format
  out.isVector = v.isVector
  out.data = {
    tilejson: (obj.tilejson as string) || '',
    name: (obj.name as string) || '',
    description: (obj.description as string) || '',
    version: (obj.version as string) || '',
    scheme: (obj.scheme as string) || 'xyz',
    tiles: Array.isArray(obj.tiles) ? obj.tiles as string[] : [],
    grids: Array.isArray(obj.grids) ? obj.grids as string[] : [],
    data: Array.isArray(obj.data) ? obj.data as string[] : [],
    bounds: Array.isArray(obj.bounds) ? obj.bounds as number[] : null,
    center: Array.isArray(obj.center) ? obj.center as number[] : null,
    minzoom: typeof obj.minzoom === 'number' ? obj.minzoom : 0,
    maxzoom: typeof obj.maxzoom === 'number' ? obj.maxzoom : 22,
    attribution: (obj.attribution as string) || '',
    template: (obj.template as string) || '',
    vectorLayers: Array.isArray(obj.vector_layers) ? obj.vector_layers as Record<string, unknown>[] : [],
    otherKeys: []
  }
  for (const k in obj) {
    if (TILE_JSON_KEYS.indexOf(k) < 0) out.data.otherKeys.push(k)
  }
  out.ok = out.errors.length === 0
  return out
}

export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = Math.pow(2, z)
  let x = lngToTileX(lon, z)
  let y = latToTileYClamped(lat, n)
  x = Math.max(0, Math.min(n - 1, x))
  y = Math.max(0, Math.min(n - 1, y))
  return { x, y }
}

export interface PreviewResult {
  url: string
  z: number
  x: number
  y: number
  tmsY: number
}

export function previewTileUrl(template: string, opts: { lon?: number; lat?: number; z?: number; scheme?: string }): PreviewResult {
  const lon = typeof opts.lon === 'number' ? opts.lon : 0
  const lat = typeof opts.lat === 'number' ? opts.lat : 0
  const z = typeof opts.z === 'number' ? Math.max(0, Math.min(22, Math.floor(opts.z))) : 0
  const scheme = opts.scheme || 'xyz'
  const t = lonLatToTile(lon, lat, z)
  const n = Math.pow(2, z)
  const tmsY = n - 1 - t.y
  const hasNegY = String(template).indexOf('{-y}') >= 0
  const y = (scheme === 'tms' || hasNegY) ? tmsY : t.y
  let url = String(template)
    .replace(/\{z\}/g, String(z))
    .replace(/\{x\}/g, String(t.x))
  if (hasNegY) {
    url = url.replace(/\{-y\}/g, String(y))
  } else {
    url = url.replace(/\{y\}/g, String(y))
  }
  return { url, z, x: t.x, y: t.y, tmsY }
}

export const SAMPLE_RASTER = JSON.stringify({
  tilejson: '2.2.0', name: '示例栅格底图', description: '演示用 TileJSON（示例数据）',
  version: '1.0.0', scheme: 'xyz',
  tiles: ['https://example.com/basemap/{z}/{x}/{y}.png'],
  minzoom: 0, maxzoom: 18, bounds: [116.0, 39.8, 116.8, 40.1],
  center: [116.4, 39.95, 10], attribution: '© 示例数据提供方'
}, null, 2)

export const SAMPLE_VECTOR = JSON.stringify({
  tilejson: '2.1.0', name: '示例矢量数据', version: '0.9.5', scheme: 'xyz', format: 'pbf',
  tiles: ['https://example.com/vectortiles/{z}/{x}/{y}.mvt'],
  minzoom: 4, maxzoom: 14, bounds: [115.5, 39.4, 117.2, 41.1],
  attribution: '© 示例数据提供方',
  vector_layers: [
    { id: 'road', description: '道路中心线', fields: { kind: 'String', name: 'String' } },
    { id: 'water', description: '水系面', fields: { name: 'String' } }
  ]
}, null, 2)
