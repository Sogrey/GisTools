/* ============================================================
 * CityGML 解析器 · 核心逻辑
 * 城市模型 XML 解析 · 版本 / 建筑 / boundedBy / LOD / gml:id
 * 提取自 doSometing/citygml-parser/index.html
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

function gmlIdOf(el: Element | null): string {
  if (!el || !el.attributes) return ''
  for (let i = 0; i < el.attributes.length; i++) {
    const a = el.attributes[i]!
    if (a.localName === 'id' && (a.namespaceURI || '').indexOf('opengis.net/gml') >= 0) return a.value
  }
  const v = el.getAttributeNS('http://www.opengis.net/gml', 'id')
  if (v) return v
  return el.getAttribute('gml:id') || ''
}

function detectVersion(doc: Document): { version: string; namespaces: Record<string, boolean> } {
  const out: { version: string; namespaces: Record<string, boolean> } = { version: '未知', namespaces: {} }
  if (!doc || !doc.documentElement) return out
  const seen: Record<string, boolean> = {}
  const root = doc.documentElement
  for (let i = 0; i < root.attributes.length; i++) {
    const a = root.attributes[i]!
    if (a.nodeName && a.value && a.nodeName.indexOf('xmlns') === 0) seen[a.value] = true
  }
  const versions: string[] = []
  for (const uri in seen) {
    if (uri.indexOf('citygml') >= 0) {
      out.namespaces[uri] = true
      const m = uri.match(/citygml\/(\d\.\d)/i)
      if (m && versions.indexOf(m[1]!) < 0) versions.push(m[1]!)
    }
  }
  if (versions.length) {
    versions.sort()
    out.version = versions[versions.length - 1]!
  }
  return out
}

function countByLod(doc: Document): { counts: Record<number, number>; detail: Record<string, number> } {
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }
  const detail: Record<string, number> = {}
  if (!doc) return { counts, detail }
  const els = doc.getElementsByTagName('*')
  for (let i = 0; i < els.length; i++) {
    if (!els[i]!.attributes) continue
    for (let j = 0; j < els[i]!.attributes.length; j++) {
      const a = els[i]!.attributes[j]!
      const m = (a.localName || a.nodeName || '').match(/^lod([0-4])(\w*)$/i)
      if (m) {
        const lod = +m[1]!
        counts[lod] = (counts[lod] || 0) + 1
        const key = a.localName || a.nodeName
        detail[key] = (detail[key] || 0) + 1
      }
    }
  }
  return { counts, detail }
}

function extractBuildingIds(doc: Document): { id: string; isPart: boolean }[] {
  const out: { id: string; isPart: boolean }[] = []
  const els = listByLocal(doc, 'Building').concat(listByLocal(doc, 'BuildingPart'))
  for (const el of els) {
    const id = gmlIdOf(el)
    out.push({ id: id || '(无 gml:id)', isPart: el.localName === 'BuildingPart' || el.nodeName.indexOf('BuildingPart') >= 0 })
  }
  return out
}

function countAllGmlIds(doc: Document): number {
  if (!doc) return 0
  const els = doc.getElementsByTagName('*')
  let n = 0
  for (let i = 0; i < els.length; i++) {
    if (gmlIdOf(els[i]!)) n++
  }
  return n
}

const CITYGML_FEATURES = ['Building', 'BuildingPart', 'BuildingInstallation', 'CityFurniture', 'Road', 'Railway',
  'WaterBody', 'LandUse', 'SolitaryVegetationObject', 'TINRelief', 'Bridge', 'BridgePart', 'Tunnel',
  'CityObjectGroup', 'GenericCityObject', 'TransportationComplex', 'TrafficArea', 'Square', 'Track']

const SURFACE_TYPES = ['WallSurface', 'RoofSurface', 'GroundSurface', 'ClosureSurface', 'OuterCeilingSurface',
  'OuterFloorSurface', 'InteriorWallSurface', 'CeilingSurface', 'FloorSurface', 'Window', 'Door']

export interface CityGmlResult {
  ok: boolean
  errors: string[]
  version: string
  namespaces: string[]
  modelName: string
  buildings: number
  buildingParts: number
  boundedBy: number
  surfaces: Record<string, number>
  lods: Record<number, number>
  lodDetail: Record<string, number>
  buildingIds: { id: string; isPart: boolean }[]
  allIdCount: number
  features: Record<string, number>
  envelope: { srsName: string; lowerCorner: number[]; upperCorner: number[] } | null
}

export function parseCityGml(text: string): CityGmlResult {
  const out: CityGmlResult = {
    ok: false, errors: [], version: '未知', namespaces: [], modelName: '',
    buildings: 0, buildingParts: 0, boundedBy: 0, surfaces: {},
    lods: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 }, lodDetail: {},
    buildingIds: [], allIdCount: 0, features: {}, envelope: null
  }
  if (!text || !String(text).trim()) { out.errors.push('输入为空：请粘贴 CityGML XML 或选择文件'); return out }
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

  out.ok = true
  const vd = detectVersion(doc)
  out.version = vd.version
  out.namespaces = Object.keys(vd.namespaces)
  if (out.version === '未知') {
    if (!/CityModel/i.test(root.nodeName)) out.errors.push('根元素/命名空间未体现 CityGML 特征，可能不是 CityGML 文档')
  }

  const names = listByLocal(doc, 'name')
  out.modelName = names.length ? (names[0]!.textContent || '').trim() : ''
  out.buildings = listByLocal(doc, 'Building').length
  out.buildingParts = listByLocal(doc, 'BuildingPart').length
  out.boundedBy = listByLocal(doc, 'boundedBy').length

  for (const st of SURFACE_TYPES) {
    const n = listByLocal(doc, st).length
    if (n) out.surfaces[st] = n
  }

  const lodRes = countByLod(doc)
  out.lods = lodRes.counts
  out.lodDetail = lodRes.detail

  out.buildingIds = extractBuildingIds(doc)
  out.allIdCount = countAllGmlIds(doc)

  for (const f of CITYGML_FEATURES) {
    const n = listByLocal(doc, f).length
    if (n) out.features[f] = n
  }
  if (out.buildings) out.features.Building = out.buildings

  const env = firstByLocal(doc, 'Envelope')
  if (env) {
    const lo = childText(env, 'lowerCorner')
    const up = childText(env, 'upperCorner')
    const coords = (s: string) => s ? s.trim().split(/\s+/).map(parseFloat).filter(isFinite) : []
    out.envelope = {
      srsName: env.getAttribute('srsName') || '',
      lowerCorner: coords(lo),
      upperCorner: coords(up)
    }
  }
  return out
}

export const SAMPLE_CITYGML = `<?xml version="1.0" encoding="UTF-8"?>
<CityModel xmlns="http://www.opengis.net/citygml/2.0"
  xmlns:bldg="http://www.opengis.net/citygml/building/2.0"
  xmlns:gml="http://www.opengis.net/gml"
  xmlns:gen="http://www.opengis.net/citygml/generics/2.0">
  <gml:name>示范城区三维底板</gml:name>
  <gml:boundedBy>
    <gml:Envelope srsName="urn:ogc:def:crs:EPSG::4326">
      <gml:lowerCorner>39.90 116.30</gml:lowerCorner>
      <gml:upperCorner>39.95 116.38</gml:upperCorner>
    </gml:Envelope>
  </gml:boundedBy>
  <cityObjectMember>
    <bldg:Building gml:id="BLD_001">
      <gml:name>1 号办公楼</gml:name>
      <gen:stringAttribute name="用途"><gen:value>办公</gen:value></gen:stringAttribute>
      <bldg:lod1Solid>
        <gml:Solid><gml:exterior><gml:CompositeSurface/></gml:exterior></gml:Solid>
      </bldg:lod1Solid>
    </bldg:Building>
  </cityObjectMember>
  <cityObjectMember>
    <bldg:Building gml:id="BLD_002">
      <gml:name>2 号住宅楼</gml:name>
      <bldg:boundedBy>
        <bldg:WallSurface gml:id="WS_002_1"><bldg:lod2MultiSurface><gml:MultiSurface/></bldg:lod2MultiSurface></bldg:WallSurface>
      </bldg:boundedBy>
      <bldg:boundedBy>
        <bldg:RoofSurface gml:id="RS_002_1"><bldg:lod2MultiSurface><gml:MultiSurface/></bldg:lod2MultiSurface></bldg:RoofSurface>
      </bldg:boundedBy>
      <bldg:boundedBy>
        <bldg:GroundSurface gml:id="GS_002_1"><bldg:lod2MultiSurface><gml:MultiSurface/></bldg:lod2MultiSurface></bldg:GroundSurface>
      </bldg:boundedBy>
      <bldg:lod2Solid>
        <gml:Solid><gml:exterior><gml:CompositeSurface/></gml:exterior></gml:Solid>
      </bldg:lod2Solid>
    </bldg:Building>
  </cityObjectMember>
</CityModel>`
