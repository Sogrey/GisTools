/* ============================================================
 * DXF ↔ GeoJSON 双向转换纯函数
 * 提取自 doSometing/dxf-toolbox/index.html
 * ============================================================ */

type Coord = number[]
type Ring = Coord[]

export interface DxfFeature {
  type: 'Feature'
  geometry: any
  properties: Record<string, unknown>
}

export interface DxfParseResult {
  features: DxfFeature[]
  layers: Set<string>
  errors: string[]
}

export interface GeojsonToDxfResult {
  dxf: string
  entityCount: number
  layerCount: number
}

/* ==================== DXF → GeoJSON ==================== */

function getVal(multi: Record<number, number[]>, code: number): number | null {
  if (multi[code] && multi[code]!.length > 0) return multi[code]![0]!
  return null
}

function buildPoint(layer: string, _data: Record<number, unknown>, multi: Record<number, number[]>): DxfFeature | null {
  const x = getVal(multi, 10)
  const y = getVal(multi, 20)
  if (x === null || y === null) return null
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [x, y] },
    properties: { layer, entityType: 'POINT' },
  }
}

function buildLine(layer: string, _data: Record<number, unknown>, multi: Record<number, number[]>): DxfFeature | null {
  const x1 = getVal(multi, 10), y1 = getVal(multi, 20)
  const x2 = getVal(multi, 11), y2 = getVal(multi, 21)
  if (x1 === null || y1 === null || x2 === null || y2 === null) return null
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: [[x1, y1], [x2, y2]] },
    properties: { layer, entityType: 'LINE', length: Math.hypot(x2 - x1, y2 - y1) },
  }
}

function buildLwPolyline(layer: string, _data: Record<number, unknown>, multi: Record<number, number[]>): DxfFeature | null {
  const xs = multi[10] || []
  const ys = multi[20] || []
  if (xs.length < 2 || ys.length < 2) return null
  const count = Math.min(xs.length, ys.length)
  const coords: Coord[] = []
  for (let i = 0; i < count; i++) coords.push([xs[i]!, ys[i]!])
  const flags = getVal(multi, 70) || 0
  const closed = (flags & 1) !== 0
  let geom: any
  if (closed && count >= 3) {
    const ring = coords.slice()
    ring.push([coords[0]![0]!, coords[0]![1]!])
    geom = { type: 'Polygon', coordinates: [ring] }
  } else {
    geom = { type: 'LineString', coordinates: coords }
  }
  return {
    type: 'Feature',
    geometry: geom,
    properties: { layer, entityType: 'LWPOLYLINE', vertexCount: count, closed },
  }
}

function buildCircle(layer: string, _data: Record<number, unknown>, multi: Record<number, number[]>): DxfFeature | null {
  const cx = getVal(multi, 10), cy = getVal(multi, 20)
  const r = getVal(multi, 40)
  if (cx === null || cy === null || r === null || r <= 0) return null
  const pts: Coord[] = []
  const segments = 36
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [pts] },
    properties: { layer, entityType: 'CIRCLE', center: [cx, cy], radius: r, segments },
  }
}

function buildArc(layer: string, _data: Record<number, unknown>, multi: Record<number, number[]>): DxfFeature | null {
  const cx = getVal(multi, 10), cy = getVal(multi, 20)
  const r = getVal(multi, 40)
  const sa = getVal(multi, 50)
  const ea = getVal(multi, 51)
  if (cx === null || cy === null || r === null || sa === null || ea === null) return null
  let startRad = sa * Math.PI / 180
  let endRad = ea * Math.PI / 180
  if (endRad < startRad) endRad += 2 * Math.PI
  const pts: Coord[] = []
  const segments = 36
  for (let i = 0; i <= segments; i++) {
    const angle = startRad + (i / segments) * (endRad - startRad)
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
  }
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: pts },
    properties: { layer, entityType: 'ARC', center: [cx, cy], radius: r, startAngle: sa, endAngle: ea },
  }
}

function buildFeature(type: string, layer: string, data: Record<number, unknown>, multi: Record<number, number[]>): DxfFeature | null {
  switch (type) {
    case 'POINT': return buildPoint(layer, data, multi)
    case 'LINE': return buildLine(layer, data, multi)
    case 'LWPOLYLINE': return buildLwPolyline(layer, data, multi)
    case 'CIRCLE': return buildCircle(layer, data, multi)
    case 'ARC': return buildArc(layer, data, multi)
    default: return null
  }
}

export function parseDXF(dxfText: string): DxfParseResult {
  const features: DxfFeature[] = []
  const layers = new Set<string>()
  const errors: string[] = []

  const lines = dxfText.split(/\r?\n/)
  const total = lines.length
  let idx = 0

  function readPair(): { code: number; value: string } | null {
    while (idx + 1 < total) {
      const codeRaw = lines[idx]!.trim()
      const valRaw = lines[idx + 1]!.trim()
      idx += 2
      const code = parseInt(codeRaw, 10)
      if (isNaN(code)) {
        idx--
        continue
      }
      return { code, value: valRaw }
    }
    return null
  }

  let inEntities = false
  let inBlocks = false
  let pair: { code: number; value: string } | null

  let polylineActive = false
  let polylinePts: Coord[] = []
  let polylineLayer = '0'
  let polylineClosed = false

  let curType: string | null = null
  let curLayer = '0'
  let curData: Record<number, unknown> = {}
  let curMulti: Record<number, number[]> = {}
  let entityStarted = false

  function flushEntity() {
    if (!entityStarted || curType === null) return
    try {
      const feat = buildFeature(curType, curLayer, curData, curMulti)
      if (feat) {
        features.push(feat)
        layers.add(curLayer)
      }
    } catch (e) {
      errors.push(curType + ' at line ~' + idx + ': ' + (e as Error).message)
    }
    entityStarted = false
    curType = null
    curLayer = '0'
    curData = {}
    curMulti = {}
  }

  while ((pair = readPair()) !== null) {
    const code = pair.code
    const val = pair.value

    if (code === 0 && val === 'SECTION') continue
    if (code === 0 && val === 'ENDSEC') {
      if (inEntities) {
        flushEntity()
        inEntities = false
      }
      continue
    }
    if (code === 2 && !entityStarted) {
      if (val === 'ENTITIES') { inEntities = true; inBlocks = false }
      else if (val === 'BLOCKS') { inBlocks = true }
      continue
    }

    if (!inEntities && !inBlocks) continue

    if (code === 0) {
      if (val === 'POLYLINE') {
        flushEntity()
        polylineActive = true
        polylinePts = []
        polylineClosed = false
        entityStarted = true
        curType = 'POLYLINE'
        curLayer = '0'
        curData = {}
        curMulti = {}
        continue
      }
      if (val === 'VERTEX' && polylineActive) {
        entityStarted = true
        curType = 'VERTEX_TMP'
        curData = {}
        curMulti = {}
        continue
      }
      if (val === 'SEQEND') {
        if (polylineActive) {
          if (polylinePts.length > 0) {
            const coords = polylinePts.map((p) => [p[0], p[1]] as Coord)
            const isClosed = polylineClosed || (polylinePts.length > 2 &&
              polylinePts[0]![0]! === polylinePts[polylinePts.length - 1]![0]! &&
              polylinePts[0]![1]! === polylinePts[polylinePts.length - 1]![1]!)
            const ring = coords.slice()
            if (!isClosed) ring.push([coords[0]![0]!, coords[0]![1]!])
            features.push({
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [ring] },
              properties: { layer: polylineLayer, entityType: 'POLYLINE', vertexCount: polylinePts.length, closed: isClosed },
            })
            layers.add(polylineLayer)
          }
          polylineActive = false
          polylinePts = []
          entityStarted = false
          curType = null
        }
        continue
      }

      flushEntity()

      const supportedTypes = ['POINT', 'LINE', 'LWPOLYLINE', 'CIRCLE', 'ARC', 'TEXT', 'POLYLINE', 'VERTEX', 'SEQEND', 'INSERT', 'ENDSEC']
      if (supportedTypes.indexOf(val) === -1 && !inBlocks) {
        entityStarted = true
        curType = '__SKIP__'
        curLayer = '0'
        curData = {}
        curMulti = {}
        continue
      }

      entityStarted = true
      curType = val
      curLayer = '0'
      curData = {}
      curMulti = {}
      continue
    }

    if (!entityStarted) continue

    if (curType === 'VERTEX_TMP' && polylineActive) {
      if (code === 10) {
        if (!curMulti[10]) curMulti[10] = []
        curMulti[10].push(parseFloat(val))
      } else if (code === 20) {
        if (!curMulti[20]) curMulti[20] = []
        curMulti[20].push(parseFloat(val))
      } else if (code === 8) {
        polylineLayer = val
      } else if (code === 70) {
        const flags = parseInt(val, 10)
        if (flags & 1) polylineClosed = true
      }
      if (curMulti[10] && curMulti[20] && curMulti[10].length === curMulti[20].length) {
        const vi = curMulti[10].length - 1
        polylinePts.push([curMulti[10]![vi]!, curMulti[20]![vi]!])
        curMulti = {}
      }
      continue
    }

    if (curType === 'POLYLINE' && polylineActive) {
      if (code === 8) polylineLayer = val
      else if (code === 70) {
        const pflags = parseInt(val, 10)
        if (pflags & 1) polylineClosed = true
      }
      continue
    }

    if (curType === '__SKIP__') continue

    if (code === 8) {
      curLayer = val
    } else if (code === 10 || code === 20 || code === 11 || code === 21 || code === 40 || code === 90 || code === 70) {
      const numVal = parseFloat(val)
      if (!curMulti[code]) curMulti[code] = []
      curMulti[code].push(numVal)
      curData[code] = numVal
    } else {
      curData[code] = val
    }
  }

  flushEntity()

  if (polylineActive && polylinePts.length > 0) {
    const coords2 = polylinePts.map((p) => [p[0], p[1]] as Coord)
    const ring2 = coords2.slice()
    ring2.push([coords2[0]![0]!, coords2[0]![1]!])
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring2] },
      properties: { layer: polylineLayer, entityType: 'POLYLINE', vertexCount: polylinePts.length, closed: polylineClosed },
    })
    layers.add(polylineLayer)
  }

  return { features, layers, errors }
}

/* ==================== GeoJSON → DXF ==================== */

function dxfPair(code: string, val: unknown): string {
  return code + '\n' + val + '\n'
}

function writeHeader(): string {
  let s = '0\nSECTION\n2\nHEADER\n'
  s += '9\n$ACADVER\n1\nAC1009\n'
  s += '9\n$INSBASE\n10\n0.0\n20\n0.0\n30\n0.0\n'
  s += '9\n$EXTMIN\n10\n0.0\n20\n0.0\n30\n0.0\n'
  s += '9\n$EXTMAX\n10\n100.0\n20\n100.0\n30\n0.0\n'
  s += '0\nENDSEC\n'
  return s
}

function writeTables(layerNames: string[]): string {
  let s = '0\nSECTION\n2\nTABLES\n'
  s += '0\nTABLE\n2\nLAYER\n70\n' + layerNames.length + '\n'
  for (const ln of layerNames) {
    s += '0\nLAYER\n'
    s += dxfPair('2', ln)
    s += dxfPair('70', 0)
    s += dxfPair('62', 7)
    s += dxfPair('6', 'CONTINUOUS')
  }
  s += '0\nENDTAB\n0\nENDSEC\n'
  return s
}

function writeBlocks(): string {
  return '0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n'
}

function writePoint(x: number, y: number, layer: string): string {
  let s = '0\nPOINT\n'
  s += dxfPair('8', layer)
  s += dxfPair('10', x)
  s += dxfPair('20', y)
  s += dxfPair('30', 0.0)
  return s
}

function writeLwPolyline(coords: Coord[], closed: boolean, layer: string): string {
  let s = '0\nLWPOLYLINE\n'
  s += dxfPair('8', layer)
  s += dxfPair('90', coords.length)
  s += dxfPair('70', closed ? 1 : 0)
  for (const c of coords) {
    s += dxfPair('10', c[0])
    s += dxfPair('20', c[1])
  }
  return s
}

export function geomToDxf(geometry: any, layer: string): string[] {
  const entities: string[] = []
  if (!geometry || !geometry.type) return entities
  const type = geometry.type
  const c = geometry.coordinates

  if (type === 'Point') {
    entities.push(writePoint(c[0], c[1], layer))
  } else if (type === 'MultiPoint') {
    for (const p of c) entities.push(writePoint(p[0], p[1], layer))
  } else if (type === 'LineString') {
    entities.push(writeLwPolyline(c, false, layer))
  } else if (type === 'MultiLineString') {
    for (const line of c) entities.push(writeLwPolyline(line, false, layer))
  } else if (type === 'Polygon') {
    for (const ring of c) entities.push(writeLwPolyline(ring, true, layer))
  } else if (type === 'MultiPolygon') {
    for (const poly of c) {
      for (const ring of poly) entities.push(writeLwPolyline(ring, true, layer))
    }
  } else if (type === 'GeometryCollection') {
    for (const g of (geometry.geometries || [])) {
      const sub = geomToDxf(g, layer)
      entities.push(...sub)
    }
  }
  return entities
}

export function geojsonToDxf(geojson: any): GeojsonToDxfResult {
  let features: any[]
  if (geojson.type === 'FeatureCollection') features = geojson.features
  else if (geojson.type === 'Feature') features = [geojson]
  else features = [{ type: 'Feature', geometry: geojson, properties: {} }]

  const layerSet: Record<string, boolean> = {}
  for (const f of features) {
    const ln = (f.properties && f.properties.layer) || 'GIS_LAYER'
    layerSet[ln] = true
  }
  const layerNames = Object.keys(layerSet)

  let dxf = ''
  dxf += writeHeader()
  dxf += writeTables(layerNames)
  dxf += writeBlocks()

  dxf += '0\nSECTION\n2\nENTITIES\n'
  let entityCount = 0
  for (const f of features) {
    const layer = (f.properties && f.properties.layer) || 'GIS_LAYER'
    const ents = geomToDxf(f.geometry, layer)
    for (const e of ents) { dxf += e; entityCount++ }
  }
  dxf += '0\nENDSEC\n'

  dxf += '0\nEOF\n'
  return { dxf, entityCount, layerCount: layerNames.length }
}
