/// <reference types="vite/client" />

declare module '*.wasm?url' {
  const src: string
  export default src
}

declare module '*cad_to_gis.js' {
  export function dxf_to_gis_json(dxf_text: string, options_json: string): string
  export function merge_layers_json(result_json: string): string
  export default function init(
    module_or_path?:
      | { module_or_path: RequestInfo | URL | Response | BufferSource | WebAssembly.Module }
      | RequestInfo
      | URL
      | Response
      | BufferSource
      | WebAssembly.Module,
  ): Promise<unknown>
}
