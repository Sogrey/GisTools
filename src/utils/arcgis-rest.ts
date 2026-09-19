/* ============================================================
 * ArcGIS REST 服务探测器 · 核心逻辑
 * 服务端点 URL 构建 · layers / query / export / legend
 * 提取自 doSometing/arcgis-rest-explorer/index.html
 * ============================================================ */

export function normalizeBaseUrl(url: string): string {
  if (!url) return ''
  let u = String(url).trim()
  u = u.replace(/\?.*$/, '')
  u = u.replace(/\/+$/, '')
  return u
}

export function serviceType(url: string): string {
  const m = String(url || '').match(/\/(MapServer|FeatureServer|ImageServer|GPServer|GeoEventServer|NAServer|NetworkServer)$/i)
  return m ? m[1]! : ''
}

export function buildServiceUrl(baseUrl: string): string {
  return normalizeBaseUrl(baseUrl) + '?f=json'
}

export function buildLayersUrl(baseUrl: string): string {
  const u = normalizeBaseUrl(baseUrl)
  if (/\/layers$/i.test(u)) return u + '?f=json'
  return u + '/layers?f=json'
}

export function buildLayerUrl(baseUrl: string, layerId: string | number): string {
  return normalizeBaseUrl(baseUrl) + '/' + layerId + '?f=json'
}

export function buildFieldsUrl(baseUrl: string, layerId: string | number): string {
  return normalizeBaseUrl(baseUrl) + '/' + layerId + '/fields?f=json'
}

export function buildLegendUrl(baseUrl: string): string {
  const u = normalizeBaseUrl(baseUrl)
  if (/\/legend$/i.test(u)) return u + '?f=json'
  return u + '/legend?f=json'
}

export interface QueryOpts {
  layerId?: string | number
  where?: string
  outFields?: string
  format?: 'json' | 'pjson' | 'geojson'
  returnGeometry?: boolean
  countOnly?: boolean
  geometryType?: 'envelope' | 'point' | 'none'
  geometry?: number[]
  inSR?: string
  outSR?: string
  spatialRel?: string
  distance?: number
  resultRecordCount?: number
  orderByFields?: string
}

export function buildQueryUrl(baseUrl: string, opts: QueryOpts): string {
  opts = opts || {}
  let u = normalizeBaseUrl(baseUrl)
  const st = serviceType(u)
  if (st && opts.layerId !== undefined && opts.layerId !== null && opts.layerId !== '') {
    u = u + '/' + opts.layerId
  }
  u += '/query'

  const q: string[] = []
  const f = opts.format === 'geojson' ? 'geojson' : (opts.format === 'pjson' ? 'pjson' : 'json')
  q.push('f=' + f)
  if (opts.countOnly) {
    q.push('where=' + encodeURIComponent(opts.where || '1=1'))
    q.push('returnCountOnly=true')
  } else {
    if (opts.where) q.push('where=' + encodeURIComponent(opts.where))
    if (opts.outFields) q.push('outFields=' + encodeURIComponent(opts.outFields))
    q.push('returnGeometry=' + (opts.returnGeometry === false ? 'false' : 'true'))
    if (opts.geometryType === 'envelope' && opts.geometry) {
      q.push('geometry=' + encodeURIComponent(opts.geometry.join(',')))
      q.push('geometryType=esriGeometryEnvelope')
      q.push('inSR=' + encodeURIComponent(opts.inSR || '4326'))
      q.push('spatialRel=' + (opts.spatialRel || 'esriSpatialRelIntersects'))
    } else if (opts.geometryType === 'point' && opts.geometry) {
      q.push('geometry=' + encodeURIComponent(opts.geometry.join(',')))
      q.push('geometryType=esriGeometryPoint')
      q.push('inSR=' + encodeURIComponent(opts.inSR || '4326'))
      if (opts.distance) {
        q.push('distance=' + opts.distance)
        q.push('units=esriSRUnit_Meter')
      }
    }
    if (opts.outSR) q.push('outSR=' + encodeURIComponent(opts.outSR))
    if (opts.resultRecordCount) q.push('resultRecordCount=' + opts.resultRecordCount)
    if (opts.orderByFields) q.push('orderByFields=' + encodeURIComponent(opts.orderByFields))
  }
  return u + '?' + q.join('&')
}

export interface ExportOpts {
  bbox: number[]
  bboxSR?: string
  imageSR?: string
  size: [number, number]
  format?: string
  transparent?: boolean
  dpi?: number
}

export function buildExportUrl(baseUrl: string, opts: ExportOpts): string {
  opts = opts || {}
  let u = normalizeBaseUrl(baseUrl)
  u += '/export'
  const q: string[] = []
  if (opts.bbox) q.push('bbox=' + encodeURIComponent(opts.bbox.join(',')))
  if (opts.bboxSR) q.push('bboxSR=' + encodeURIComponent(opts.bboxSR))
  if (opts.imageSR) q.push('imageSR=' + encodeURIComponent(opts.imageSR))
  if (opts.size) q.push('size=' + opts.size.join(','))
  q.push('format=' + encodeURIComponent(opts.format || 'PNG32'))
  q.push('transparent=' + (opts.transparent ? 'true' : 'false'))
  if (opts.dpi) q.push('dpi=' + opts.dpi)
  q.push('f=image')
  return u + '?' + q.join('&')
}
