# Build cad-to-gis WASM package (requires rustc + wasm32-unknown-unknown + wasm-bindgen-cli)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

rustup target add wasm32-unknown-unknown | Out-Null
cargo build --target wasm32-unknown-unknown --release

$targetRoot = if ($env:CARGO_TARGET_DIR) { $env:CARGO_TARGET_DIR } else { Join-Path $PSScriptRoot "target" }
$wasm = Join-Path $targetRoot "wasm32-unknown-unknown/release/cad_to_gis.wasm"
if (-not (Test-Path $wasm)) {
  throw "WASM artifact not found: $wasm"
}

New-Item -ItemType Directory -Force -Path (Join-Path $PSScriptRoot "pkg") | Out-Null
wasm-bindgen --target web --out-dir pkg --out-name cad_to_gis $wasm
Write-Host "OK -> $(Join-Path $PSScriptRoot 'pkg')"
