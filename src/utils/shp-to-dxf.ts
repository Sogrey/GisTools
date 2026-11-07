/**
 * 多 SHP → 单 DXF 批量编排
 * 配对 shp/dbf/prj/cpg，按文件名分图层，可选投影变换，输出 DXF + 图层对照 CSV
 */

import {
  parseSHP,
  parseDBF,
  parseZip,
  buildGeoJSON,
  CPG_ENC_MAP,
  type GeoJSONFeatureCollection,
} from './shp-parser'
import {
  geojsonLayersToDxf,
  sanitizeDxfLayerName,
  type GeomToDxfOptions,
} from './dxf-convert'
import { reprojectGeoJSON } from './reproject'
import { fwd4, fwd7 } from './seven-param'

export interface NamedBuffer {
  /** 相对路径或文件名，用于图层名与对照表 */
  path: string
  data: Uint8Array
}

export interface ShpGroup {
  /** 不含扩展名的基名（路径中的最后一段） */
  baseName: string
  /** 用于对照表展示的相对路径（去扩展名） */
  sourceKey: string
  shp: Uint8Array
  dbf?: Uint8Array
  prj?: string
  cpg?: string
}

export interface LayerReport {
  layerName: string
  sourcePath: string
  featureCount: number
  shapeType: string
  sourceCrs: string
  transform: string
  error?: string
}

export type CrsMode = 'none' | 'reproject' | 'seven' | 'four'

export interface ReprojectCrsOptions {
  mode: 'reproject'
  srcCrs: string
  dstCrs: string
}

export interface SevenParamCrsOptions {
  mode: 'seven'
  dx: number
  dy: number
  dz: number
  rx: number
  ry: number
  rz: number
  ppm: number
}

export interface FourParamCrsOptions {
  mode: 'four'
  dx: number
  dy: number
  rotD: number
  k: number
}

export type CrsTransformOptions =
  | { mode: 'none' }
  | ReprojectCrsOptions
  | SevenParamCrsOptions
  | FourParamCrsOptions

export interface ConvertShpBatchOptions extends GeomToDxfOptions {
  encoding?: string
  crs?: CrsTransformOptions
  /** 进度回调 0–100 */
  onProgress?: (percent: number, message: string) => void
}

export interface ConvertShpBatchResult {
  dxf: string
  csv: string
  reports: LayerReport[]
  entityCount: number
  layerCount: number
  totalFeatures: number
}

const SHP_EXTS = new Set(['.shp', '.dbf', '.prj', '.cpg', '.shx', '.sbn', '.sbx', '.fbn', '.fbx', '.ain', '.aih', '.ixs', '.mxs', '.atx', '.xml', '.qix'])

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/')
}

function stripExt(path: string): string {
  const n = normalizePath(path)
  const i = n.lastIndexOf('.')
  if (i <= 0) return n
  return n.slice(0, i)
}

function getExt(path: string): string {
  const n = normalizePath(path)
  const i = n.lastIndexOf('.')
  if (i < 0) return ''
  return n.slice(i).toLowerCase()
}

function baseNameOf(path: string): string {
  const key = stripExt(path)
  const slash = key.lastIndexOf('/')
  return slash >= 0 ? key.slice(slash + 1) : key
}

function decodeText(buf: Uint8Array, encoding = 'utf-8'): string {
  try {
    return new TextDecoder(encoding).decode(buf)
  } catch {
    return new TextDecoder('utf-8').decode(buf)
  }
}

function resolveEncoding(cpgText: string | undefined, fallback?: string): string {
  if (fallback) return fallback
  if (!cpgText) return 'utf-8'
  const key = cpgText.trim().toLowerCase().replace(/\s+/g, '')
  return CPG_ENC_MAP[key] || key || 'utf-8'
}

function summarizePrj(prj: string | undefined): string {
  if (!prj || !prj.trim()) return '(无 .prj)'
  const t = prj.trim()
  const geog = t.match(/GEOGCS\["([^"]+)"/i)
  const proj = t.match(/PROJCS\["([^"]+)"/i)
  if (proj) return proj[1]!
  if (geog) return geog[1]!
  return t.length > 80 ? t.slice(0, 80) + '…' : t
}

/**
 * 将扁平文件列表（含 zip 内路径）配对成 ShpGroup
 */
export function pairShpGroups(files: NamedBuffer[]): ShpGroup[] {
  const byKey = new Map<string, Partial<ShpGroup> & { sourceKey: string; baseName: string }>()

  for (const f of files) {
    const path = normalizePath(f.path)
    const ext = getExt(path)
    if (!ext || !SHP_EXTS.has(ext)) continue
    // 跳过 macOS 资源叉等
    if (path.includes('__MACOSX/') || path.split('/').pop()?.startsWith('.')) continue

    const sourceKey = stripExt(path)
    const baseName = baseNameOf(path)
    if (!byKey.has(sourceKey)) {
      byKey.set(sourceKey, { sourceKey, baseName })
    }
    const g = byKey.get(sourceKey)!
    if (ext === '.shp') g.shp = f.data
    else if (ext === '.dbf') g.dbf = f.data
    else if (ext === '.prj') g.prj = decodeText(f.data)
    else if (ext === '.cpg') g.cpg = decodeText(f.data).trim()
  }

  const groups: ShpGroup[] = []
  for (const g of byKey.values()) {
    if (!g.shp) continue
    groups.push({
      baseName: g.baseName,
      sourceKey: g.sourceKey,
      shp: g.shp,
      dbf: g.dbf,
      prj: g.prj,
      cpg: g.cpg,
    })
  }

  groups.sort((a, b) => a.sourceKey.localeCompare(b.sourceKey, 'zh'))
  return groups
}

/**
 * 从浏览器 File 列表收集（支持目录选择与多选）
 */
export async function filesToNamedBuffers(fileList: FileList | File[]): Promise<NamedBuffer[]> {
  const files = Array.from(fileList)
  const out: NamedBuffer[] = []

  for (const file of files) {
    const name = normalizePath((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
    const buf = new Uint8Array(await file.arrayBuffer())
    const lower = name.toLowerCase()

    if (lower.endsWith('.zip')) {
      const unzipped = parseZip(buf)
      for (const [innerPath, data] of Object.entries(unzipped)) {
        out.push({ path: `${stripExt(name)}/${normalizePath(innerPath)}`, data })
      }
    } else {
      out.push({ path: name, data: buf })
    }
  }

  return out
}

function uniqueLayerNames(groups: ShpGroup[]): Map<string, string> {
  /** sourceKey → layerName */
  const map = new Map<string, string>()
  const used = new Set<string>()

  for (const g of groups) {
    let name = sanitizeDxfLayerName(g.baseName, 'LAYER')
    if (used.has(name)) {
      const parts = g.sourceKey.split('/')
      const disambig = parts.length > 1 ? parts.slice(-2).join('_') : `${g.baseName}_2`
      name = sanitizeDxfLayerName(disambig, 'LAYER')
      let n = 2
      while (used.has(name)) {
        name = sanitizeDxfLayerName(`${disambig}_${n}`, 'LAYER')
        n++
      }
    }
    used.add(name)
    map.set(g.sourceKey, name)
  }
  return map
}

function transformLabel(crs: CrsTransformOptions | undefined): string {
  if (!crs || crs.mode === 'none') return '保持源坐标'
  if (crs.mode === 'reproject') return `${crs.srcCrs} → ${crs.dstCrs}`
  if (crs.mode === 'seven') {
    return `七参数 dx=${crs.dx},dy=${crs.dy},dz=${crs.dz},rx=${crs.rx},ry=${crs.ry},rz=${crs.rz},k=${crs.ppm}ppm`
  }
  return `四参数 dx=${crs.dx},dy=${crs.dy},rot=${crs.rotD},k=${crs.k}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySevenOrFour(geojson: any, crs: SevenParamCrsOptions | FourParamCrsOptions): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walkCoords(coords: any): void {
    if (!coords || !coords.length) return
    if (typeof coords[0] === 'number') {
      if (crs.mode === 'seven') {
        const z = coords[2] ?? 0
        const out = fwd7(crs.dx, crs.dy, crs.dz, crs.rx, crs.ry, crs.rz, crs.ppm, [[coords[0], coords[1], z]])[0]!
        coords[0] = out[0]
        coords[1] = out[1]
        if (coords.length >= 3 || out[2] !== 0) coords[2] = out[2]
      } else {
        const out = fwd4(crs.dx, crs.dy, crs.rotD, crs.k, [[coords[0], coords[1]]])[0]!
        coords[0] = out[0]
        coords[1] = out[1]
      }
      return
    }
    for (let i = 0; i < coords.length; i++) walkCoords(coords[i])
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function walk(o: any): void {
    if (!o || typeof o !== 'object') return
    if (o.type === 'FeatureCollection') {
      ;(o.features || []).forEach(walk)
      return
    }
    if (o.type === 'Feature') {
      walk(o.geometry)
      return
    }
    if (o.coordinates) walkCoords(o.coordinates)
  }
  walk(geojson)
}

function applyCrs(geojson: GeoJSONFeatureCollection, crs: CrsTransformOptions | undefined): GeoJSONFeatureCollection {
  if (!crs || crs.mode === 'none') return geojson
  if (crs.mode === 'reproject') {
    return reprojectGeoJSON(geojson, crs.srcCrs, crs.dstCrs) as GeoJSONFeatureCollection
  }
  const clone = JSON.parse(JSON.stringify(geojson)) as GeoJSONFeatureCollection
  applySevenOrFour(clone, crs)
  return clone
}

export function buildLayerCsv(reports: LayerReport[]): string {
  const header = ['图层名', '源路径', '要素数', '几何类型', '源坐标系', '坐标变换', '错误']
  const rows = reports.map((r) =>
    [r.layerName, r.sourcePath, r.featureCount, r.shapeType, r.sourceCrs, r.transform, r.error || '']
      .map((cell) => {
        const s = String(cell)
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
        return s
      })
      .join(','),
  )
  // BOM 方便 Excel 打开中文
  return '\uFEFF' + [header.join(','), ...rows].join('\n')
}

/**
 * 批量 SHP → 单 DXF + 对照表
 */
export async function convertShpBatchToDxf(
  groups: ShpGroup[],
  options: ConvertShpBatchOptions = {},
): Promise<ConvertShpBatchResult> {
  const onProgress = options.onProgress
  const crs = options.crs || { mode: 'none' as const }
  const layerNames = uniqueLayerNames(groups)
  const reports: LayerReport[] = []
  const layers: { layerName: string; geojson: GeoJSONFeatureCollection }[] = []
  let totalFeatures = 0

  const n = groups.length || 1
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]!
    const layerName = layerNames.get(g.sourceKey) || sanitizeDxfLayerName(g.baseName)
    onProgress?.(Math.round(((i) / n) * 85), `解析 ${g.baseName} (${i + 1}/${groups.length})`)

    const report: LayerReport = {
      layerName,
      sourcePath: g.sourceKey,
      featureCount: 0,
      shapeType: '',
      sourceCrs: summarizePrj(g.prj),
      transform: transformLabel(crs),
    }

    try {
      const shpAb = g.shp.buffer.slice(g.shp.byteOffset, g.shp.byteOffset + g.shp.byteLength) as ArrayBuffer
      const shpResult = parseSHP(shpAb)
      report.shapeType = shpResult.shapeTypeName

      let dbfResult = null
      if (g.dbf) {
        const enc = resolveEncoding(g.cpg, options.encoding)
        const dbfAb = g.dbf.buffer.slice(g.dbf.byteOffset, g.dbf.byteOffset + g.dbf.byteLength) as ArrayBuffer
        dbfResult = parseDBF(dbfAb, enc)
      }

      let geojson = buildGeoJSON(shpResult, dbfResult)
      geojson = applyCrs(geojson, crs)
      report.featureCount = geojson.features.length
      totalFeatures += report.featureCount
      layers.push({ layerName, geojson })
    } catch (err) {
      report.error = err instanceof Error ? err.message : String(err)
      report.featureCount = 0
    }

    reports.push(report)
    // 让出主线程，避免大批量卡死 UI
    await new Promise((r) => setTimeout(r, 0))
  }

  onProgress?.(90, '写出 DXF…')
  const { dxf, entityCount, layerCount } = geojsonLayersToDxf(
    layers.map((l) => ({ layerName: l.layerName, geojson: l.geojson })),
    {
      textHeight: options.textHeight,
      writeAnnotationText: options.writeAnnotationText,
    },
  )

  onProgress?.(98, '生成对照表…')
  const csv = buildLayerCsv(reports)
  onProgress?.(100, '完成')

  return {
    dxf,
    csv,
    reports,
    entityCount,
    layerCount,
    totalFeatures,
  }
}

/** 试算：取第一层前几个点做坐标变换预览 */
export function trialTransformSample(
  group: ShpGroup,
  crs: CrsTransformOptions,
  sampleCount = 3,
): { before: number[][]; after: number[][]; crsLabel: string } {
  const shpAb = group.shp.buffer.slice(group.shp.byteOffset, group.shp.byteOffset + group.shp.byteLength) as ArrayBuffer
  const shpResult = parseSHP(shpAb)
  const before: number[][] = []
  for (const geom of shpResult.records) {
    if (!geom || !geom.coordinates) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flat: number[][] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function collect(c: any): void {
      if (!c || !c.length) return
      if (typeof c[0] === 'number') {
        flat.push(c.slice(0, 3) as number[])
        return
      }
      for (let i = 0; i < c.length; i++) collect(c[i])
    }
    collect(geom.coordinates)
    for (const p of flat) {
      before.push(p)
      if (before.length >= sampleCount) break
    }
    if (before.length >= sampleCount) break
  }

  const fc: GeoJSONFeatureCollection = {
    type: 'FeatureCollection',
    features: before.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: p.slice() },
      properties: {},
    })),
  }
  const transformed = applyCrs(fc, crs)
  const after = transformed.features.map((f) => {
    const c = (f.geometry as { coordinates: number[] }).coordinates
    return c.slice(0, 3)
  })

  return { before, after, crsLabel: transformLabel(crs) }
}
