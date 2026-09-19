/* ============================================================
 * 要素合并 / 拆分 / 过滤 · 核心算法
 * 提取自 doSometing/feature-merge/index.html
 * ============================================================ */

export type GeoJson = Record<string, unknown>
export type Feature = Record<string, unknown>
export type Position = [number, number]

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

const GEOM_TYPES = new Set([
  'Point', 'MultiPoint', 'LineString', 'MultiLineString',
  'Polygon', 'MultiPolygon', 'GeometryCollection',
])

export function parseFeatures(gj: unknown): Feature[] {
  if (!gj || typeof gj !== 'object') return []
  const o = gj as GeoJson
  if (o.type === 'FeatureCollection') return (o.features as Feature[]) || []
  if (o.type === 'Feature') return [o as Feature]
  if (o.type && (o as GeoJson).coordinates !== undefined) {
    return [{ type: 'Feature', properties: {}, geometry: gj }]
  }
  return []
}

export function makeFC(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
}

function geomTypeOf(f: Feature): string | null {
  const g = f.geometry as GeoJson | undefined
  if (!g || !g.type) return null
  return g.type as string
}

/** 从一段文本中提取多个顶层 JSON 值 */
export function parseMultiJSON(text: string): GeoJson[] {
  const results: GeoJson[] = []
  let i = 0
  const len = text.length
  while (i < len) {
    const ch = text[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === ';' || ch === ',') {
      i++
      continue
    }
    if (ch !== '{' && ch !== '[') {
      i++
      continue
    }
    const start = i
    const opener = ch
    const closer = ch === '{' ? '}' : ']'
    let depth = 0
    let inStr = false
    let esc = false
    let found = false
    while (i < len) {
      const c = text[i]
      if (inStr) {
        if (esc) esc = false
        else if (c === '\\') esc = true
        else if (c === '"') inStr = false
      } else {
        if (c === '"') inStr = true
        else if (c === opener) depth++
        else if (c === closer) {
          depth--
          if (depth === 0) {
            found = true
            i++
            break
          }
        }
      }
      i++
    }
    if (!found) throw new Error('JSON 未闭合（从位置 ' + start + ' 开始）')
    const slice = text.slice(start, i)
    try {
      results.push(JSON.parse(slice) as GeoJson)
    } catch (e) {
      throw new Error('JSON 解析失败（位置 ' + start + '）: ' + (e as Error).message)
    }
  }
  return results
}

export function mergeFeatures(objects: GeoJson[]): FeatureCollection {
  const all: Feature[] = []
  for (const obj of objects) {
    const feats = parseFeatures(obj)
    for (const f of feats) all.push(f)
  }
  return makeFC(all)
}

export type MatchType = 'eq' | 'neq' | 'contains' | 'exists' | 'notnull'

export function filterByAttr(fc: unknown, propName: string, propValue: string, matchType: MatchType): FeatureCollection {
  const feats = parseFeatures(fc)
  const out: Feature[] = []
  for (const f of feats) {
    const props = (f.properties as Record<string, unknown>) || {}
    const v = props[propName]
    let keep = false
    if (matchType === 'eq') keep = String(v) === String(propValue)
    else if (matchType === 'neq') keep = String(v) !== String(propValue)
    else if (matchType === 'contains') keep = v != null && String(v).indexOf(String(propValue)) >= 0
    else if (matchType === 'exists') keep = propName in props
    else if (matchType === 'notnull') keep = v !== undefined && v !== null
    if (keep) out.push(f)
  }
  return makeFC(out)
}

export function filterByGeom(fc: unknown, geomType: string): FeatureCollection {
  const feats = parseFeatures(fc)
  const types = geomType.split(',').map((s) => s.trim()).filter(Boolean)
  const out: Feature[] = []
  for (const f of feats) {
    const gt = geomTypeOf(f)
    if (gt && types.includes(gt)) out.push(f)
  }
  return makeFC(out)
}

export function splitByAttr(fc: unknown, propName: string): Record<string, FeatureCollection> {
  const feats = parseFeatures(fc)
  const groups: Record<string, Feature[]> = {}
  const order: string[] = []
  for (const f of feats) {
    const props = (f.properties as Record<string, unknown>) || {}
    const v = props[propName]
    const key = v === undefined || v === null ? '<null>' : String(v)
    if (!groups[key]) {
      groups[key] = []
      order.push(key)
    }
    groups[key].push(f)
  }
  const result: Record<string, FeatureCollection> = {}
  for (const k of order) result[k] = makeFC(groups[k]!)
  return result
}

export function countByGeom(fc: unknown): Record<string, number> {
  const feats = parseFeatures(fc)
  const counts: Record<string, number> = {}
  for (const f of feats) {
    const gt = geomTypeOf(f) || '<null>'
    counts[gt] = (counts[gt] || 0) + 1
  }
  return counts
}

export function fmtSize(n: number): string {
  if (n < 1024) return n + 'B'
  if (n < 1048576) return (n / 1024).toFixed(1) + 'KB'
  return (n / 1048576).toFixed(2) + 'MB'
}
