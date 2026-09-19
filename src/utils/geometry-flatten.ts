/* ============================================================
 * 几何展平 / 合并 · 核心算法
 * 提取自 doSometing/geometry-flatten/index.html
 * ============================================================ */

export type Feature = Record<string, unknown>
export type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] }
export type Geometry = Record<string, unknown>

const TO_MULTI: Record<string, string> = {
  Point: 'MultiPoint',
  LineString: 'MultiLineString',
  Polygon: 'MultiPolygon',
}

const TO_SINGLE: Record<string, string> = {
  MultiPoint: 'Point',
  MultiLineString: 'LineString',
  MultiPolygon: 'Polygon',
}

export function parseFeatures(gj: unknown): Feature[] {
  if (!gj || typeof gj !== 'object') return []
  const o = gj as Record<string, unknown>
  if (o.type === 'FeatureCollection') return (o.features as Feature[]) || []
  if (o.type === 'Feature') return [o as Feature]
  if (o.type && o.coordinates !== undefined) {
    return [{ type: 'Feature', properties: {}, geometry: gj }]
  }
  if (o.type === 'GeometryCollection' && Array.isArray(o.geometries)) {
    return [{ type: 'Feature', properties: {}, geometry: gj }]
  }
  return []
}

export function makeFC(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features: features || [] }
}

function cloneProps(p: unknown): Record<string, unknown> {
  if (!p || typeof p !== 'object') return {}
  try {
    return JSON.parse(JSON.stringify(p)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function copyCoord(c: unknown): unknown {
  if (Array.isArray(c)) return c.map(copyCoord)
  return c
}

/** 展平单个几何（可能 Multi* 或 GeometryCollection）为单几何数组 */
function flattenGeomArray(geom: Geometry | null): Geometry[] {
  if (!geom || !geom.type) return []
  const t = geom.type as string
  if (t === 'GeometryCollection') {
    const out: Geometry[] = []
    const gs = (geom.geometries as Geometry[]) || []
    for (const g of gs) out.push(...flattenGeomArray(g))
    return out
  }
  if (t === 'MultiPoint') {
    return ((geom.coordinates as number[][]) || []).map((pt) => ({
      type: 'Point',
      coordinates: copyCoord(pt),
    }))
  }
  if (t === 'MultiLineString') {
    return ((geom.coordinates as number[][][]) || []).map((line) => ({
      type: 'LineString',
      coordinates: copyCoord(line),
    }))
  }
  if (t === 'MultiPolygon') {
    return ((geom.coordinates as number[][][][]) || []).map((poly) => ({
      type: 'Polygon',
      coordinates: copyCoord(poly),
    }))
  }
  if (t === 'Point' || t === 'LineString' || t === 'Polygon') {
    return [{ type: t, coordinates: copyCoord(geom.coordinates) }]
  }
  return []
}

export interface FlattenResult {
  features: Feature[]
  changes: Record<string, number>
  inputCount: number
}

export function flattenGeometry(input: unknown): FlattenResult {
  const feats = parseFeatures(input)
  const out: Feature[] = []
  const changes: Record<string, number> = {}
  for (const f of feats) {
    const geom = f.geometry as Geometry | undefined
    const props = cloneProps(f.properties)
    if (!geom) continue
    const singles = flattenGeomArray(geom)
    for (const s of singles) {
      out.push({ type: 'Feature', properties: cloneProps(props), geometry: s })
    }
    if (geom.type && TO_SINGLE[geom.type as string]) {
      const key = geom.type + '→' + TO_SINGLE[geom.type as string]
      changes[key] = (changes[key] || 0) + singles.length
    }
  }
  return { features: out, changes, inputCount: feats.length }
}

export function mergeFeatures(input: unknown): FlattenResult {
  const feats = parseFeatures(input)
  const groups: Record<string, Geometry[]> = {}
  const order: string[] = []
  const nullGeoms: Feature[] = []

  for (const f of feats) {
    const g = f.geometry as Geometry | undefined
    if (!g || !g.type) {
      nullGeoms.push(f)
      continue
    }
    const t = g.type as string
    if (TO_SINGLE[t] || TO_MULTI[t] || t === 'GeometryCollection') {
      if (!groups[t]) {
        groups[t] = []
        order.push(t)
      }
      groups[t].push(g)
    } else {
      nullGeoms.push(f)
    }
  }

  const out: Feature[] = []
  const changes: Record<string, number> = {}

  for (const type of order) {
    const arr = groups[type]!
    if (arr.length === 0) continue

    if (type === 'GeometryCollection') {
      for (const g of arr) out.push({ type: 'Feature', properties: {}, geometry: g })
      continue
    }

    if (arr.length === 1) {
      out.push({ type: 'Feature', properties: {}, geometry: arr[0] })
      continue
    }

    if (TO_MULTI[type]) {
      const multiType = TO_MULTI[type]
      const coords = arr.map((g) => copyCoord(g.coordinates))
      out.push({ type: 'Feature', properties: {}, geometry: { type: multiType, coordinates: coords } })
      changes[type + '→' + multiType] = arr.length
    } else {
      const allCoords: unknown[] = []
      for (const g of arr) {
        const sub = (g.coordinates as unknown[]) || []
        for (const s of sub) allCoords.push(copyCoord(s))
      }
      out.push({ type: 'Feature', properties: {}, geometry: { type, coordinates: allCoords } })
      changes[type + '(合并' + arr.length + '个)'] = allCoords.length
    }
  }

  for (const f of nullGeoms) out.push(f)
  return { features: out, changes, inputCount: feats.length }
}
