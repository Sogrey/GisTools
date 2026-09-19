/* ============================================================
 * WMS/WMTS URL 构建器 · 核心逻辑
 * 填表生成 OGC WMS GetMap / WMTS GetTile URL
 * 提取自 doSometing/wms-url-builder/index.html
 * ============================================================ */

function enc(val: string | number): string {
  return encodeURIComponent(String(val))
}

export interface WmsParams {
  url: string
  layers: string
  styles?: string
  bbox: string
  crs?: string
  version?: string
  width?: number
  height?: number
  format?: string
  transparent?: boolean
}

export function buildWmsGetMap(p: WmsParams): string {
  const url = (p.url || '').trim()
  if (!url) return ''
  const version = p.version || '1.3.0'
  const crsParam = version === '1.3.0' ? 'CRS' : 'SRS'
  const parts: string[] = []
  parts.push('SERVICE=WMS')
  parts.push('VERSION=' + enc(version))
  parts.push('REQUEST=GetMap')
  if (p.layers) parts.push('LAYERS=' + enc(p.layers))
  parts.push('STYLES=' + (p.styles ? enc(p.styles) : ''))
  parts.push(crsParam + '=' + enc(p.crs || 'EPSG:4326'))
  parts.push('BBOX=' + enc(p.bbox || ''))
  parts.push('WIDTH=' + enc(p.width || 256))
  parts.push('HEIGHT=' + enc(p.height || 256))
  parts.push('FORMAT=' + enc(p.format || 'image/png'))
  parts.push('TRANSPARENT=' + (p.transparent ? 'true' : 'false'))
  const sep = url.indexOf('?') >= 0 ? '&' : '?'
  return url + sep + parts.join('&')
}

export function buildCapabilitiesUrl(baseUrl: string, service: string, version: string): string {
  const url = (baseUrl || '').trim()
  if (!url) return ''
  const parts: string[] = []
  parts.push('SERVICE=' + enc(service || 'WMS'))
  parts.push('VERSION=' + enc(version || '1.3.0'))
  parts.push('REQUEST=GetCapabilities')
  const sep = url.indexOf('?') >= 0 ? '&' : '?'
  return url + sep + parts.join('&')
}

export interface WmtsParams {
  url: string
  layer: string
  style?: string
  format?: string
  tileMatrixSet?: string
  z?: number
  row?: number
  col?: number
}

export function buildWmtsGetTile(p: WmtsParams): string {
  const url = (p.url || '').trim()
  if (!url) return ''
  const parts: string[] = []
  parts.push('SERVICE=WMTS')
  parts.push('VERSION=1.0.0')
  parts.push('REQUEST=GetTile')
  if (p.layer) parts.push('LAYER=' + enc(p.layer))
  parts.push('STYLE=' + enc(p.style || 'default'))
  parts.push('FORMAT=' + enc(p.format || 'image/png'))
  parts.push('TILEMATRIXSET=' + enc(p.tileMatrixSet || ''))
  parts.push('TILEMATRIX=' + enc(p.z || 0))
  parts.push('TILEROW=' + enc(p.row || 0))
  parts.push('TILECOL=' + enc(p.col || 0))
  const sep = url.indexOf('?') >= 0 ? '&' : '?'
  return url + sep + parts.join('&')
}

export function buildWmtsRestUrl(p: WmtsParams): string {
  const url = (p.url || '').trim().replace(/\/$/, '')
  const ext = (p.format || 'image/png').split('/')[1]
  return [url, enc(p.layer), enc(p.style || 'default'),
    enc(p.tileMatrixSet || ''), enc(p.z || 0), enc(p.row || 0), enc(p.col || 0)
  ].join('/') + '.' + ext
}

export interface WmsSamples {
  wms: WmsParams
  wmts: WmtsParams
}

export const SAMPLES: WmsSamples = {
  wms: {
    url: 'https://ows.mundialis.de/services/service',
    layers: 'TOPO-WMS', styles: '', bbox: '5.8,47.2,15.2,55.0',
    crs: 'EPSG:4326', version: '1.3.0', width: 768, height: 512,
    format: 'image/png', transparent: true
  },
  wmts: {
    url: 'https://maps.wien.gv.at/wmts',
    layer: 'lb', style: 'default', tileMatrixSet: 'google3857',
    z: 12, row: 2206, col: 1380, format: 'image/png'
  }
}
