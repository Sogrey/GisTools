# cad-to-gis (Rust → WASM)

Browser-side **DXF → layered GeoJSON** converter:

- BYLAYER / BYBLOCK style inheritance (color, linetype, lineweight)
- INSERT block explode with transform + cycle/depth guards
- Curve flattening by sagitta (CIRCLE / ARC / ELLIPSE / SPLINE / bulge)
- OCS → WCS (Arbitrary Axis Algorithm)
- Output layers: `points` / `lines` / `polygons` / `annotations`

## Build

Requires Rust + `wasm32-unknown-unknown` + `wasm-bindgen-cli` (=0.2.100):

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.100
# from repo root:
pnpm run build:wasm
# or:
powershell -File wasm/cad-to-gis/build.ps1
```

Artifacts land in `pkg/` (committed so the Vue app runs without a local Rust toolchain).

## Test

```bash
cargo test --locked
node smoke.mjs   # requires pkg/ prebuilt
```

CI: `.github/workflows/wasm-check.yml` runs the above only when `wasm/**` changes.
