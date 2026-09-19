/* ============================================================
 * 比例尺计算器 · 核心算法
 * 比例尺↔地面分辨率互算，DPI，瓦片地面米数
 * 提取自 doSometing/scale-calc/index.html
 * ============================================================ */

export const STD_SCALES = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000]

const UNIT_M: Record<string, number> = { m: 1, km: 1000, mi: 1609.344 }

export function fmtN(x: number, d: number | null = 4): string {
  if (!isFinite(x)) return '—'
  return x.toLocaleString('zh-CN', { maximumFractionDigits: d == null ? 4 : d })
}

export function fmtScale(d: number): string {
  if (!isFinite(d) || d <= 0) return '—'
  if (d >= 1e6) return '1 : ' + fmtN(d / 1e6, 2) + ' 百万'
  if (d >= 1e4) return '1 : ' + fmtN(d / 1e4, 2) + ' 万'
  return '1 : ' + fmtN(d, 0)
}

export function nearestStd(d: number): number {
  let best = STD_SCALES[0]!, bd = Infinity
  for (let i = 0; i < STD_SCALES.length; i++) {
    const x = Math.abs(STD_SCALES[i]! - d)
    if (x < bd) {
      bd = x
      best = STD_SCALES[i]!
    }
  }
  return best
}

export function ceilStd(d: number): number | null {
  for (let i = 0; i < STD_SCALES.length; i++) if (STD_SCALES[i]! >= d) return STD_SCALES[i]!
  return null
}

export function resToScale(res: number, dpi: number): number {
  if (!isFinite(res) || res <= 0 || !isFinite(dpi) || dpi <= 0) return NaN
  return res / (0.0254 / dpi)
}

export function scaleToRes(D: number, dpi: number): number {
  if (!isFinite(D) || D <= 0 || !isFinite(dpi) || dpi <= 0) return NaN
  return D * (0.0254 / dpi)
}

export function webMercRes(z: number, lat: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, z)
}

export function zoomOf(res: number): number {
  return Math.log2(156543.03392 / res)
}

export function getUnitM(unit: string): number {
  return UNIT_M[unit] || 1
}

/* ---------- 模式 1：像素 ↔ 距离 ---------- */
export interface Mode1Result {
  res: number
  scale: number
  stdScale: number
  pxPerKm: number
  zoom: number
}

export function calcPxToDist(px: number, dist: number, unit: string, dpi: number): Mode1Result | null {
  if (!isFinite(px) || px <= 0 || !isFinite(dist) || dist <= 0) return null
  const meters = dist * UNIT_M[unit]!
  const res = meters / px
  const D = Math.round(resToScale(res, dpi))
  const s = nearestStd(D)
  return {
    res,
    scale: D,
    stdScale: s,
    pxPerKm: 1000 / res,
    zoom: zoomOf(res),
  }
}

/* ---------- 模式 2：比例尺 × DPI ---------- */
export interface Mode2Result {
  res: number
  inchDist: number
  pxPerKm: number
  a4W: number
  a4H: number
}

export function calcScaleDpi(D: number, dpi: number): Mode2Result | null {
  if (!isFinite(D) || D <= 0 || !isFinite(dpi) || dpi <= 0) return null
  const res = scaleToRes(D, dpi)
  const inch = res * dpi
  const px1k = 1000 / res
  const wpx = (297 / 25.4) * dpi, hpx = (210 / 25.4) * dpi
  const wkm = (wpx * res) / 1000, hkm = (hpx * res) / 1000
  return { res, inchDist: inch, pxPerKm: px1k, a4W: wkm, a4H: hkm }
}

/* ---------- 模式 3：Web 墨卡托 z + 纬度 ---------- */
export interface Mode3Result {
  res: number
  scale: number
  stdScale: number
  tileSpan: number
  tileCount: number
}

export function calcZoom(z: number, lat: number, dpi: number): Mode3Result | null {
  if (!isFinite(z) || z < 0 || !isFinite(lat)) return null
  const res = webMercRes(z, lat)
  const D = Math.round(resToScale(res, dpi))
  const s = nearestStd(D)
  return {
    res,
    scale: D,
    stdScale: s,
    tileSpan: res * 256,
    tileCount: Math.pow(2, z) * Math.pow(2, z),
  }
}

/* ---------- 模式 4：出图幅面 ---------- */
export interface Mode4Result {
  stdScale: number
  demandScale: number
  res: number
  coverW: number
  coverH: number
  zoom: number
  overLimit: boolean
}

export function calcPlot(W: number, H: number, RW: number, RH: number, dpi: number): Mode4Result | null {
  const valid = isFinite(W) && W > 0 && isFinite(H) && H > 0 && isFinite(RW) && RW > 0 && isFinite(RH) && RH > 0
  if (!valid || !isFinite(dpi) || dpi <= 0) return null
  const dn = Math.max((RW * 1e6) / W, (RH * 1e6) / H)
  let used = ceilStd(dn)
  let overLimit = false
  if (used === null) {
    used = Math.ceil(dn / 100) * 100
    overLimit = true
  }
  const res = scaleToRes(used, dpi)
  const cw = ((W / 1000) * used) / 1000, ch = ((H / 1000) * used) / 1000
  return { stdScale: used, demandScale: dn, res, coverW: cw, coverH: ch, zoom: zoomOf(res), overLimit }
}
