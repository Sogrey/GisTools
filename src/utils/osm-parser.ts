/* ============================================================
 * OSM XML 解析器纯函数
 * 提取自 doSometing/osm-pbf-parser/index.html
 * .osm XML → GeoJSON · node→Point · way→LineString/Polygon · relation→记录
 * ============================================================ */

export interface OsmNodeRef {
  lat: number
  lon: number
}

export interface GeoJSONFeature {
  type: 'Feature'
  id?: string
  properties: Record<string, unknown>
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][] | unknown[]
  }
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
  metadata?: {
    nodeCount: number
    wayCount: number
    relationCount: number
  }
}

export interface OsmParseResult {
  geojson: GeoJSONFeatureCollection
  nodeCount: number
  wayCount: number
  relationCount: number
  featureCount: number
}

/**
 * 从 OSM 元素中提取 tag 键值对
 */
export function extractTags(element: Element): Record<string, string> {
  const tags: Record<string, string> = {}
  const tagNodes = element.getElementsByTagName('tag')
  for (let i = 0; i < tagNodes.length; i++) {
    const k = tagNodes[i]!.getAttribute('k')
    const v = tagNodes[i]!.getAttribute('v')
    if (k) tags[k] = v || ''
  }
  return tags
}

/**
 * 将 OSM node 元素转换为 Point Feature
 */
export function nodesToPoints(nodeElements: Element[]): GeoJSONFeature[] {
  const features: GeoJSONFeature[] = []
  for (let i = 0; i < nodeElements.length; i++) {
    const node = nodeElements[i]!
    // Skip nodes that are children of way/relation elements
    if (
      node.parentNode &&
      (node.parentNode as Element).tagName &&
      (node.parentNode as Element).tagName.toLowerCase() !== 'osm'
    )
      continue
    const id = node.getAttribute('id') || ''
    const lat = parseFloat(node.getAttribute('lat') || '')
    const lon = parseFloat(node.getAttribute('lon') || '')
    if (isNaN(lat) || isNaN(lon)) continue
    const tags = extractTags(node)
    const props: Record<string, unknown> = { osm_id: id, osm_type: 'node', ...tags }
    features.push({
      type: 'Feature',
      id,
      properties: props,
      geometry: { type: 'Point', coordinates: [lon, lat] },
    })
  }
  return features
}

/**
 * 将 OSM way 元素转换为 LineString 或 Polygon Feature
 */
export function waysToLines(wayElements: Element[], nodeMap: Record<string, OsmNodeRef>): GeoJSONFeature[] {
  const features: GeoJSONFeature[] = []
  for (let i = 0; i < wayElements.length; i++) {
    const way = wayElements[i]!
    if (
      way.parentNode &&
      (way.parentNode as Element).tagName &&
      (way.parentNode as Element).tagName.toLowerCase() !== 'osm'
    )
      continue
    const id = way.getAttribute('id') || ''
    const tags = extractTags(way)

    // Collect nd refs
    const ndElements = way.getElementsByTagName('nd')
    const refs: string[] = []
    for (let j = 0; j < ndElements.length; j++) {
      const ref = ndElements[j]!.getAttribute('ref')
      if (ref) refs.push(ref)
    }

    // Resolve refs to coordinates
    const coords: number[][] = []
    for (let k = 0; k < refs.length; k++) {
      const node = nodeMap[refs[k]!]
      if (node) coords.push([node.lon, node.lat])
    }

    if (coords.length < 2) continue

    const props: Record<string, unknown> = { osm_id: id, osm_type: 'way', ...tags }

    // Determine if it's a polygon: closed ring + area tag or natural tags
    const isClosed = refs.length > 3 && refs[0] === refs[refs.length - 1]
    const isArea =
      isClosed &&
      (!!tags.area && tags.area === 'yes' ||
        !!tags.natural ||
        !!tags.building ||
        !!tags.landuse ||
        !!tags.leisure ||
        !!tags.amenity ||
        !!tags.boundary)

    if (isArea) {
      features.push({
        type: 'Feature',
        id,
        properties: props,
        geometry: { type: 'Polygon', coordinates: [coords] },
      })
    } else {
      features.push({
        type: 'Feature',
        id,
        properties: props,
        geometry: { type: 'LineString', coordinates: coords },
      })
    }
  }
  return features
}

/**
 * 将 OSM relation 元素转换为 Feature（简化实现，输出 GeometryCollection 占位）
 */
export function relationsToFeatures(relationElements: Element[]): GeoJSONFeature[] {
  const features: GeoJSONFeature[] = []
  for (let i = 0; i < relationElements.length; i++) {
    const rel = relationElements[i]!
    if (
      rel.parentNode &&
      (rel.parentNode as Element).tagName &&
      (rel.parentNode as Element).tagName.toLowerCase() !== 'osm'
    )
      continue
    const id = rel.getAttribute('id') || ''
    const tags = extractTags(rel)

    // Collect member way refs for multipolygon
    const members = rel.getElementsByTagName('member')
    const wayRefs: { ref: string; role: string }[] = []
    for (let j = 0; j < members.length; j++) {
      const type = members[j]!.getAttribute('type')
      const role = members[j]!.getAttribute('role') || ''
      const ref = members[j]!.getAttribute('ref')
      if (type === 'way' && ref) wayRefs.push({ ref, role })
    }

    const props: Record<string, unknown> = {
      osm_id: id,
      osm_type: 'relation',
      member_count: wayRefs.length,
      ...tags,
    }

    features.push({
      type: 'Feature',
      id,
      properties: props,
      geometry: { type: 'GeometryCollection', coordinates: [] },
    })
  }
  return features
}

/**
 * 主解析函数：OSM XML 字符串 → GeoJSON
 */
export function parseOsm(xmlStr: string): OsmParseResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlStr, 'text/xml')

  // Check for parse errors
  const parseError = doc.getElementsByTagName('parsererror')
  if (parseError.length > 0) {
    throw new Error('XML 解析失败: ' + parseError[0]!.textContent)
  }

  // Build node map: id → {lat, lon}
  const allNodes = doc.getElementsByTagName('node')
  const nodeMap: Record<string, OsmNodeRef> = {}
  for (let i = 0; i < allNodes.length; i++) {
    const n = allNodes[i]!
    const nid = n.getAttribute('id')
    const lat = parseFloat(n.getAttribute('lat') || '')
    const lon = parseFloat(n.getAttribute('lon') || '')
    if (nid && !isNaN(lat) && !isNaN(lon)) {
      nodeMap[nid] = { lat, lon }
    }
  }

  // Get top-level elements
  const osmRoot = doc.getElementsByTagName('osm')[0] || doc.documentElement
  const topLevelNodes: Element[] = []
  const topLevelWays: Element[] = []
  const topLevelRelations: Element[] = []

  // Filter top-level children only
  const children = osmRoot.childNodes
  for (let j = 0; j < children.length; j++) {
    const child = children[j]!
    if (child.nodeType !== 1) continue // skip text nodes
    const tag = (child as Element).tagName.toLowerCase()
    if (tag === 'node') topLevelNodes.push(child as Element)
    else if (tag === 'way') topLevelWays.push(child as Element)
    else if (tag === 'relation') topLevelRelations.push(child as Element)
  }

  // Convert
  const nodeFeatures = nodesToPoints(topLevelNodes)
  const wayFeatures = waysToLines(topLevelWays, nodeMap)
  const relFeatures = relationsToFeatures(topLevelRelations)

  const allFeatures = [...nodeFeatures, ...wayFeatures, ...relFeatures]

  const geojson: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: allFeatures,
    metadata: {
      nodeCount: topLevelNodes.length,
      wayCount: topLevelWays.length,
      relationCount: topLevelRelations.length,
    },
  }

  return {
    geojson,
    nodeCount: topLevelNodes.length,
    wayCount: topLevelWays.length,
    relationCount: topLevelRelations.length,
    featureCount: allFeatures.length,
  }
}
