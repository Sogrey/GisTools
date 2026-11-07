//! Resolve BYLAYER / BYBLOCK color, linetype, lineweight to concrete values.

use crate::aci::{aci_to_rgb, rgb_to_hex, true_color_to_hex};
use crate::parser::{Entity, LayerStyle};
use std::collections::HashMap;

pub const COLOR_BYBLOCK: i32 = 0;
pub const COLOR_BYLAYER: i32 = 256;

#[derive(Debug, Clone)]
pub struct StyleCtx {
    pub layer: String,
    pub color_hex: String,
    pub color_aci: i32,
    pub linetype: String,
    pub line_mm: f64,
    pub block_path: String,
}

impl Default for StyleCtx {
    fn default() -> Self {
        Self {
            layer: "0".into(),
            color_hex: "#000000".into(),
            color_aci: 7,
            linetype: "Continuous".into(),
            line_mm: 0.25,
            block_path: String::new(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResolvedStyle {
    pub cad_layer: String,
    pub color_hex: String,
    pub color_aci: i32,
    pub linetype: String,
    pub line_mm: f64,
    pub opacity: f64,
    pub visible: bool,
    pub handle: String,
    pub block_path: String,
    pub entity_type: String,
}

fn layer_color_hex(ls: &LayerStyle) -> (String, i32) {
    if let Some(tc) = ls.true_color {
        return (true_color_to_hex(tc), ls.color);
    }
    let aci = if ls.color == 0 { 7 } else { ls.color };
    let (r, g, b) = aci_to_rgb(aci);
    (rgb_to_hex(r, g, b), aci)
}

fn lineweight_mm(lw: i32) -> f64 {
    if lw < 0 {
        0.25
    } else {
        lw as f64 / 100.0
    }
}

pub fn resolve_style(
    entity: &Entity,
    ctx: &StyleCtx,
    layers: &HashMap<String, LayerStyle>,
) -> ResolvedStyle {
    let mut layer_name = entity.layer.clone();
    // Entities on layer "0" inside a block inherit the INSERT's display layer
    if layer_name == "0" && !ctx.block_path.is_empty() {
        layer_name = ctx.layer.clone();
    }

    let lstyle = layers.get(&layer_name).cloned().unwrap_or_else(|| LayerStyle {
        name: layer_name.clone(),
        color: 7,
        linetype: "Continuous".into(),
        lineweight: -3,
        ..Default::default()
    });

    let (layer_hex, layer_aci) = layer_color_hex(&lstyle);

    let (color_hex, color_aci) = if let Some(tc) = entity.true_color {
        (true_color_to_hex(tc), entity.color)
    } else if entity.color == COLOR_BYLAYER {
        (layer_hex.clone(), layer_aci)
    } else if entity.color == COLOR_BYBLOCK {
        if ctx.block_path.is_empty() {
            (layer_hex.clone(), layer_aci)
        } else {
            (ctx.color_hex.clone(), ctx.color_aci)
        }
    } else {
        let aci = entity.color.abs();
        let (r, g, b) = aci_to_rgb(aci);
        (rgb_to_hex(r, g, b), aci)
    };

    let linetype = if entity.linetype.eq_ignore_ascii_case("BYLAYER") {
        lstyle.linetype.clone()
    } else if entity.linetype.eq_ignore_ascii_case("BYBLOCK") {
        if ctx.block_path.is_empty() {
            lstyle.linetype.clone()
        } else {
            ctx.linetype.clone()
        }
    } else {
        entity.linetype.clone()
    };

    let line_mm = match entity.lineweight {
        -1 => {
            if lstyle.lineweight == -3 {
                0.25
            } else {
                lineweight_mm(lstyle.lineweight)
            }
        }
        -2 => {
            if ctx.block_path.is_empty() {
                0.25
            } else {
                ctx.line_mm
            }
        }
        -3 => 0.25,
        w => lineweight_mm(w),
    };

    let visible = !entity.invisible && !lstyle.off && !lstyle.frozen;

    ResolvedStyle {
        cad_layer: layer_name,
        color_hex,
        color_aci,
        linetype,
        line_mm,
        opacity: if visible { 1.0 } else { 0.0 },
        visible,
        handle: entity.handle.clone(),
        block_path: ctx.block_path.clone(),
        entity_type: entity.kind.clone(),
    }
}
