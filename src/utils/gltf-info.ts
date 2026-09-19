/* ============================================================
 * glTF / GLB 元信息提取器 · 核心逻辑
 * GLB 二进制容器解析 · 模型元数据统计
 * 提取自 doSometing/gltf-info/index.html
 * ============================================================ */

const GLB_MAGIC = 0x46546C67
const CHUNK_JSON = 0x4E4F534A
const CHUNK_BIN = 0x004E4942

const MODES: Record<number, string> = {
  0: 'POINTS', 1: 'LINES', 2: 'LINE_LOOP', 3: 'LINE_STRIP',
  4: 'TRIANGLES', 5: 'TRIANGLE_STRIP', 6: 'TRIANGLE_FAN'
}

export interface GlbMeta {
  gltf: Record<string, unknown>
  container: string
  fileSize: number
  jsonSize: number
  binSize: number
  chunks: { type: string; size: number }[] | null
  warnings: string[]
}

function fmtBytes(n: number | null): string {
  if (n == null || isNaN(n)) return '—'
  if (n < 1024) return n + ' B'
  if (n < 1048576) return (n / 1024).toFixed(2) + ' KB'
  if (n < 1073741824) return (n / 1048576).toFixed(2) + ' MB'
  return (n / 1073741824).toFixed(2) + ' GB'
}

function fmtNum(n: number | null | undefined): string {
  return (n == null ? 0 : n).toLocaleString('en-US')
}

function arrOf(g: Record<string, unknown>, k: string): unknown[] {
  return Array.isArray(g[k]) ? g[k] as unknown[] : []
}

function nameOf(o: { name?: string } | undefined, i: number): string {
  return o && o.name ? o.name : '#' + i
}

function triFromMode(mode: number, n: number): number | null {
  if (mode === 4) return n / 3
  if (mode === 5 || mode === 6) return n - 2
  return null
}

export function parseGLB(buf: ArrayBuffer): GlbMeta {
  if (buf.byteLength < 12) throw new Error('文件过小（<12 字节），不是有效的 GLB')
  const dv = new DataView(buf)
  const magic = dv.getUint32(0, true)
  if (magic !== GLB_MAGIC) throw new Error('头部魔数不匹配：实际 0x' + magic.toString(16) + '，期望 0x46546C67（"glTF"）')
  const version = dv.getUint32(4, true)
  const declared = dv.getUint32(8, true)
  const warnings: string[] = []
  if (declared !== buf.byteLength) warnings.push(`header.length=${declared} B 与实际文件大小 ${buf.byteLength} B 不一致`)

  const chunks: { type: number; length: number; data: Uint8Array }[] = []
  let off = 12
  while (off < buf.byteLength) {
    if (off + 8 > buf.byteLength) throw new Error('chunk 头越界（offset=' + off + '）')
    const cl = dv.getUint32(off, true)
    const ct = dv.getUint32(off + 4, true)
    off += 8
    if (off + cl > buf.byteLength) throw new Error('chunk 数据越界：chunkLength=' + cl + ' 超出文件末尾')
    chunks.push({ type: ct, length: cl, data: new Uint8Array(buf, off, cl) })
    off += cl
  }
  if (chunks.length === 0) throw new Error('未找到任何 chunk')

  const jsonChunk = chunks.find(c => c.type === CHUNK_JSON)
  if (!jsonChunk) throw new Error('未找到 JSON chunk（type 应为 0x4E4F534A "JSON"）')
  let jsonText: string
  try {
    jsonText = new TextDecoder('utf-8').decode(jsonChunk.data)
  } catch (e) {
    throw new Error('JSON chunk 文本解码失败：' + (e as Error).message)
  }
  let gltf: Record<string, unknown>
  try {
    gltf = JSON.parse(jsonText)
  } catch (e) {
    throw new Error('JSON chunk 解析失败：' + (e as Error).message)
  }

  const binChunk = chunks.find(c => c.type === CHUNK_BIN)
  return {
    gltf,
    container: 'GLB v' + version,
    fileSize: buf.byteLength,
    jsonSize: jsonChunk.data.length,
    binSize: binChunk ? binChunk.data.length : 0,
    chunks: chunks.map(c => ({
      type: c.type === CHUNK_JSON ? 'JSON' : (c.type === CHUNK_BIN ? 'BIN' : '0x' + c.type.toString(16)),
      size: c.data.length
    })),
    warnings
  }
}

export interface GlbAnalysis {
  asset: Record<string, unknown>
  meshRows: { name: string; prims: number; verts: number; tris: number; est: number; hasIdx: boolean; modes: string; mats: string }[]
  matRows: { name: string; used: number; base: string; metallic: number | null; roughness: number | null; doubleSided: boolean }[]
  sceneRows: { name: string; count: number; names: string }[]
  overview: [string, number, string][]
  totals: { prims: number; verts: number; tris: number; est: number }
  matTotal: number
  texTotal: number
  imgTotal: number
  nodeTotal: number
  sceneCount: number
  rootTotal: number
}

export function analyzeGltf(gltf: Record<string, unknown>): GlbAnalysis {
  const accessors = arrOf(gltf, 'accessors') as Record<string, unknown>[]
  const meshes = arrOf(gltf, 'meshes') as Record<string, unknown>[]
  const materials = arrOf(gltf, 'materials') as Record<string, unknown>[]
  const nodes = arrOf(gltf, 'nodes') as Record<string, unknown>[]
  const scenes = arrOf(gltf, 'scenes') as Record<string, unknown>[]

  const globalPos = new Set<number>()
  const globalIdx = new Set<number>()
  let totalPrims = 0, totalVerts = 0, totalTris = 0, totalEst = 0
  const meshRows: GlbAnalysis['meshRows'] = []

  meshes.forEach((m, mi) => {
    const prims = (m.primitives || []) as Record<string, unknown>[]
    const localPos = new Set<number>()
    const localIdx = new Set<number>()
    let verts = 0, tris = 0, est = 0, hasIndexed = false
    const modeDist: Record<number, number> = {}

    prims.forEach(p => {
      const mode = (p.mode == null ? 4 : p.mode) as number
      modeDist[mode] = (modeDist[mode] || 0) + 1
      if (p.indices != null) hasIndexed = true

      const attrs = p.attributes as Record<string, number> | undefined
      const pos = attrs ? attrs.POSITION : undefined
      let v = 0
      if (pos != null) {
        const a = accessors[pos]
        v = a ? (a.count as number || 0) : 0
        if (!localPos.has(pos)) { localPos.add(pos); verts += v }
        if (!globalPos.has(pos)) { globalPos.add(pos); totalVerts += v }
      }

      if (p.indices != null) {
        const a = accessors[p.indices as number]
        const t = a ? triFromMode(mode, a.count as number || 0) : null
        if (t != null && !localIdx.has(p.indices as number)) {
          localIdx.add(p.indices as number)
          tris += t
          if (!globalIdx.has(p.indices as number)) { globalIdx.add(p.indices as number); totalTris += t }
        }
      } else if (mode === 4 || mode === 5 || mode === 6) {
        const t = triFromMode(mode, v)
        if (t != null) { tris += t; est += t; totalTris += t; totalEst += t }
      }
    })

    totalPrims += prims.length
    const matNames = prims.map(p => {
      if (p.material != null && materials[p.material as number]) {
        return (materials[p.material as number]!.name as string) || '#' + p.material
      }
      return null
    }).filter(Boolean)
    meshRows.push({
      name: nameOf(m as { name?: string }, mi),
      prims: prims.length, verts, tris, est, hasIdx: hasIndexed,
      modes: Object.keys(modeDist).sort().map(k => MODES[+k] + '×' + modeDist[+k]).join(' · '),
      mats: Array.from(new Set(matNames)).join('、') || '—'
    })
  })

  const matUsed = new Array(materials.length).fill(0)
  meshes.forEach(m => ((m.primitives || []) as Record<string, unknown>[]).forEach(p => {
    if (p.material != null && (p.material as number) >= 0 && (p.material as number) < matUsed.length) matUsed[p.material as number]++
  }))
  const matRows = materials.map((mt, i) => {
    const pbr = (mt.pbrMetallicRoughness || {}) as Record<string, unknown>
    const cf = (pbr.baseColorFactor || [1, 1, 1, 1]) as number[]
    return {
      name: nameOf(mt as { name?: string }, i),
      used: matUsed[i] || 0,
      base: 'rgba(' + cf.slice(0, 4).map(v => Math.round((v ?? 0) * 255)).join(',') + ')',
      metallic: pbr.metallicFactor != null ? pbr.metallicFactor as number : null,
      roughness: pbr.roughnessFactor != null ? pbr.roughnessFactor as number : null,
      doubleSided: !!mt.doubleSided
    }
  })

  const sceneRows = scenes.map((s, i) => {
    const roots = (s.nodes || []) as number[]
    const names = roots.slice(0, 8).map(n => {
      const nd = nodes[n]
      return nd ? (nd.name as string || '#' + n) : '#' + n
    })
    return {
      name: nameOf(s as { name?: string }, i),
      count: roots.length,
      names: names.join('、') + (roots.length > 8 ? ' …' : '')
    }
  })
  const rootTotal = scenes.reduce((s, sc) => s + ((sc.nodes as number[] || []).length), 0)

  const buffers = arrOf(gltf, 'buffers') as Record<string, unknown>[]
  const bufferViews = arrOf(gltf, 'bufferViews')
  const binByBuffer = buffers.reduce((s, b) => s + (b.byteLength as number || 0), 0)
  const overview: [string, number, string][] = [
    ['accessors', accessors.length, '顶点 / 索引 / 变换数据视图'],
    ['bufferViews', bufferViews.length, '缓冲视图（访问范围）'],
    ['buffers', buffers.length, '缓冲区总量 ' + fmtBytes(binByBuffer)],
    ['meshes', meshes.length, '网格模型'],
    ['materials', materials.length, 'PBR 材质'],
    ['textures', arrOf(gltf, 'textures').length, '纹理'],
    ['images', arrOf(gltf, 'images').length, '图像'],
    ['nodes', nodes.length, '场景树节点'],
    ['scenes', scenes.length, '根场景，根节点合计 ' + rootTotal],
    ['cameras', arrOf(gltf, 'cameras').length, '相机'],
    ['animations', arrOf(gltf, 'animations').length, '动画'],
    ['skins', arrOf(gltf, 'skins').length, '蒙皮']
  ]

  return {
    asset: (gltf.asset || {}) as Record<string, unknown>,
    meshRows, matRows, sceneRows, overview,
    totals: { prims: totalPrims, verts: totalVerts, tris: totalTris, est: totalEst },
    matTotal: materials.length,
    texTotal: arrOf(gltf, 'textures').length,
    imgTotal: arrOf(gltf, 'images').length,
    nodeTotal: nodes.length,
    sceneCount: scenes.length,
    rootTotal
  }
}

export function parseGltfText(text: string): GlbMeta {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1)
  let gltf: Record<string, unknown>
  try {
    gltf = JSON.parse(text)
  } catch (e) {
    if (/[^\x09\x0A\x0D\x20-\x7E]/.test(text.slice(0, 2000)))
      throw new Error('内容不是有效 JSON（可能选择了二进制文件，请改用 .glb 文件）')
    throw new Error('JSON 解析失败：' + (e as Error).message)
  }
  if (!gltf || typeof gltf !== 'object' || Array.isArray(gltf))
    throw new Error('JSON 顶层不是 glTF 对象（需含 asset / meshes 等字段）')
  const buffers = Array.isArray(gltf.buffers) ? gltf.buffers as Record<string, unknown>[] : []
  const binBytes = buffers.reduce((s, b) => s + (b.byteLength as number || 0), 0)
  return {
    gltf,
    container: 'GLTF JSON',
    fileSize: new Blob([text]).size,
    jsonSize: new Blob([text]).size,
    binSize: binBytes,
    chunks: null,
    warnings: []
  }
}

export { fmtBytes, fmtNum }
