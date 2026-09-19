/* ============================================================
 * 按属性溶解 · 核心算法
 * 提取自 doSometing/dissolve-tool/index.html
 * ============================================================ */

export type Position = [number, number]
export type Ring = Position[]
export type Feature = Record<string, unknown>
export type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] }

function ptKey(p: Position): string {
  return p[0].toFixed(7) + ',' + p[1].toFixed(7)
}

function edgeKey(ka: string, kb: string): string {
  return ka < kb ? ka + '|' + kb : kb + '|' + ka
}

/** 将无序边集合连接为闭合环 */
export function connectEdgesIntoRings(edges: [Position, Position][]): Ring[] {
  const adj: Record<string, { pt: Position; nb: string[] }> = {}

  function addAdj(key: string, pt: Position, neighbor: string): void {
    if (!adj[key]) adj[key] = { pt: [pt[0], pt[1]], nb: [] }
    adj[key].nb.push(neighbor)
  }

  for (const [a, b] of edges) {
    addAdj(ptKey(a), a, ptKey(b))
    addAdj(ptKey(b), b, ptKey(a))
  }

  const used: Record<string, boolean> = {}
  const rings: Ring[] = []
  const keys = Object.keys(adj)

  for (const startKey of keys) {
    const startNb = adj[startKey]!.nb
    for (const firstNext of startNb) {
      if (used[edgeKey(startKey, firstNext)]) continue

      const ring: Ring = [adj[startKey]!.pt.slice() as Position]
      let prevKey = startKey
      let curKey = firstNext
      used[edgeKey(startKey, firstNext)] = true
      ring.push(adj[curKey]!.pt.slice() as Position)

      let guard = 0
      while (curKey !== startKey && guard++ < 100000) {
        const nb = adj[curKey]!.nb
        let nextKey: string | null = null
        for (const m of nb) {
          if (m !== prevKey && !used[edgeKey(curKey, m)]) {
            nextKey = m
            break
          }
        }
        if (!nextKey) {
          for (const m of nb) {
            if (!used[edgeKey(curKey, m)]) {
              nextKey = m
              break
            }
          }
        }
        if (!nextKey) break
        used[edgeKey(curKey, nextKey)] = true
        if (nextKey === startKey) {
          ring.push(adj[startKey]!.pt.slice() as Position)
          curKey = startKey
          break
        }
        ring.push(adj[nextKey]!.pt.slice() as Position)
        prevKey = curKey
        curKey = nextKey
      }

      if (ring.length >= 4) rings.push(ring)
    }
  }

  return rings
}

/** 消除共享边合并多边形外环 */
export function mergePolygons(exteriorRings: Ring[]): Ring[] {
  if (exteriorRings.length === 0) return []
  if (exteriorRings.length === 1) return exteriorRings.slice()

  const edgeMap: Record<string, { a: Position; b: Position; count: number }> = {}
  const edgeKeys: string[] = []
  for (const ring of exteriorRings) {
    for (let j = 0; j < ring.length - 1; j++) {
      const a = ring[j]!
      const b = ring[j + 1]!
      const ka = ptKey(a)
      const kb = ptKey(b)
      const ek = edgeKey(ka, kb)
      if (edgeMap[ek]) {
        edgeMap[ek].count++
      } else {
        edgeMap[ek] = { a: [a[0], a[1]], b: [b[0], b[1]], count: 1 }
        edgeKeys.push(ek)
      }
    }
  }

  const boundary: [Position, Position][] = []
  for (const ek of edgeKeys) {
    const e = edgeMap[ek]!
    if (e.count === 1) boundary.push([e.a, e.b])
  }

  if (boundary.length === 0) return exteriorRings.slice()
  return connectEdgesIntoRings(boundary)
}

export interface GroupStat {
  key: string
  count: number
  rings: number
}

export interface DissolveResult {
  fc: FeatureCollection
  stats: {
    originalCount: number
    groupCount: number
    maxGroup: number
    groups: GroupStat[]
  }
}

export function dissolveByProperty(fc: FeatureCollection, propName: string): DissolveResult {
  if (!propName || !propName.trim()) throw new Error('请输入分组属性名')
  const features = (fc && fc.features) || []
  const groups: Record<string, { rings: Ring[]; count: number; sampleProps: Record<string, unknown> }> = {}
  const order: string[] = []

  for (const f of features) {
    const geom = f.geometry as Record<string, unknown> | undefined
    if (!geom) continue
    const gt = geom.type as string
    if (gt !== 'Polygon' && gt !== 'MultiPolygon') continue
    const props = (f.properties as Record<string, unknown>) || {}
    const val = props[propName]
    const gkey = val === undefined || val === null ? '<null>' : String(val)
    if (!groups[gkey]) {
      groups[gkey] = { rings: [], count: 0, sampleProps: props }
      order.push(gkey)
    }
    groups[gkey].count++
    if (gt === 'Polygon') {
      const coords = geom.coordinates as Ring[]
      if (coords[0]) groups[gkey].rings.push(coords[0])
    } else {
      const polys = geom.coordinates as Ring[][]
      for (const poly of polys) {
        if (poly[0]) groups[gkey].rings.push(poly[0])
      }
    }
  }

  const resultFeatures: Feature[] = []
  const groupStats: GroupStat[] = []
  let maxGroup = 0

  for (const key of order) {
    const grp = groups[key]!
    const merged = mergePolygons(grp.rings)
    if (grp.count > maxGroup) maxGroup = grp.count

    let geometry: Record<string, unknown>
    if (merged.length === 1) {
      geometry = { type: 'Polygon', coordinates: [merged[0]] }
    } else {
      geometry = { type: 'MultiPolygon', coordinates: merged.map((r) => [r]) }
    }

    const newProps: Record<string, unknown> = {}
    newProps[propName] = grp.sampleProps[propName]
    newProps._dissolved_count = grp.count

    resultFeatures.push({ type: 'Feature', properties: newProps, geometry })
    groupStats.push({ key, count: grp.count, rings: merged.length })
  }

  return {
    fc: { type: 'FeatureCollection', features: resultFeatures },
    stats: {
      originalCount: features.length,
      groupCount: order.length,
      maxGroup,
      groups: groupStats,
    },
  }
}
