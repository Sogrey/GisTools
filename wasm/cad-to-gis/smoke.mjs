import { readFileSync } from 'fs'
import init, { dxf_to_gis_json } from './pkg/cad_to_gis.js'

await init({ module_or_path: readFileSync('./pkg/cad_to_gis_bg.wasm') })

const dxf = `0
SECTION
2
TABLES
0
LAYER
2
ROAD
62
1
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
2
TREE
10
0
20
0
0
CIRCLE
8
0
62
0
10
0
20
0
40
4
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
8
ROAD
2
TREE
10
30
20
-15
0
LINE
8
ROAD
62
256
10
0
20
0
11
120
21
0
0
TEXT
8
ROAD
10
1
20
1
40
2
1
Hi
0
ENDSEC
0
EOF
`

const out = JSON.parse(dxf_to_gis_json(dxf, JSON.stringify({ explode_blocks: true })))
console.log(JSON.stringify(out.stats))
console.log('line color', out.layers.lines.features[0]?.properties?.color_hex)
console.log('poly color', out.layers.polygons.features[0]?.properties?.color_hex)
console.log('anno', out.layers.annotations.features[0]?.properties?.text)
