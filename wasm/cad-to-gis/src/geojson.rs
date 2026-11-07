//! Assemble FeatureCollections + summary JSON.

use crate::extract::{ConvertOptions, ConvertResult};
use crate::parser::parse_dxf;
use serde_json::{json, Value};

pub fn convert_dxf_to_layers(dxf_text: &str, opt: &ConvertOptions) -> Result<Value, String> {
    if dxf_text.trim().is_empty() {
        return Err("empty DXF".into());
    }
    let doc = parse_dxf(dxf_text);
    let result = crate::extract::convert_doc(&doc, opt);
    Ok(layers_json(result, opt))
}

pub fn layers_json(result: ConvertResult, opt: &ConvertOptions) -> Value {
    let fc = |feats: Vec<Value>| {
        json!({
            "type": "FeatureCollection",
            "features": feats
        })
    };

    json!({
        "type": "CadToGisResult",
        "options": {
            "sagitta": opt.sagitta,
            "max_depth": opt.max_depth,
            "explode_blocks": opt.explode_blocks,
            "closed_polyline_as_polygon": opt.closed_polyline_as_polygon
        },
        "stats": result.stats,
        "warnings": result.warnings,
        "layers": {
            "points": fc(result.points),
            "lines": fc(result.lines),
            "polygons": fc(result.polygons),
            "annotations": fc(result.annotations)
        }
    })
}

/// Merge all geometry types into one FeatureCollection (handy for quick preview).
pub fn merge_all(result: &Value) -> Value {
    let mut features = Vec::new();
    if let Some(layers) = result.get("layers") {
        for key in ["points", "lines", "polygons", "annotations"] {
            if let Some(arr) = layers.pointer(&format!("/{key}/features")).and_then(|v| v.as_array())
            {
                features.extend(arr.iter().cloned());
            }
        }
    }
    json!({
        "type": "FeatureCollection",
        "features": features
    })
}
