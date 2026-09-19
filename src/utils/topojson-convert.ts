/* ============================================================
 * TopoJSON ↔ GeoJSON 双向转换纯函数
 * 提取自 doSometing/topojson-tool/index.html
 * ============================================================ */

export type Coord = number[]
export type Ring = Coord[]
export type Geometry =
  | { type: 'Point'; coordinates: Coord }
  | { type: 'LineString'; coordinates: Coord[] }
  | { type: 'Polygon'; coordinates: Ring[] }
  | { type: 'MultiPoint'; coordinates: Coord[] }
  | { type: 'MultiLineString'; coordinates: Coord[][] }
  | { type: 'MultiPolygon'; coordinates: Ring[][] }
  | { type: 'GeometryCollection'; geometries: Geometry[] }

export interface Feature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: Geometry | null
  id?: string | number
}

export interface FeatureCollection {
  type: 'FeatureCollection'
  features: Feature[]
}

export interface TopoJSON {
  type: 'Topology'
  arcs: number[][][]
  objects: Record<string, TopoGeometryCollection | TopoGeometry>
  transform?: { scale: [number, number]; translate: [number, number] }
}

export interface TopoGeometryCollection {
  type: 'GeometryCollection'
  geometries: TopoGeometry[]
}

export interface TopoGeometry {
  type: string
  arcs?: number[] | number[][] | number[][][]
  coordinates?: number[] | number[][]
  properties?: Record<string, unknown>
  id?: string | number
  geometries?: TopoGeometry[]
}

/* ---- 通用工具 ---- */

function clean(x: number): number {
  const r = Math.round(x)
  if (Math.abs(x - r) < 1e-10) return r
  return Math.round(x * 1e10) / 1e10
}

export function detectDirection(text: string): 'topo-to-geo' | 'geo-to-topo' | 'unknown' {
  try {
    const obj = JSON.parse(text)
    if (obj && obj.type === 'Topology') return 'topo-to-geo'
    if (
      obj &&
      (obj.type === 'FeatureCollection' ||
        obj.type === 'Feature' ||
        obj.type === 'Point' ||
        obj.type === 'MultiPoint' ||
        obj.type === 'LineString' ||
        obj.type === 'MultiLineString' ||
        obj.type === 'Polygon' ||
        obj.type === 'MultiPolygon' ||
        obj.type === 'GeometryCollection')
    )
      return 'geo-to-topo'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/* ---- TopoJSON → GeoJSON ---- */

export function topoToGeo(topo: TopoJSON): FeatureCollection {
  if (!topo || topo.type !== 'Topology') throw new Error('输入不是有效的 TopoJSON（缺少 type:"Topology"）')
  if (!topo.arcs) throw new Error('TopoJSON 缺少 arcs 字段')
  if (!topo.objects) throw new Error('TopoJSON 缺少 objects 字段')

  const tf = topo.transform
  const sx = tf ? tf.scale[0] : 1
  const sy = tf ? tf.scale[1] : 1
  const tx = tf ? tf.translate[0] : 0
  const ty = tf ? tf.translate[1] : 0

  // decode arcs: delta -> absolute, apply transform
  const decoded = topo.arcs.map(function (arc) {
    const pts: number[][] = []
    let x = 0
    let y = 0
    for (let i = 0; i < arc.length; i++) {
      x += arc[i]![0]!
      y += arc[i]![1]!
      pts.push([clean(x * sx + tx), clean(y * sy + ty)])
    }
    return pts
  })

  function getArc(idx: number): number[][] {
    return idx < 0 ? decoded[~idx]!.slice().reverse() : decoded[idx]!
  }

  function stitch(indices: number[]): number[][] {
    const coords: number[][] = []
    for (let i = 0; i < indices.length; i++) {
      const a = getArc(indices[i]!)
      for (let j = i === 0 ? 0 : 1; j < a.length; j++) coords.push(a[j]!)
    }
    return coords
  }

  function tp(pt: number[]): number[] {
    return [clean(pt[0]! * sx + tx), clean(pt[1]! * sy + ty)]
  }

  function convertGeom(geom: TopoGeometry): Feature | null {
    if (!geom) return null
    const props = geom.properties || {}
    const t = geom.type
    let g: Geometry | null = null
    if (t === 'Polygon') g = { type: 'Polygon', coordinates: (geom.arcs as number[][]).map(stitch) }
    else if (t === 'MultiPolygon')
      g = { type: 'MultiPolygon', coordinates: (geom.arcs as number[][][]).map((p) => p.map(stitch)) }
    else if (t === 'LineString') g = { type: 'LineString', coordinates: stitch(geom.arcs as number[]) }
    else if (t === 'MultiLineString') g = { type: 'MultiLineString', coordinates: (geom.arcs as number[][]).map(stitch) }
    else if (t === 'Point') g = { type: 'Point', coordinates: tp(geom.coordinates! as number[]) }
    else if (t === 'MultiPoint') g = { type: 'MultiPoint', coordinates: (geom.coordinates! as number[][]).map(tp) }
    else return null

    const f: Feature = { type: 'Feature', properties: props, geometry: g }
    if (geom.id !== undefined) f.id = geom.id
    return f
  }

  const features: Feature[] = []
  const names = Object.keys(topo.objects)
  for (let k = 0; k < names.length; k++) {
    const obj = topo.objects[names[k]!] as TopoGeometryCollection | TopoGeometry
    if (obj.type === 'GeometryCollection') {
      for (let i = 0; i < obj.geometries!.length; i++) {
        const f = convertGeom(obj.geometries![i]!)
        if (f) features.push(f)
      }
    } else {
      const f2 = convertGeom(obj as TopoGeometry)
      if (f2) features.push(f2)
    }
  }
  return { type: 'FeatureCollection', features }
}

/* ---- GeoJSON → TopoJSON ---- */

export function geoToTopo(geo: Record<string, unknown>, precision: number): TopoJSON {
  const useQuant = precision > 0
  const factor = useQuant ? Math.pow(10, precision) : 1

  function q(pt: number[]): number[] {
    return useQuant ? [Math.round(pt[0]! * factor), Math.round(pt[1]! * factor)] : [pt[0]!, pt[1]!]
  }
  function pk(p: number[]): string {
    return p[0] + '|' + p[1]
  }

  // canonical key: min of forward/reverse string
  function canKey(pts: number[][]): [string, boolean] {
    const f = pts.map(pk).join(';')
    const r = pts
      .slice()
      .reverse()
      .map(pk)
      .join(';')
    return f <= r ? [f, false] : [r, true]
  }

  // normalize input to features array
  let features: any[] = []
  if ((geo as any).type === 'FeatureCollection') features = (geo as any).features || []
  else if ((geo as any).type === 'Feature') features = [geo]
  else if ((geo as any).coordinates || (geo as any).geometries)
    features = [{ type: 'Feature', properties: {}, geometry: geo }]

  interface Path {
    pts: number[][]
    isRing: boolean
    fi: number
    ri: number
    pi: number
    gt: string
  }

  // extract all paths (rings/lines)
  const paths: Path[] = []
  for (let fi = 0; fi < features.length; fi++) {
    const g = features[fi].geometry
    if (!g) continue
    if (g.type === 'Polygon') {
      for (let ri = 0; ri < g.coordinates.length; ri++)
        paths.push({ pts: g.coordinates[ri].map(q), isRing: true, fi, ri, pi: 0, gt: 'Polygon' })
    } else if (g.type === 'MultiPolygon') {
      for (let pi = 0; pi < g.coordinates.length; pi++)
        for (let ri2 = 0; ri2 < g.coordinates[pi].length; ri2++)
          paths.push({ pts: g.coordinates[pi][ri2].map(q), isRing: true, fi, ri: ri2, pi, gt: 'MultiPolygon' })
    } else if (g.type === 'LineString') {
      paths.push({ pts: g.coordinates.map(q), isRing: false, fi, ri: 0, pi: 0, gt: 'LineString' })
    } else if (g.type === 'MultiLineString') {
      for (let li = 0; li < g.coordinates.length; li++)
        paths.push({ pts: g.coordinates[li].map(q), isRing: false, fi, ri: li, pi: 0, gt: 'MultiLineString' })
    }
  }

  // count point frequency (unique per path) for junction detection
  const pc = new Map<string, number>()
  for (let i = 0; i < paths.length; i++) {
    const seen = new Set<string>()
    for (let j = 0; j < paths[i]!.pts.length; j++) {
      const key = pk(paths[i]!.pts[j]!)
      if (!seen.has(key)) {
        seen.add(key)
        pc.set(key, (pc.get(key) || 0) + 1)
      }
    }
  }

  // arc storage + dedup map
  const arcs: number[][][] = []
  const amap = new Map<string, number>()
  function getOrCreateArc(segPts: number[][]): { idx: number; reversed: boolean } {
    const ck = canKey(segPts)
    if (amap.has(ck[0])) return { idx: amap.get(ck[0])!, reversed: ck[1] }
    const idx = arcs.length
    arcs.push(ck[1] ? segPts.slice().reverse() : segPts)
    amap.set(ck[0], idx)
    return { idx, reversed: ck[1] }
  }

  // split each path at junctions, build arc references
  const pathArcs: (number[] | number[][])[] = []
  for (let pi = 0; pi < paths.length; pi++) {
    const path = paths[pi]!
    const refs: number[] = []
    if (path.isRing) {
      const hasClose = path.pts.length > 1 && pk(path.pts[0]!) === pk(path.pts[path.pts.length - 1]!)
      const ring = hasClose ? path.pts.slice(0, -1) : path.pts.slice()
      const juncs: number[] = []
      for (let ji = 0; ji < ring.length; ji++) if (pc.get(pk(ring[ji]!))! > 1) juncs.push(ji)
      if (juncs.length <= 1) {
        const arcPts = hasClose ? path.pts : ring.concat([ring[0]!])
        const r = getOrCreateArc(arcPts)
        refs.push(r.reversed ? ~r.idx : r.idx)
      } else {
        for (let si = 0; si < juncs.length; si++) {
          const s = juncs[si]!
          const e = juncs[(si + 1) % juncs.length]!
          const seg = e > s ? ring.slice(s, e + 1) : ring.slice(s).concat(ring.slice(0, e + 1))
          const r2 = getOrCreateArc(seg)
          refs.push(r2.reversed ? ~r2.idx : r2.idx)
        }
      }
    } else {
      const pts = path.pts
      const lj: number[] = []
      for (let li2 = 0; li2 < pts.length; li2++)
        if (li2 === 0 || li2 === pts.length - 1 || pc.get(pk(pts[li2]!))! > 1) lj.push(li2)
      if (lj.length <= 1) {
        const r3 = getOrCreateArc(pts)
        refs.push(r3.reversed ? ~r3.idx : r3.idx)
      } else {
        for (let si2 = 0; si2 < lj.length - 1; si2++) {
          const seg2 = pts.slice(lj[si2]!, lj[si2 + 1]! + 1)
          const r4 = getOrCreateArc(seg2)
          refs.push(r4.reversed ? ~r4.idx : r4.idx)
        }
      }
    }
    pathArcs.push(refs)
  }

  // build geometry objects
  const geometries: TopoGeometry[] = []
  const pathByFi = new Map<number, number[]>()
  for (let pi3 = 0; pi3 < paths.length; pi3++) {
    if (!pathByFi.has(paths[pi3]!.fi)) pathByFi.set(paths[pi3]!.fi, [])
    pathByFi.get(paths[pi3]!.fi)!.push(pi3)
  }

  for (let fi2 = 0; fi2 < features.length; fi2++) {
    const g2 = features[fi2].geometry
    if (!g2) continue
    const props = features[fi2].properties || {}
    const pis = pathByFi.get(fi2) || []
    let go: TopoGeometry | null = null
    if (g2.type === 'Polygon') {
      go = { type: 'Polygon', arcs: pis.map((pi) => pathArcs[pi] as number[]), properties: props }
    } else if (g2.type === 'MultiPolygon') {
      const byPi = new Map<number, number[][]>()
      for (let pi4 = 0; pi4 < paths.length; pi4++) {
        if (paths[pi4]!.fi === fi2 && paths[pi4]!.gt === 'MultiPolygon') {
          if (!byPi.has(paths[pi4]!.pi)) byPi.set(paths[pi4]!.pi, [])
          byPi.get(paths[pi4]!.pi)!.push(pathArcs[pi4] as number[])
        }
      }
      const polys: number[][][] = []
      const sortedPis = Array.from(byPi.keys()).sort((a, b) => a - b)
      for (const sp of sortedPis) polys.push(byPi.get(sp)!)
      go = { type: 'MultiPolygon', arcs: polys, properties: props }
    } else if (g2.type === 'LineString') {
      go = { type: 'LineString', arcs: pathArcs[pis[0]!] as number[], properties: props }
    } else if (g2.type === 'MultiLineString') {
      go = { type: 'MultiLineString', arcs: pis.map((pi) => pathArcs[pi] as number[]), properties: props }
    } else if (g2.type === 'Point') {
      go = { type: 'Point', coordinates: q(g2.coordinates), properties: props }
    } else if (g2.type === 'MultiPoint') {
      go = { type: 'MultiPoint', coordinates: g2.coordinates.map(q), properties: props }
    }
    if (go) {
      if (features[fi2].id !== undefined) go.id = features[fi2].id
      geometries.push(go)
    }
  }

  // delta encode arcs
  const deltaArcs = arcs.map((arc) => {
    const result: number[][] = []
    for (let i = 0; i < arc.length; i++)
      result.push(i === 0 ? [arc[i]![0]!, arc[i]![1]!] : [arc[i]![0]! - arc[i - 1]![0]!, arc[i]![1]! - arc[i - 1]![1]!])
    return result
  })

  const result: TopoJSON = {
    type: 'Topology',
    arcs: deltaArcs,
    objects: { layer: { type: 'GeometryCollection', geometries } },
  }
  if (useQuant) result.transform = { scale: [1 / factor, 1 / factor], translate: [0, 0] }
  return result
}

/* ---- 统计辅助 ---- */

export function countVertices(fc: FeatureCollection): number {
  let count = 0
  for (const f of fc.features) {
    if (!f.geometry) continue
    const g = f.geometry
    if (g.type === 'Point') count++
    else if (g.type === 'MultiPoint') count += g.coordinates.length
    else if (g.type === 'LineString') count += g.coordinates.length
    else if (g.type === 'MultiLineString') count += g.coordinates.reduce((s, c) => s + c.length, 0)
    else if (g.type === 'Polygon') count += g.coordinates.reduce((s, r) => s + r.length, 0)
    else if (g.type === 'MultiPolygon') count += g.coordinates.reduce((s, p) => s + p.reduce((s2, r) => s2 + r.length, 0), 0)
  }
  return count
}
