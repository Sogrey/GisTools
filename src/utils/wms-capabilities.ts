/* ============================================================
 * WMS Capabilities 解析器 · 核心逻辑
 * OGC WMS 能力文档解析 · 服务 / 图层 / CRS / 格式 / GetMap URL
 * 提取自 doSometing/wms-capabilities/index.html
 * ============================================================ */

function listByLocal(root: Element | Document | null, name: string): Element[] {
  const out: Element[] = []
  if (!root) return out
  let els: HTMLCollectionOf<Element>
  try { els = root.getElementsByTagName('*') } catch { return out }
  for (let i = 0; i < els.length; i++) {
    if (els[i]!.localName === name || els[i]!.nodeName === name) out.push(els[i]!)
  }
  return out
}

function firstByLocal(root: Element | Document | null, name: string): Element | null {
  const l = listByLocal(root, name)
  return l.length ? l[0]! : null
}

function childElems(el: Element | null, name: string): Element[] {
  const out: Element[] = []
  if (!el) return out
  const ch = el.childNodes
  for (let i = 0; i < ch.length; i++) {
    const c = ch[i]!
    if (c.nodeType === 1 && ((c as Element).localName === name || c.nodeName === name)) out.push(c as Element)
  }
  return out
}

function childText(el: Element | null, name: string): string {
  const l = childElems(el, name)
  return l.length ? (l[0]!.textContent || '').trim() : ''
}

function hrefOf(el: Element | null): string {
  if (!el) return ''
  return (el.getAttribute('xlink:href') || el.getAttributeNS('http://www.w3.org/1999/xlink', 'href') || el.getAttribute('href') || '').trim()
}

export interface WmsLayer {
  name: string
  title: string
  abstract: string
  queryable: boolean
  depth: number
  path: string
  crs: string[]
  srs: string[]
  bbox: { west: number; south: number; east: number; north: number } | null
  bboxes: { crs: string; minx: string; miny: string; maxx: string; maxy: string }[]
  styles: { name: string; title: string; legendUrl: string }[]
  keywords: string[]
  minScale: string
  maxScale: string
  childCount: number
}

export interface WmsFormats {
  operations: Record<string, { formats: string[]; urls: { method: string; url: string }[] }>
  formats: string[]
  exceptionFormats: string[]
}

export interface WmsResult {
  ok: boolean
  errors: string[]
  version: string
  service: { name: string; title: string; abstract: string; fees: string; accessConstraints: string; onlineResource: string; contactPerson: string }
  layers: WmsLayer[]
  layerCount: number
  formats: WmsFormats
}

function extractLayers(doc: Document): WmsLayer[] {
  const out: WmsLayer[] = []
  const cap = firstByLocal(doc, 'Capability')
  if (!cap) return out

  function parseLayer(el: Element, depth: number, parentPath: string, inherited: { crs: string[]; srs: string[] } | null) {
    const inh = inherited ? { crs: inherited.crs.slice(), srs: inherited.srs.slice() } : { crs: [] as string[], srs: [] as string[] }
    const crsEls = childElems(el, 'CRS')
    const srsEls = childElems(el, 'SRS')
    for (const c of crsEls) {
      const cv = (c.textContent || '').trim()
      if (cv && !inh.crs.includes(cv)) inh.crs.push(cv)
    }
    for (const s of srsEls) {
      const sv = (s.textContent || '').trim()
      if (sv && !inh.srs.includes(sv)) inh.srs.push(sv)
    }

    const lyr: WmsLayer = {
      name: childText(el, 'Name'),
      title: childText(el, 'Title'),
      abstract: childText(el, 'Abstract'),
      queryable: el.getAttribute('queryable') === '1' || el.getAttribute('queryable') === 'true',
      depth, path: parentPath,
      crs: inh.crs.slice(), srs: inh.srs.slice(),
      bbox: null, bboxes: [], styles: [], keywords: [],
      minScale: childText(el, 'MinScaleDenominator'),
      maxScale: childText(el, 'MaxScaleDenominator'),
      childCount: 0
    }

    const ex = childElems(el, 'EX_GeographicBoundingBox')[0]
    if (ex) {
      lyr.bbox = {
        west: parseFloat(childText(ex, 'westBoundLongitude')),
        south: parseFloat(childText(ex, 'southBoundLatitude')),
        east: parseFloat(childText(ex, 'eastBoundLongitude')),
        north: parseFloat(childText(ex, 'northBoundLatitude'))
      }
    } else {
      const ll = childElems(el, 'LatLonBoundingBox')[0]
      if (ll) {
        lyr.bbox = {
          west: parseFloat(ll.getAttribute('minx') || ''),
          south: parseFloat(ll.getAttribute('miny') || ''),
          east: parseFloat(ll.getAttribute('maxx') || ''),
          north: parseFloat(ll.getAttribute('maxy') || '')
        }
      }
    }

    const bbs = childElems(el, 'BoundingBox')
    for (const b of bbs) {
      lyr.bboxes.push({
        crs: b.getAttribute('CRS') || b.getAttribute('SRS') || '',
        minx: b.getAttribute('minx') || '', miny: b.getAttribute('miny') || '',
        maxx: b.getAttribute('maxx') || '', maxy: b.getAttribute('maxy') || ''
      })
    }

    const st = childElems(el, 'Style')
    for (const s of st) {
      const lg = childElems(s, 'LegendURL')[0]
      lyr.styles.push({
        name: childText(s, 'Name'),
        title: childText(s, 'Title'),
        legendUrl: lg ? hrefOf(childElems(lg, 'OnlineResource')[0] ?? null) : ''
      })
    }

    const kl = childElems(el, 'KeywordList')[0]
    if (kl) {
      for (const kw of childElems(kl, 'Keyword')) {
        const kv = (kw.textContent || '').trim()
        if (kv) lyr.keywords.push(kv)
      }
    }

    out.push(lyr)

    const kids = childElems(el, 'Layer')
    lyr.childCount = kids.length
    const newPath = parentPath ? parentPath + ' > ' + (lyr.title || lyr.name || '未命名分组') : (lyr.title || lyr.name || '根图层')
    kids.forEach(k => parseLayer(k, depth + 1, newPath, inh))
  }

  const roots = childElems(cap, 'Layer')
  roots.forEach(r => parseLayer(r, 0, '', null))
  return out
}

function extractFormats(doc: Document): WmsFormats {
  const res: WmsFormats = { operations: {}, formats: [], exceptionFormats: [] }
  const cap = firstByLocal(doc, 'Capability')
  if (!cap) return res
  const req = firstByLocal(cap, 'Request')
  if (!req) return res
  const ch = req.childNodes
  for (let i = 0; i < ch.length; i++) {
    const node = ch[i]!
    if (node.nodeType !== 1) continue
    const opName = (node as Element).localName || (node as Element).nodeName
    const op = { formats: [] as string[], urls: [] as { method: string; url: string }[] }
    const fmts = childElems(node as Element, 'Format')
    for (const f of fmts) op.formats.push((f.textContent || '').trim())
    const dcps = childElems(node as Element, 'DCPType')
    for (const dcp of dcps) {
      const http = firstByLocal(dcp, 'HTTP')
      if (!http) continue
      const gets = childElems(http, 'Get')
      const posts = childElems(http, 'Post')
      for (const g of gets) {
        const u = hrefOf(childElems(g, 'OnlineResource')[0] ?? null)
        if (u) op.urls.push({ method: 'GET', url: u })
      }
      for (const p of posts) {
        const u = hrefOf(childElems(p, 'OnlineResource')[0] ?? null)
        if (u) op.urls.push({ method: 'POST', url: u })
      }
    }
    res.operations[opName] = op
  }
  res.formats = res.operations.GetMap ? res.operations.GetMap.formats : []
  const exc = firstByLocal(cap, 'Exception')
  if (exc) {
    const ef = childElems(exc, 'Format')
    for (const f of ef) res.exceptionFormats.push((f.textContent || '').trim())
  }
  return res
}

export function parseCapabilities(text: string): WmsResult {
  const out: WmsResult = {
    ok: false, errors: [], version: '', service: { name: '', title: '', abstract: '', fees: '', accessConstraints: '', onlineResource: '', contactPerson: '' },
    layers: [], layerCount: 0, formats: { operations: {}, formats: [], exceptionFormats: [] }
  }
  if (!text || !String(text).trim()) { out.errors.push('输入为空'); return out }
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(String(text), 'application/xml')
  } catch (e) {
    out.errors.push('DOMParser 解析异常：' + (e as Error).message)
    return out
  }
  const perr = listByLocal(doc, 'parsererror')
  if (perr.length) {
    out.errors.push('XML 解析失败：' + (perr[0]!.textContent || '').trim().slice(0, 160))
    return out
  }
  const root = doc.documentElement
  if (!root) { out.errors.push('XML 缺少根元素'); return out }
  const rootName = root.localName || root.nodeName
  if (!/WMS_Capabilities|WMT_MS_Capabilities/i.test(rootName)) {
    out.errors.push(`根元素 ${rootName} 不是 WMS_Capabilities / WMT_MS_Capabilities，可能不是 WMS 能力文档`)
  }

  out.version = root.getAttribute('version') || ''
  if (!out.version) {
    const m = String(text).match(/version\s*=\s*["']([\d.]+)["']/i)
    out.version = m ? m[1]! : '未知'
  }

  const svc = firstByLocal(doc, 'Service')
  out.service = {
    name: svc ? childText(svc, 'Name') : '',
    title: svc ? childText(svc, 'Title') : '',
    abstract: svc ? childText(svc, 'Abstract') : '',
    fees: svc ? childText(svc, 'Fees') : '',
    accessConstraints: svc ? childText(svc, 'AccessConstraints') : '',
    onlineResource: svc ? hrefOf(childElems(svc, 'OnlineResource')[0] ?? null) : '',
    contactPerson: svc ? (() => {
      const ci = firstByLocal(svc, 'ContactInformation')
      return ci ? childText(ci, 'ContactElectronicMailAddress') || childText(ci, 'ContactPerson') : ''
    })() : ''
  }

  out.layers = extractLayers(doc)
  out.layerCount = out.layers.length
  out.formats = extractFormats(doc)
  out.ok = out.errors.length === 0
  return out
}

export function buildGetMapUrl(p: {
  baseUrl: string; version: string; layers: string; styles?: string
  crs?: string; bbox: { west: number; south: number; east: number; north: number }
  width: number; height: number; format: string; transparent: boolean
}): string {
  const q: string[] = []
  q.push('SERVICE=WMS')
  q.push('REQUEST=GetMap')
  q.push('VERSION=' + encodeURIComponent(p.version))
  q.push('LAYERS=' + encodeURIComponent(p.layers))
  q.push('STYLES=' + encodeURIComponent(p.styles || ''))
  const crs = p.crs || 'EPSG:4326'
  const useCrsTag = /^1\.3/.test(p.version)
  q.push((useCrsTag ? 'CRS=' : 'SRS=') + encodeURIComponent(crs))
  const b = p.bbox
  const latFirst = useCrsTag && /EPSG:(4326|4258)/i.test(crs)
  q.push('BBOX=' + (latFirst
    ? [b.south, b.west, b.north, b.east].join(',')
    : [b.west, b.south, b.east, b.north].join(',')))
  q.push('WIDTH=' + p.width)
  q.push('HEIGHT=' + p.height)
  q.push('FORMAT=' + encodeURIComponent(p.format))
  q.push('TRANSPARENT=' + (p.transparent ? 'true' : 'false'))
  const base = (p.baseUrl || '').replace(/([?&])$/, '')
  const joiner = base.indexOf('?') >= 0 ? '&' : '?'
  return base + joiner + q.join('&')
}

export const SAMPLE_WMS = `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0" xmlns="http://www.opengis.net/wms" xmlns:xlink="http://www.w3.org/1999/xlink">
<Service>
  <Name>WMS</Name>
  <Title>某市基础地理信息共享服务</Title>
  <Abstract>演示用 WMS 能力文档（示例数据）</Abstract>
  <OnlineResource xlink:href="https://example.gov/geoserver/wms"/>
  <Fees>none</Fees>
</Service>
<Capability>
  <Request>
    <GetCapabilities>
      <Format>text/xml</Format>
      <DCPType><HTTP><Get><OnlineResource xlink:href="https://example.gov/geoserver/wms"/></Get></HTTP></DCPType>
    </GetCapabilities>
    <GetMap>
      <Format>image/png</Format>
      <Format>image/jpeg</Format>
      <DCPType><HTTP><Get><OnlineResource xlink:href="https://example.gov/geoserver/wms"/></Get></HTTP></DCPType>
    </GetMap>
  </Request>
  <Exception><Format>XML</Format></Exception>
  <Layer queryable="0">
    <Title>基础底图</Title>
    <CRS>EPSG:4326</CRS>
    <CRS>EPSG:3857</CRS>
    <EX_GeographicBoundingBox>
      <westBoundLongitude>115.40</westBoundLongitude>
      <eastBoundLongitude>117.50</eastBoundLongitude>
      <southBoundLatitude>39.40</southBoundLatitude>
      <northBoundLatitude>41.10</northBoundLatitude>
    </EX_GeographicBoundingBox>
    <Layer queryable="1">
      <Name>city:roads</Name>
      <Title>道路网</Title>
      <BoundingBox CRS="EPSG:4326" minx="115.40" miny="39.40" maxx="117.50" maxy="41.10"/>
    </Layer>
    <Layer queryable="1">
      <Name>city:buildings</Name>
      <Title>建筑物</Title>
      <BoundingBox CRS="EPSG:3857" minx="12847000" miny="4774000" maxx="13089000" maxy="5016000"/>
    </Layer>
  </Layer>
</Capability>
</WMS_Capabilities>`
