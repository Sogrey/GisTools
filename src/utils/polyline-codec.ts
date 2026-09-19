/* ============================================================
 * Encoded Polyline 编解码纯函数
 * 提取自 doSometing/encoded-polyline/index.html
 * Google Encoded Polyline 格式 · delta 编码 · 5-bit 分组
 * ============================================================ */

export type Coord = [number, number]

/**
 * 将坐标数组编码为 Encoded Polyline 字符串
 * @param coords [[lng, lat], ...] 坐标数组
 * @param precision 5（标准 1e5）或 6（高精度 1e6）
 */
export function encodePolyline(coords: Coord[], precision = 5): string {
  if (!coords || coords.length === 0) return ''
  const factor = Math.pow(10, precision)
  let result = ''
  let prevLng = 0
  let prevLat = 0
  for (let i = 0; i < coords.length; i++) {
    const lng = coords[i]![0]
    const lat = coords[i]![1]
    const dLng = Math.round(lng * factor) - prevLng
    const dLat = Math.round(lat * factor) - prevLat
    result += encodeSigned(dLat)
    result += encodeSigned(dLng)
    prevLng = Math.round(lng * factor)
    prevLat = Math.round(lat * factor)
  }
  return result
}

/**
 * 将有符号整数编码为 polyline 格式
 * 左移 1 位，负数取反，然后以 5-bit 分组提取并设置延续位
 */
function encodeSigned(val: number): string {
  let s = val < 0 ? (~val << 1) : val << 1
  s = s >>> 0 // convert to unsigned
  let str = ''
  do {
    let group = s & 0x1f
    s = s >>> 5
    if (s > 0) group |= 0x20
    str += String.fromCharCode(group + 63)
  } while (s > 0)
  return str
}

/**
 * 将 Encoded Polyline 字符串解码为坐标数组
 * @param str Encoded Polyline 字符串
 * @param precision 5（标准 1e5）或 6（高精度 1e6）
 */
export function decodePolyline(str: string, precision = 5): Coord[] {
  if (!str || str.length === 0) return []
  const factor = Math.pow(10, precision)
  const coords: Coord[] = []
  let index = 0
  let prevLng = 0
  let prevLat = 0

  while (index < str.length) {
    const lat = decodeSigned(str, index)
    index = lat.index
    const lng = decodeSigned(str, index)
    index = lng.index

    prevLat += lat.value
    prevLng += lng.value
    coords.push([prevLng / factor, prevLat / factor])
  }
  return coords
}

/**
 * 从字符串指定位置解码一个有符号值
 * 返回 {value, index}，index 为下一个读取位置
 */
function decodeSigned(str: string, index: number): { value: number; index: number } {
  let result = 0
  let shift = 0
  let byte: number
  do {
    byte = str.charCodeAt(index) - 63
    index++
    result |= (byte & 0x1f) << shift
    shift += 5
  } while (byte >= 0x20)

  if (result & 1) {
    result = ~result
  }
  result = result >> 1
  return { value: result, index }
}

/**
 * 解析输入文本为坐标数组
 * 支持 [[lng,lat],...] JSON 格式或 lng,lat;lng,lat... 分隔格式
 */
export function parseCoords(text: string): Coord[] {
  text = text.trim()
  // try JSON first
  try {
    const arr = JSON.parse(text)
    if (Array.isArray(arr) && arr.length > 0 && Array.isArray(arr[0])) return arr
  } catch {
    // not JSON, try other formats
  }
  // try "lng,lat;lng,lat..." or "lng,lat\nlng,lat..."
  const pts = text.split(/[;\n\r]+/).filter((s) => s.trim())
  const coords: Coord[] = []
  pts.forEach((p) => {
    const parts = p.split(/[, ]+/).filter((s) => s)
    if (parts.length >= 2) coords.push([parseFloat(parts[0]!), parseFloat(parts[1]!)])
  })
  if (coords.length > 0) return coords
  throw new Error('无法解析坐标，请用 [[lng,lat],...] 或 lng,lat;lng,lat 格式')
}

/**
 * 将坐标数组格式化为可读文本
 */
export function coordsToText(coords: Coord[], precision = 5): string {
  return JSON.stringify(
    coords.map((c) => [
      parseFloat(c[0].toFixed(precision)),
      parseFloat(c[1].toFixed(precision)),
    ]),
  )
}
