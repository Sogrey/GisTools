/* tslint:disable */
/* eslint-disable */
export function start(): void;
/**
 * Convert ASCII DXF text to layered GeoJSON.
 *
 * `options_json` example:
 * `{ "sagitta": 0.01, "max_depth": 4, "explode_blocks": true, "closed_polyline_as_polygon": true }`
 */
export function dxf_to_gis(dxf_text: string, options_json: string): any;
/**
 * Same as `dxf_to_gis`, but returns a compact JSON string (better for huge drawings).
 */
export function dxf_to_gis_json(dxf_text: string, options_json: string): string;
/**
 * Merge the four layers into one FeatureCollection JSON string.
 */
export function merge_layers_json(result_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly dxf_to_gis: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly dxf_to_gis_json: (a: number, b: number, c: number, d: number) => [number, number, number, number];
  readonly merge_layers_json: (a: number, b: number) => [number, number, number, number];
  readonly start: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_3: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
