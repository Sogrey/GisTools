/* ============================================================
 * 坐标纠偏底座 · GCJ02 / BD09 变换公式
 * WGS84 ↔ GCJ02 ↔ BD09 互转（中国坐标偏移修正）
 * 供 reproject / coord-workbench / geojson-utils 复用
 * ============================================================ */

const PI = Math.PI
const X_PI = (PI * 3000) / 180
const GC_A = 6378245.0
const GC_EE = 0.00669342162296594323

function toRad(d: number): number {
  return (d * PI) / 180
}

function outOfChina(lng: number, lat: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3
  ret += ((20 * Math.sin(y * PI) + 40 * Math.sin((y / 3) * PI)) * 2) / 3
  ret += ((160 * Math.sin((y / 12) * PI) + 320 * Math.sin((y * PI) / 30)) * 2) / 3
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * PI) + 20 * Math.sin(2 * x * PI)) * 2) / 3
  ret += ((20 * Math.sin(x * PI) + 40 * Math.sin((x / 3) * PI)) * 2) / 3
  ret += ((150 * Math.sin((x / 12) * PI) + 300 * Math.sin((x / 30) * PI)) * 2) / 3
  return ret
}

/** WGS84 → GCJ02（火星坐标）。境外点原样返回。 */
export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat]
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = toRad(lat)
  let magic = Math.sin(radLat)
  magic = 1 - GC_EE * magic * magic
  const sq = Math.sqrt(magic)
  dLat = (dLat * 180) / (((GC_A * (1 - GC_EE)) / (magic * sq)) * PI)
  dLng = (dLng * 180) / ((GC_A / sq) * Math.cos(radLat) * PI)
  return [lng + dLng, lat + dLat]
}

/** GCJ02 → WGS84。迭代反解，默认 10 次（足够收敛到浮点精度）。 */
export function gcj02ToWgs84(lng: number, lat: number, iter = 10): [number, number] {
  if (outOfChina(lng, lat)) return [lng, lat]
  let x = lng
  let y = lat
  for (let i = 0; i < iter; i++) {
    const g = wgs84ToGcj02(x, y)
    x += lng - g[0]
    y += lat - g[1]
  }
  return [x, y]
}

/** GCJ02 → BD09（百度坐标）。 */
export function gcj02ToBd09(lng: number, lat: number): [number, number] {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * X_PI)
  const t = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * X_PI)
  return [z * Math.cos(t) + 0.0065, z * Math.sin(t) + 0.006]
}

/** BD09 → GCJ02。 */
export function bd09ToGcj02(lng: number, lat: number): [number, number] {
  const x = lng - 0.0065
  const y = lat - 0.006
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * X_PI)
  const t = Math.atan2(y, x) - 0.000003 * Math.cos(x * X_PI)
  return [z * Math.cos(t), z * Math.sin(t)]
}

/** WGS84 → BD09（经 GCJ02 两步）。 */
export function wgs84ToBd09(lng: number, lat: number): [number, number] {
  const g = wgs84ToGcj02(lng, lat)
  return gcj02ToBd09(g[0], g[1])
}

/** BD09 → WGS84（经 GCJ02 两步）。 */
export function bd09ToWgs84(lng: number, lat: number): [number, number] {
  const g = bd09ToGcj02(lng, lat)
  return gcj02ToWgs84(g[0], g[1])
}
