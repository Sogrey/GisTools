//! CAD → GIS (DXF → GeoJSON) WASM entry.

mod aci;
mod extract;
mod geojson;
mod geometry;
mod parser;
mod style;

use extract::ConvertOptions;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Convert ASCII DXF text to layered GeoJSON.
///
/// `options_json` example:
/// `{ "sagitta": 0.01, "max_depth": 4, "explode_blocks": true, "closed_polyline_as_polygon": true }`
#[wasm_bindgen]
pub fn dxf_to_gis(dxf_text: &str, options_json: &str) -> Result<JsValue, JsValue> {
    let opt = parse_options(options_json).map_err(|e| JsValue::from_str(&e))?;
    let value = geojson::convert_dxf_to_layers(dxf_text, &opt).map_err(|e| JsValue::from_str(&e))?;
    serde_wasm_bindgen::to_value(&value).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Same as `dxf_to_gis`, but returns a compact JSON string (better for huge drawings).
#[wasm_bindgen]
pub fn dxf_to_gis_json(dxf_text: &str, options_json: &str) -> Result<String, JsValue> {
    let opt = parse_options(options_json).map_err(|e| JsValue::from_str(&e))?;
    let value = geojson::convert_dxf_to_layers(dxf_text, &opt).map_err(|e| JsValue::from_str(&e))?;
    serde_json::to_string(&value).map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Merge the four layers into one FeatureCollection JSON string.
#[wasm_bindgen]
pub fn merge_layers_json(result_json: &str) -> Result<String, JsValue> {
    let v: serde_json::Value =
        serde_json::from_str(result_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let merged = geojson::merge_all(&v);
    serde_json::to_string(&merged).map_err(|e| JsValue::from_str(&e.to_string()))
}

fn parse_options(options_json: &str) -> Result<ConvertOptions, String> {
    let mut opt = ConvertOptions::default();
    if options_json.trim().is_empty() {
        return Ok(opt);
    }
    let v: serde_json::Value =
        serde_json::from_str(options_json).map_err(|e| format!("bad options: {e}"))?;
    if let Some(x) = v.get("sagitta").and_then(|x| x.as_f64()) {
        opt.sagitta = x.max(1e-6);
    }
    if let Some(x) = v.get("max_depth").and_then(|x| x.as_u64()) {
        opt.max_depth = x.min(16) as u32;
    }
    if let Some(x) = v.get("explode_blocks").and_then(|x| x.as_bool()) {
        opt.explode_blocks = x;
    }
    if let Some(x) = v.get("model_space_only").and_then(|x| x.as_bool()) {
        opt.model_space_only = x;
    }
    if let Some(x) = v.get("closed_polyline_as_polygon").and_then(|x| x.as_bool()) {
        opt.closed_polyline_as_polygon = x;
    }
    if let Some(x) = v.get("include_invisible").and_then(|x| x.as_bool()) {
        opt.include_invisible = x;
    }
    Ok(opt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sample_dxf_explodes_block() {
        let dxf = r#"0
SECTION
2
TABLES
0
TABLE
2
LAYER
0
LAYER
2
ROAD
62
1
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
2
TREE
10
0.0
20
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
5.0
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
100.0
20
200.0
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
50.0
21
50.0
0
TEXT
8
ROAD
10
10.0
20
10.0
40
2.5
1
Hello
0
ENDSEC
0
EOF
"#;
        let opt = ConvertOptions::default();
        let v = geojson::convert_dxf_to_layers(dxf, &opt).unwrap();
        let stats = &v["stats"];
        assert!(stats["features_out"].as_u64().unwrap() >= 3);
        assert!(stats["polygons"].as_u64().unwrap() >= 1);
        assert!(stats["lines"].as_u64().unwrap() >= 1);
        assert!(stats["annotations"].as_u64().unwrap() >= 1);
        // BYLAYER color on LINE → red (#ff0000) from layer ROAD aci 1
        let line = &v["layers"]["lines"]["features"][0];
        assert_eq!(line["properties"]["color_hex"], "#ff0000");
    }
}
