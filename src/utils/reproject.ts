/* ============================================================
 * GeoJSON 批量投影变换 · 核心算法
 * WGS84 ↔ Web墨卡托 ↔ GCJ02 ↔ BD09
 * 提取自 doSometing/geojson-reproject/index.html
 * ============================================================ */

import { wgs84ToGcj02, gcj02ToWgs84, gcj02ToBd09, bd09ToGcj02 } from './coord-transform'

const R = 6378137.0

type TransformFn = (lng: number, lat: number) => [number, number]

/* ---------- WGS84 ↔ Web 墨卡托 ---------- */
function toWebMercator(lng: number, lat: number): [number, number] {
  const x = (R * lng * Math.PI) / 180
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  return [x, y]
}
function fromWebMercator(x: number, y: number): [number, number] {
  const lng = (x / R) * (180 / Math.PI)
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)
  return [lng, lat]
}

/* ---------- 变换查找表 ---------- */
const DIRECT: Record<string, TransformFn> = {
  'EPSG:4326->EPSG:3857': toWebMercator,
  'EPSG:3857->EPSG:4326': fromWebMercator,
  'EPSG:4326->GCJ02': wgs84ToGcj02,
  'GCJ02->EPSG:4326': gcj02ToWgs84,
  'GCJ02->BD09': gcj02ToBd09,
  'BD09->GCJ02': bd09ToGcj02,
}
const TWO_STEP: Record<string, string> = {
  'EPSG:4326->BD09': 'GCJ02',
  'BD09->EPSG:4326': 'GCJ02',
  'EPSG:3857->GCJ02': 'EPSG:4326',
  'GCJ02->EPSG:3857': 'EPSG:4326',
  'EPSG:3857->BD09': 'EPSG:4326',
  'BD09->EPSG:3857': 'EPSG:4326',
}

function normCRS(c: string): string {
  return c === 'EPSG:4490' ? 'EPSG:4326' : c
}

export function getTransform(src: string, dst: string): TransformFn | null {
  const s = normCRS(src), d = normCRS(dst)
  if (s === d) return (lng: number, lat: number) => [lng, lat]
  const key = s + '->' + d
  if (DIRECT[key]) return DIRECT[key]
  if (TWO_STEP[key]) {
    const mid = TWO_STEP[key]
    const f1 = getTransform(s, mid)!
    const f2 = getTransform(mid, d)!
    return (lng: number, lat: number) => {
      const tmp = f1(lng, lat)
      return f2(tmp[0], tmp[1])
    }
  }
  return null
}

/* ---------- GeoJSON 坐标递归变换 ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformCoords(coords: any, fn: TransformFn): void {
  if (!coords || !coords.length) return
  if (typeof coords[0] === 'number') {
    const r = fn(coords[0], coords[1])
    coords[0] = r[0]
    coords[1] = r[1]
  } else if (coords[0] && typeof coords[0][0] === 'number') {
    for (let i = 0; i < coords.length; i++) {
      const r = fn(coords[i][0], coords[i][1])
      coords[i][0] = r[0]
      coords[i][1] = r[1]
    }
  } else {
    for (let j = 0; j < coords.length; j++) transformCoords(coords[j], fn)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformGeoJSON(obj: any, fn: TransformFn): void {
  if (!obj || typeof obj !== 'object') return
  if (obj.type === 'FeatureCollection') {
    (obj.features || []).forEach((f: any) => transformGeoJSON(f, fn))
  } else if (obj.type === 'Feature') {
    transformGeoJSON(obj.geometry, fn)
  } else if (obj.type && obj.coordinates) {
    transformCoords(obj.coordinates, fn)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function reprojectGeoJSON(geojson: any, srcCrs: string, dstCrs: string): any {
  const fn = getTransform(srcCrs, dstCrs)
  if (!fn) throw new Error('暂不支持该投影组合: ' + srcCrs + ' -> ' + dstCrs)
  const result = JSON.parse(JSON.stringify(geojson))
  transformGeoJSON(result, fn)
  return result
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function countFeatures(gj: any): number {
  if (!gj) return 0
  if (gj.type === 'FeatureCollection') return (gj.features || []).length
  return 1
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function countCoords(gj: any): number {
  let n = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function count(c: any): void {
    if (!c || !c.length) return
    if (typeof c[0] === 'number') {
      n++
      return
    }
    for (let i = 0; i < c.length; i++) count(c[i])
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(o: any): void {
    if (!o || typeof o !== 'object') return
    if (o.type === 'FeatureCollection') {
      (o.features || []).forEach(walk)
      return
    }
    if (o.type === 'Feature') {
      walk(o.geometry)
      return
    }
    if (o.coordinates) count(o.coordinates)
  }
  walk(gj)
  return n
}
