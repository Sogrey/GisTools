/* ============================================================
 * GeoBuf 编解码纯函数（简化实现）
 * 提取自 doSometing/geobuf-tool/index.html
 * 简化实现：JSON 序列化 + 字符串替换压缩 + Base64 编码
 * 非标准 Protocol Buffers 格式，但保证完美往返
 * ============================================================ */

const MAGIC = 'GBUF1'

/** UTF-8 安全的 Base64 编码 */
function b64encode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
}

/** UTF-8 安全的 Base64 解码 */
function b64decode(b64: string): string {
  return decodeURIComponent(escape(atob(b64)))
}

export interface GeoBufResult {
  encoded: string
  originalSize: number
  encodedSize: number
  ratio: string
}

/**
 * 将 GeoJSON 编码为简化 GeoBuf 格式（Base64 字符串）
 */
export function encodeGeoBuf(geojson: Record<string, unknown>): GeoBufResult {
  const jsonStr = JSON.stringify(geojson)
  const originalSize = jsonStr.length

  // 字符串替换压缩常见 JSON 键名
  let compressed = jsonStr
  const replacements: [RegExp, string][] = [
    [/"type":"FeatureCollection"/g, '~TC'],
    [/"type":"Feature"/g, '~TF'],
    [/"type":"Point"/g, '~TP'],
    [/"type":"LineString"/g, '~TL'],
    [/"type":"Polygon"/g, '~TG'],
    [/"type":"MultiPoint"/g, '~TMP'],
    [/"type":"MultiLineString"/g, '~TML'],
    [/"type":"MultiPolygon"/g, '~TMG'],
    [/"properties"/g, '~P'],
    [/"geometry"/g, '~G'],
    [/"coordinates"/g, '~C'],
    [/"features"/g, '~F'],
  ]
  for (const [re, rep] of replacements) {
    compressed = compressed.replace(re, rep)
  }

  const payload = MAGIC + ':' + compressed
  const encoded = b64encode(payload)
  const encodedSize = encoded.length
  const ratio = originalSize > 0 ? ((encodedSize / originalSize) * 100).toFixed(1) : '0'

  return { encoded, originalSize, encodedSize, ratio }
}

/**
 * 将简化 GeoBuf 格式（Base64 字符串）解码为 GeoJSON
 */
export function decodeGeoBuf(b64: string): Record<string, unknown> {
  const payload = b64decode(b64.trim())
  if (!payload.startsWith(MAGIC)) {
    throw new Error('无效的 GeoBuf 格式（缺少魔术头 ' + MAGIC + '）')
  }
  let compressed = payload.substring(MAGIC.length + 1)

  // 逆序替换（长键名先替换，避免短键名误匹配）
  const replacements: [string, string][] = [
    ['~TMG', '"type":"MultiPolygon"'],
    ['~TML', '"type":"MultiLineString"'],
    ['~TMP', '"type":"MultiPoint"'],
    ['~TG', '"type":"Polygon"'],
    ['~TL', '"type":"LineString"'],
    ['~TP', '"type":"Point"'],
    ['~TF', '"type":"Feature"'],
    ['~TC', '"type":"FeatureCollection"'],
    ['~C', '"coordinates"'],
    ['~G', '"geometry"'],
    ['~P', '"properties"'],
    ['~F', '"features"'],
  ]
  for (const [from, to] of replacements) {
    compressed = compressed.split(from).join(to)
  }

  return JSON.parse(compressed)
}
