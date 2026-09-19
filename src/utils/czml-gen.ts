/* ============================================================
 * CZML 生成器 · 核心逻辑
 * 表单配置 Cesium 实体 → CZML JSON · 支持动态轨迹插值
 * 提取自 doSometing/czml-generator/index.html
 * ============================================================ */

const DOC_START = '2026-01-01T00:00:00Z'
const DOC_END = '2026-01-01T01:00:00Z'
const DOC_MULT = 60

export type EntityType = 'point' | 'line' | 'polygon' | 'label' | 'ellipse'

export interface CzmlEntity {
  id: string
  type: EntityType
  name: string
  color: string
  mode?: string
  lng?: number
  lat?: number
  alt?: number
  track?: string
  trackDur?: number
  pixelSize?: number
  positions?: string
  width?: number
  height?: string
  perHeight?: boolean
  text?: string
  size?: number
  showBack?: boolean
  semiMajor?: number
  semiMinor?: number
  rotation?: number
}

const TYPE_META: Record<EntityType, { label: string; icon: string }> = {
  point: { label: '点', icon: '●' },
  line: { label: '折线', icon: '∿' },
  polygon: { label: '面', icon: '▱' },
  label: { label: '标签', icon: 'A' },
  ellipse: { label: '椭圆', icon: '◯' }
}

let nextId = 1

export function newEntity(type: EntityType): CzmlEntity {
  const e: CzmlEntity = { id: 'obj' + nextId++, type, color: '#ff4d4f', name: '' }
  switch (type) {
    case 'point':
      e.name = '目标点'; e.mode = 'static'
      e.lng = 116.391428; e.lat = 39.907547; e.alt = 0
      e.track = '116.391428,39.907547,0\n116.398000,39.911000,300\n116.405000,39.915000,500\n116.412000,39.919000,300'
      e.trackDur = 60; e.pixelSize = 10
      break
    case 'line':
      e.name = '路径线'; e.color = '#16a34a'
      e.positions = '116.391428,39.907547,0\n116.398000,39.912000,200\n116.406000,39.918000,400'
      e.width = 3
      break
    case 'polygon':
      e.name = '区域面'; e.color = '#2f7beb'
      e.positions = '116.390000,39.905000,0\n116.400000,39.905000,0\n116.400000,39.912000,0\n116.390000,39.912000,0'
      e.height = ''; e.perHeight = true
      break
    case 'label':
      e.name = '地名标签'; e.color = '#1f2d3d'
      e.lng = 116.391428; e.lat = 39.907547; e.alt = 50
      e.text = '天安门'; e.size = 18; e.showBack = false
      break
    case 'ellipse':
      e.name = '影响范围'; e.color = '#00b4d8'
      e.lng = 116.391428; e.lat = 39.907547; e.alt = 0
      e.semiMajor = 5; e.semiMinor = 3; e.rotation = 0
      break
  }
  return e
}

function num(v: unknown, d?: number): number {
  const n = parseFloat(v as string)
  return isFinite(n) ? n : (d !== undefined ? d : 0)
}

function hexToRgba(hex: string): number[] {
  let h = String(hex || '#ff0000').replace('#', '')
  if (h.length === 3) h = h[0]! + h[0]! + h[1]! + h[1]! + h[2]! + h[2]!
  let r = parseInt(h.substring(0, 2), 16)
  let g = parseInt(h.substring(2, 4), 16)
  let b = parseInt(h.substring(4, 6), 16)
  if (isNaN(r)) r = 255
  if (isNaN(g)) g = 0
  if (isNaN(b)) b = 0
  return [r, g, b, 255]
}

function rgbaObj(hex: string): { rgba: number[] } {
  return { rgba: hexToRgba(hex) }
}

function deg2rad(d: number): number {
  return d * Math.PI / 180
}

function parsePoints(text: string): number[][] {
  const out: number[][] = []
  String(text || '').split(/\n/).forEach(line => {
    line = line.trim()
    if (!line) return
    const parts = line.split(/[\s,;]+/).map(x => parseFloat(x))
    if (parts.length < 2 || isNaN(parts[0]!) || isNaN(parts[1]!)) return
    out.push([parts[0]!, parts[1]!, parts.length > 2 && !isNaN(parts[2]!) ? parts[2]! : 0])
  })
  return out
}

function buildEntity(e: CzmlEntity, warn: string[]): Record<string, unknown> | null {
  const p: Record<string, unknown> = { id: e.id, name: e.name }
  const color = e.color || '#ff4d4f'
  switch (e.type) {
    case 'point':
      if (e.mode === 'track') {
        const pts = parsePoints(e.track || '')
        if (pts.length < 2) { warn.push(`「${e.name}」动态轨迹至少需要 2 个点`); return null }
        const dur = Math.max(0.1, num(e.trackDur, 60))
        const arr: number[] = []
        for (let i = 0; i < pts.length; i++) {
          arr.push(+((i * dur / (pts.length - 1)).toFixed(4)), pts[i]![0]!, pts[i]![1]!, pts[i]![2]!)
        }
        p.position = {
          epoch: DOC_START,
          cartesianDegrees: arr,
          interpolationAlgorithm: 'LAGRANGE',
          interpolationDegree: Math.min(3, pts.length - 1),
          forwardExtrapolationType: 'HOLD'
        }
      } else {
        p.position = { cartesianDegrees: [num(e.lng), num(e.lat), num(e.alt, 0)] }
      }
      p.point = { color: rgbaObj(color), pixelSize: num(e.pixelSize, 10) }
      break
    case 'line': {
      const lpts = parsePoints(e.positions || '')
      if (lpts.length < 2) { warn.push(`「${e.name}」折线至少需要 2 个顶点`); return null }
      p.polyline = {
        positions: { cartesianDegrees: lpts },
        width: num(e.width, 2),
        material: { solidColor: { color: rgbaObj(color) } }
      }
      break
    }
    case 'polygon': {
      const gpts = parsePoints(e.positions || '')
      if (gpts.length < 3) { warn.push(`「${e.name}」面至少需要 3 个顶点`); return null }
      const poly: Record<string, unknown> = {
        positions: { cartesianDegrees: gpts },
        fillColor: rgbaObj(color),
        perPositionHeight: !!e.perHeight
      }
      if (e.height !== '' && e.height != null) poly.extrudedHeight = num(e.height, 0)
      p.polygon = poly
      break
    }
    case 'label':
      p.position = { cartesianDegrees: [num(e.lng), num(e.lat), num(e.alt, 0)] }
      p.label = {
        text: (e.text != null && e.text !== '') ? e.text : e.name,
        font: num(e.size, 16) + 'px sans-serif',
        fillColor: rgbaObj(color),
        showBackground: !!e.showBack
      }
      break
    case 'ellipse':
      p.position = { cartesianDegrees: [num(e.lng), num(e.lat), num(e.alt, 0)] }
      p.ellipse = {
        semiMajorAxis: Math.max(0.01, num(e.semiMajor, 1)) * 1000,
        semiMinorAxis: Math.max(0.01, num(e.semiMinor, 1)) * 1000,
        rotation: deg2rad(num(e.rotation, 0)),
        material: { solidColor: { color: rgbaObj(color) } }
      }
      break
  }
  return p
}

export interface CzmlResult {
  packets: Record<string, unknown>[]
  warn: string[]
}

export function buildPackets(entities: CzmlEntity[]): CzmlResult {
  const doc = {
    id: 'document',
    name: 'CZML',
    clock: {
      interval: DOC_START + '/' + DOC_END,
      currentTime: DOC_START,
      multiplier: DOC_MULT,
      range: 'LOOP_STOP',
      step: 'SYSTEM_CLOCK_MULTIPLIER'
    }
  }
  const packets: Record<string, unknown>[] = [doc]
  const warn: string[] = []
  entities.forEach(e => {
    const p = buildEntity(e, warn)
    if (p) packets.push(p)
  })
  return { packets, warn }
}

export { TYPE_META }
