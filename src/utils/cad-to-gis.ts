/**
 * CAD → GIS (DXF → GeoJSON) — loads Rust WASM, keeps data in-browser.
 */

export interface CadToGisOptions {
  sagitta?: number
  max_depth?: number
  explode_blocks?: boolean
  model_space_only?: boolean
  closed_polyline_as_polygon?: boolean
  include_invisible?: boolean
}

export interface CadToGisStats {
  entities_in: number
  features_out: number
  points: number
  lines: number
  polygons: number
  annotations: number
  blocks_expanded: number
  skipped: number
}

export interface GisFeature {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: unknown
  } | null
  properties: Record<string, unknown> | null
}

export interface GisFeatureCollection {
  type: 'FeatureCollection'
  features: GisFeature[]
}

export interface CadToGisResult {
  type: 'CadToGisResult'
  options: Record<string, unknown>
  stats: CadToGisStats
  warnings: string[]
  layers: {
    points: GisFeatureCollection
    lines: GisFeatureCollection
    polygons: GisFeatureCollection
    annotations: GisFeatureCollection
  }
}

type WasmModule = {
  default: (module_or_path?: unknown) => Promise<unknown>
  dxf_to_gis_json: (dxfText: string, optionsJson: string) => string
  merge_layers_json: (resultJson: string) => string
}

let wasmPromise: Promise<WasmModule> | null = null

async function loadWasm(): Promise<WasmModule> {
  if (!wasmPromise) {
    wasmPromise = (async () => {
      const mod = (await import('../../wasm/cad-to-gis/pkg/cad_to_gis.js')) as unknown as WasmModule
      const wasmUrl = (await import('../../wasm/cad-to-gis/pkg/cad_to_gis_bg.wasm?url')).default
      await mod.default({ module_or_path: wasmUrl })
      return mod
    })()
  }
  return wasmPromise
}

export async function convertDxfToGis(
  dxfText: string,
  options: CadToGisOptions = {},
): Promise<CadToGisResult> {
  const mod = await loadWasm()
  const json = mod.dxf_to_gis_json(dxfText, JSON.stringify(options))
  return JSON.parse(json) as CadToGisResult
}

export async function mergeLayers(result: CadToGisResult): Promise<GisFeatureCollection> {
  const mod = await loadWasm()
  const json = mod.merge_layers_json(JSON.stringify(result))
  return JSON.parse(json) as GisFeatureCollection
}

export function downloadText(filename: string, text: string, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function layerFilename(base: string, layer: string) {
  const stem = base.replace(/\.(dxf|dwg)$/i, '') || 'cad'
  return `${stem}_${layer}.geojson`
}

/** Minimal SVG preview of merged features (local CRS, no basemap). */
export function featuresToSvg(
  fc: GisFeatureCollection,
  width = 640,
  height = 480,
  pad = 16,
): string {
  const pts: [number, number][] = []
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      pts.push([coords[0] as number, coords[1] as number])
      return
    }
    for (const c of coords) walk(c)
  }
  for (const f of fc.features) {
    if (f.geometry) walk(f.geometry.coordinates)
  }
  if (pts.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><text x="16" y="32" fill="#888">无几何</text></svg>`
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  const dx = Math.max(maxX - minX, 1e-9)
  const dy = Math.max(maxY - minY, 1e-9)
  const sx = (width - pad * 2) / dx
  const sy = (height - pad * 2) / dy
  const s = Math.min(sx, sy)
  const tx = (x: number) => pad + (x - minX) * s
  const ty = (y: number) => height - pad - (y - minY) * s // Y-up CAD → SVG Y-down

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#0f1118"/>`,
  ]

  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    const color = String((f.properties as Record<string, unknown>)?.color_hex || '#66a3ff')
    const lw = Number((f.properties as Record<string, unknown>)?.line_mm || 0.25)
    const strokeW = Math.max(0.5, Math.min(3, lw * 2))

    if (g.type === 'Point') {
      const [x, y] = g.coordinates as [number, number]
      parts.push(`<circle cx="${tx(x).toFixed(2)}" cy="${ty(y).toFixed(2)}" r="2.5" fill="${color}"/>`)
    } else if (g.type === 'LineString') {
      const d = (g.coordinates as [number, number][])
        .map((c, i) => `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(2)} ${ty(c[1]).toFixed(2)}`)
        .join(' ')
      parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeW}"/>`)
    } else if (g.type === 'Polygon') {
      const rings = g.coordinates as [number, number][][]
      const d = rings
        .map((ring) =>
          ring
            .map((c, i) => `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(2)} ${ty(c[1]).toFixed(2)}`)
            .join(' ') + ' Z',
        )
        .join(' ')
      parts.push(
        `<path d="${d}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="${strokeW}"/>`,
      )
    } else if (g.type === 'MultiLineString') {
      for (const line of g.coordinates as [number, number][][]) {
        const d = line
          .map((c, i) => `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(2)} ${ty(c[1]).toFixed(2)}`)
          .join(' ')
        parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeW}"/>`)
      }
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as [number, number][][][]) {
        const d = poly
          .map(
            (ring) =>
              ring
                .map((c, i) => `${i === 0 ? 'M' : 'L'}${tx(c[0]).toFixed(2)} ${ty(c[1]).toFixed(2)}`)
                .join(' ') + ' Z',
          )
          .join(' ')
        parts.push(
          `<path d="${d}" fill="${color}" fill-opacity="0.25" stroke="${color}" stroke-width="${strokeW}"/>`,
        )
      }
    }
  }
  parts.push('</svg>')
  return parts.join('')
}

export const SAMPLE_DXF = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1021
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LAYER
70
3
0
LAYER
2
ROAD
70
0
62
1
6
Continuous
0
LAYER
2
BUILDING
70
0
62
5
6
Continuous
0
LAYER
2
ANNOTATION
70
0
62
3
6
Continuous
0
ENDTAB
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
8
0
2
TREE
10
0.0
20
0.0
30
0.0
0
CIRCLE
8
0
62
0
10
0.0
20
0.0
40
4.0
0
LINE
8
0
62
0
10
0.0
20
-6.0
11
0.0
21
6.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
LWPOLYLINE
8
BUILDING
62
256
90
4
70
1
10
20.0
20
20.0
10
80.0
20
20.0
10
80.0
20
60.0
10
20.0
20
60.0
0
LINE
8
ROAD
62
256
10
0.0
20
0.0
11
120.0
21
0.0
0
INSERT
8
ROAD
2
TREE
10
30.0
20
-15.0
41
1.0
42
1.0
50
0.0
0
INSERT
8
ROAD
2
TREE
10
90.0
20
-15.0
41
1.5
42
1.5
50
30.0
0
CIRCLE
8
ROAD
62
256
10
50.0
20
40.0
40
8.0
0
ARC
8
ROAD
10
100.0
20
40.0
40
12.0
50
0.0
51
180.0
0
TEXT
8
ANNOTATION
10
25.0
20
65.0
40
3.0
1
Building A
0
HATCH
8
BUILDING
62
256
91
1
92
1
93
4
10
25.0
20
25.0
10
40.0
20
25.0
10
40.0
20
35.0
10
25.0
20
35.0
0
ENDSEC
0
EOF
`
