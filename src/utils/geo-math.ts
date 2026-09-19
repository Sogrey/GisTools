/* ============================================================
 * 地理数学底座 · 共享算法
 * 球面距离(haversine) / 球面超额面积(sphereArea) /
 * 平面鞋带面积(shoelaceArea) / Haversine 周长(polygonPerimeter)
 * 供 spatial-analysis / line-resample / convex-hull / distance-matrix /
 *   nearest-neighbor / building-volume / buffer-gen / gpx-convert 复用
 * 地球平均半径 R = 6371008.8 m
 * ============================================================ */

const R_EARTH = 6371008.8
const DEG = Math.PI / 180

function toRad(d: number): number {
  return d * DEG
}

/**
 * 球面距离（米）Haversine 公式，R = 6371008.8 m。
 * 使用 atan2 实现以避免 asin 在半球面边界的浮点溢出。
 */
export function haversine(lng1: number, lat1: number, lng2: number, lat2: number): number {
  const dl = toRad(lat2 - lat1)
  const dg = toRad(lng2 - lng1)
  const a =
    Math.sin(dl / 2) * Math.sin(dl / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dg / 2) * Math.sin(dg / 2)
  return 2 * R_EARTH * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * 球面超额（带符号，单位 = radius²）。
 * 取 Math.abs 得到面积。等距圆柱投影近似（与 turf.js ringArea 同源）。
 * @param coords  环坐标 [[lng, lat], ...]（闭合与否均可，闭合重复点贡献 0）
 * @param radius  球半径，默认 6371008.8（米）→ 返回 m²；传 6371.0088 → 返回 km²
 */
export function sphereArea(coords: number[][], radius: number = R_EARTH): number {
  const n = coords.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const pi = coords[i]!
    const pj = coords[j]!
    sum +=
      (toRad(pj[0]!) - toRad(pi[0]!)) *
      (2 + Math.sin(toRad(pi[1]!)) + Math.sin(toRad(pj[1]!)))
  }
  return (sum * radius * radius) / 2
}

/**
 * 平面鞋带面积（坐标单位平方，含 /2 与绝对值）。
 * 适用于已投影到平面（米/度）的坐标；对经纬度直接使用得到的是度²。
 */
export function shoelaceArea(coords: number[][]): number {
  const n = coords.length
  if (n < 3) return 0
  let s = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const pi = coords[i]!
    const pj = coords[j]!
    s += pi[0]! * pj[1]! - pj[0]! * pi[1]!
  }
  return Math.abs(s) / 2
}

/**
 * Haversine 周长（米），环自动闭合（末点 → 首点）。
 */
export function polygonPerimeter(coords: number[][]): number {
  const n = coords.length
  if (n < 2) return 0
  let d = 0
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    const pi = coords[i]!
    const pj = coords[j]!
    d += haversine(pi[0]!, pi[1]!, pj[0]!, pj[1]!)
  }
  return d
}
