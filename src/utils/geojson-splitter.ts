/* ============================================================
 * GeoJSON 分片拆分器 · 核心算法
 * 提取自 doSometing/geojson-splitter/index.html
 * ============================================================ */

export type Feature = Record<string, unknown>
export type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] }
export type SplitMode = 'count' | 'size' | 'group'

export interface SplitParams {
  maxFeatures: string
  maxBytes: string
  groupKey: string
}

export function byteLength(str: string): number {
  return new TextEncoder().encode(str).length
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(2) + ' MB'
}

export function parseGeoJSON(text: string): FeatureCollection {
  const data = JSON.parse(text) as FeatureCollection
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new Error('输入必须是 GeoJSON FeatureCollection')
  }
  return data
}

export function makeCollection(features: Feature[]): FeatureCollection {
  return { type: 'FeatureCollection', features }
}

function splitByCount(features: Feature[], maxPerShard: number): Feature[][] {
  const shards: Feature[][] = []
  for (let i = 0; i < features.length; i += maxPerShard) {
    shards.push(features.slice(i, i + maxPerShard))
  }
  return shards
}

function splitBySize(features: Feature[], maxBytes: number): Feature[][] {
  const shards: Feature[][] = []
  let current: Feature[] = []
  let currentSize = 0
  const wrapperOverhead = 42

  for (const feat of features) {
    const featStr = JSON.stringify(feat)
    const featSize = byteLength(featStr)
    const sep = current.length > 0 ? 1 : 0
    if (currentSize + featSize + sep > maxBytes - wrapperOverhead && current.length > 0) {
      shards.push(current)
      current = []
      currentSize = 0
    }
    current.push(feat)
    currentSize += featSize + (current.length > 1 ? 1 : 0)
  }
  if (current.length > 0) shards.push(current)
  if (shards.length === 0) shards.push([])
  return shards
}

function splitByGroup(features: Feature[], key: string): Feature[][] {
  const groups: Record<string, Feature[]> = {}
  const order: string[] = []
  for (const feat of features) {
    const props = (feat.properties as Record<string, unknown>) || {}
    const raw = props[key]
    const gk = raw === undefined || raw === null ? '(空)' : String(raw)
    if (!groups[gk]) {
      groups[gk] = []
      order.push(gk)
    }
    groups[gk].push(feat)
  }
  const shards: Feature[][] = []
  for (const k of order) shards.push(groups[k]!)
  if (shards.length === 0) shards.push([])
  return shards
}

export function executeSplit(geojson: FeatureCollection, mode: SplitMode, params: SplitParams): FeatureCollection[] {
  const features = geojson.features
  let shards: Feature[][]
  if (mode === 'count') {
    const max = parseInt(params.maxFeatures, 10)
    if (!max || max < 1) throw new Error('每片最大要素数必须 >= 1')
    shards = splitByCount(features, max)
  } else if (mode === 'size') {
    const mb = parseFloat(params.maxBytes)
    if (!mb || mb <= 0) throw new Error('每片最大体积必须 > 0')
    shards = splitBySize(features, Math.floor(mb * 1024 * 1024))
  } else if (mode === 'group') {
    const key = (params.groupKey || '').trim()
    if (!key) throw new Error('请填写分组属性名')
    shards = splitByGroup(features, key)
  } else {
    throw new Error('未知拆分模式: ' + mode)
  }
  if (shards.length === 0) shards = [[]]
  return shards.map((s) => makeCollection(s))
}

export function generateExample(): FeatureCollection {
  const cats = ['commercial', 'residential', 'industrial', 'park']
  const regs = ['north', 'south', 'east', 'west']
  const features: Feature[] = []
  for (let i = 0; i < 20; i++) {
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [116.0 + i * 0.01, 39.9 + i * 0.005] },
      properties: {
        id: i + 1,
        name: '点位_' + (i + 1),
        category: cats[i % cats.length],
        region: regs[i % regs.length],
        value: Math.floor(Math.random() * 1000),
        description: '示例要素 #' + (i + 1),
      },
    })
  }
  return makeCollection(features)
}
