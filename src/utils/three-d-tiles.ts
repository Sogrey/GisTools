/* ============================================================
 * 3D Tiles tileset.json 检查器 · 核心逻辑
 * 解析 tileset · 校验 geometricError / boundingVolume / transform
 * 提取自 doSometing/3d-tiles-inspector/index.html
 * ============================================================ */

const COLUMNS: Record<string, number> = { box: 12, region: 6, sphere: 4 }

export interface Issue {
  level: 'err' | 'warn' | 'info'
  path: string
  msg: string
}

export interface BvInfo {
  type: string
  arr: number[] | null
  ok: boolean
  text: string
}

export interface TileNode {
  path: string
  depth: number
  tile: Record<string, unknown>
  ge: number | null
  bv: BvInfo | null
  transform: number[] | null
  isIdentity: boolean
  uri: string | null
  hasContent: boolean
  childCount: number
}

export interface ParseResult {
  nodes: TileNode[]
  issues: Issue[]
  version: string
  rootGE: number | null
}

function num(x: number | undefined, d?: number): string {
  if (x === undefined || isNaN(x as number)) return '?'
  return Number(x).toFixed(d === undefined ? 3 : d)
}

function vec3(a: number[], i: number): string {
  return `[${num(a[i], 1)}, ${num(a[i + 1], 1)}, ${num(a[i + 2], 1)}]`
}

function vecLen(a: number[], i: number): number {
  return Math.sqrt(a[i]! * a[i]! + a[i + 1]! * a[i + 1]! + a[i + 2]! * a[i + 2]!)
}

function isIdentity(m: number[]): boolean {
  if (!Array.isArray(m) || m.length !== 16) return false
  for (let i = 0; i < 16; i++) {
    const expect = i % 5 === 0 ? 1 : 0
    if (Math.abs(m[i]! - expect) > 1e-9) return false
  }
  return true
}

function addIssue(state: ParseResult, level: Issue['level'], path: string, msg: string): void {
  state.issues.push({ level, path, msg })
}

function analyzeBV(bv: Record<string, unknown> | undefined, path: string, tag: string, state: ParseResult): BvInfo {
  const keys = bv ? Object.keys(bv) : []
  const types = keys.filter(k => k === 'box' || k === 'region' || k === 'sphere')
  if (types.length === 0) {
    addIssue(state, 'err', path, `${tag} boundingVolume 缺少 box/region/sphere 任一有效体积类型`)
    return { type: 'none', arr: null, ok: false, text: '--' }
  }
  if (types.length > 1) addIssue(state, 'warn', path, `${tag} boundingVolume 同时含 ${types.join('/')}，按规范应只声明一种`)
  const type = types[0]!
  const arr = (bv as Record<string, unknown>)[type] as number[]
  const expect = COLUMNS[type]
  if (!Array.isArray(arr)) {
    addIssue(state, 'err', path, `${tag} ${type} 应为数组`)
    return { type, arr: [], ok: false, text: '--' }
  }
  let text = ''
  if (arr.length !== expect) {
    addIssue(state, 'err', path, `${tag} ${type} 参数个数应为 ${expect}，实际 ${arr.length}`)
    text = `${type}(${arr.length} 参数)`
    return { type, arr, ok: false, text }
  }
  let ok = true
  if (type === 'box') {
    text = `中心 ${vec3(arr, 0)} · 半轴 ${num(vecLen(arr, 3), 0)} / ${num(vecLen(arr, 6), 0)} / ${num(vecLen(arr, 9), 0)}`
  } else if (type === 'region') {
    const w = arr[0]!, s = arr[1]!, e = arr[2]!, n = arr[3]!
    const we = num(w * 180 / Math.PI, 2), se = num(s * 180 / Math.PI, 2)
    const ee = num(e * 180 / Math.PI, 2), ne = num(n * 180 / Math.PI, 2)
    text = `${we}°E ${se}°N – ${ee}°E ${ne}°N · H ${num(arr[4], 0)}~${num(arr[5], 0)}m`
    if (e <= w) { addIssue(state, 'err', path, `${tag} region east(${ee}°) 应大于 west(${we}°)`); ok = false }
    if (n <= s) { addIssue(state, 'err', path, `${tag} region north(${ne}°) 应大于 south(${se}°)`); ok = false }
  } else {
    text = `中心 ${vec3(arr, 0)} · R=${num(arr[3], 1)}`
  }
  return { type, arr, ok, text }
}

function walkTile(tile: Record<string, unknown>, path: string, depth: number, parentGE: number | undefined, state: ParseResult): void {
  const info: TileNode = {
    path, depth, tile, ge: tile.geometricError as number | null,
    bv: null, transform: null, isIdentity: false,
    uri: null, hasContent: !!tile.content, childCount: 0
  }
  state.nodes.push(info)

  if (tile.boundingVolume) {
    info.bv = analyzeBV(tile.boundingVolume as Record<string, unknown>, path, 'tile', state)
  } else {
    addIssue(state, 'err', path, 'tile 缺少 boundingVolume')
    info.bv = { type: 'none', arr: null, ok: false, text: '--' }
  }
  const content = tile.content as Record<string, unknown> | undefined
  if (content) {
    if (!content.uri) addIssue(state, 'warn', path, 'content 存在但缺少 content.uri')
    info.uri = (content.uri as string) || null
    if (content.boundingVolume) analyzeBV(content.boundingVolume as Record<string, unknown>, path, 'content', state)
  }
  if (typeof tile.geometricError !== 'number') {
    addIssue(state, 'warn', path, '缺少 geometricError')
    info.ge = null
  } else if (tile.geometricError < 0) {
    addIssue(state, 'err', path, `geometricError 为负值 ${tile.geometricError}`)
  } else {
    if (parentGE !== undefined && tile.geometricError > parentGE) {
      addIssue(state, 'warn', path, `geometricError 未递减：父级 ${parentGE} → 子级 ${tile.geometricError}`)
    }
    if (state.rootGE !== null && path === '0' && tile.geometricError > state.rootGE) {
      addIssue(state, 'warn', path, `root.geometricError(${tile.geometricError}) 应小于 tileset.geometricError(${state.rootGE})`)
    }
  }
  if (tile.transform) {
    const t = tile.transform as number[]
    if (!Array.isArray(t) || t.length !== 16) {
      addIssue(state, 'err', path, `transform 应为 16 个数的列主序数组，实际长度 ${t ? t.length : 0}`)
    } else {
      info.transform = t
      if (!isIdentity(t)) addIssue(state, 'info', path, 'transform 非单位阵（含位移/旋转/缩放）')
      else info.isIdentity = true
    }
  }
  const kids = (tile.children || []) as Record<string, unknown>[]
  info.childCount = kids.length
  if (!kids.length) {
    if (!tile.content) addIssue(state, 'warn', path, '既无 children 也无 content（空 tile）')
  } else {
    kids.forEach((k, i) => walkTile(k, `${path}.${i}`, depth + 1, tile.geometricError as number, state))
  }
}

export function parseTileset(text: string): ParseResult {
  let json: Record<string, unknown>
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('JSON 解析失败')
  }
  const state: ParseResult = { nodes: [], issues: [], version: '--', rootGE: null }
  const asset = json.asset as Record<string, unknown> | undefined
  if (asset) {
    state.version = (asset.version as string) || '--'
    if (!asset.version) addIssue(state, 'warn', '0', 'asset 缺少 version')
    else if (String(asset.version) !== '1.0' && String(asset.version) !== '1.1')
      addIssue(state, 'warn', '0', `asset.version 为 ${asset.version}（预期 1.0 或 1.1）`)
  } else {
    addIssue(state, 'warn', '0', 'tileset 缺少 asset 对象')
  }
  state.rootGE = typeof json.geometricError === 'number' ? json.geometricError : null
  if (state.rootGE === null) addIssue(state, 'warn', '0', 'tileset 顶层缺少 geometricError')
  if (!json.root) {
    addIssue(state, 'err', '0', '缺失 root tile')
  } else {
    walkTile(json.root as Record<string, unknown>, '0', 0, state.rootGE ?? undefined, state)
  }
  return state
}

export const SAMPLE_TILESET = `{
  "asset": { "version": "1.0", "generator": "3d-tiles-inspector-demo" },
  "geometricError": 1000,
  "root": {
    "boundingVolume": { "region": [2.02, 0.5233, 2.05, 0.6109, 0, 800] },
    "geometricError": 500,
    "refine": "ADD",
    "content": { "uri": "tiles/root.b3dm" },
    "children": [
      {
        "boundingVolume": { "box": [1215000, -4860000, 0, 5000, 0, 0, 0, 5000, 0, 0, 0, 2000] },
        "geometricError": 100,
        "transform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 100,0,0,1],
        "content": { "uri": "tiles/L12-0.b3dm" }
      },
      {
        "boundingVolume": { "sphere": [1215000, -4860000, 0, 4000] },
        "geometricError": 550,
        "content": { "uri": "tiles/L12-1.b3dm" }
      },
      {
        "boundingVolume": { "box": [1215000, -4860000, 0, 3000, 0, 0, 0, 3000, 0, 0] },
        "geometricError": 80,
        "content": { "uri": "tiles/L12-2.b3dm" }
      },
      {
        "geometricError": 200,
        "content": { "uri": "tiles/L12-3.b3dm" }
      },
      {
        "boundingVolume": { "region": [2.1, 0.5, 2.0, 0.55, 0, 200] },
        "geometricError": 50,
        "content": { "uri": "tiles/L12-4.b3dm" }
      },
      {
        "boundingVolume": { "sphere": [1215000, -4860000, 0, 1000] },
        "content": { "uri": "tiles/L12-5.b3dm" }
      }
    ]
  }
}`
