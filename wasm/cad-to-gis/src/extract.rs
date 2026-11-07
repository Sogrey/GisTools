//! Walk entities → resolve style → explode INSERT → emit typed features.

use crate::geometry::{
    apply_ocs_pt, compose_xform, get_f, get_multi, lwpolyline_points, rings_to_polygons,
    sample_arc, sample_circle, sample_ellipse, sample_spline_controls, transform_pt, InsertXform,
    Pt, Ring,
};
use crate::parser::{DxfDoc, Entity};
use crate::style::{resolve_style, ResolvedStyle, StyleCtx};
use serde_json::{json, Map, Value};
use std::collections::HashSet;

#[derive(Debug, Clone)]
pub struct ConvertOptions {
    pub sagitta: f64,
    pub max_depth: u32,
    pub explode_blocks: bool,
    pub model_space_only: bool,
    pub closed_polyline_as_polygon: bool,
    pub include_invisible: bool,
}

impl Default for ConvertOptions {
    fn default() -> Self {
        Self {
            sagitta: 0.01,
            max_depth: 4,
            explode_blocks: true,
            model_space_only: true,
            closed_polyline_as_polygon: true,
            include_invisible: false,
        }
    }
}

#[derive(Debug, Default)]
pub struct ConvertResult {
    pub points: Vec<Value>,
    pub lines: Vec<Value>,
    pub polygons: Vec<Value>,
    pub annotations: Vec<Value>,
    pub stats: ConvertStats,
    pub warnings: Vec<String>,
}

#[derive(Debug, Default, Clone, serde::Serialize)]
pub struct ConvertStats {
    pub entities_in: usize,
    pub features_out: usize,
    pub points: usize,
    pub lines: usize,
    pub polygons: usize,
    pub annotations: usize,
    pub blocks_expanded: usize,
    pub skipped: usize,
}

pub fn convert_doc(doc: &DxfDoc, opt: &ConvertOptions) -> ConvertResult {
    let mut out = ConvertResult {
        warnings: doc.warnings.clone(),
        ..Default::default()
    };
    out.stats.entities_in = doc.entities.len();

    let ctx = StyleCtx::default();
    let xform = InsertXform::default();
    let mut visiting = HashSet::new();

    for ent in &doc.entities {
        extract_entity(ent, &ctx, &xform, 0, doc, opt, &mut visiting, &mut out);
    }

    out.stats.points = out.points.len();
    out.stats.lines = out.lines.len();
    out.stats.polygons = out.polygons.len();
    out.stats.annotations = out.annotations.len();
    out.stats.features_out =
        out.stats.points + out.stats.lines + out.stats.polygons + out.stats.annotations;
    out
}

fn extract_entity(
    ent: &Entity,
    ctx: &StyleCtx,
    xform: &InsertXform,
    depth: u32,
    doc: &DxfDoc,
    opt: &ConvertOptions,
    visiting: &mut HashSet<String>,
    out: &mut ConvertResult,
) {
    let kind = ent.kind.to_uppercase();

    // Skip paper-space viewport entities lightly (no dedicated paper filter beyond INSERT*)
    if matches!(
        kind.as_str(),
        "VIEWPORT" | "3DSOLID" | "REGION" | "BODY" | "SURFACE" | "ACAD_PROXY_ENTITY"
    ) {
        out.stats.skipped += 1;
        return;
    }

    if kind == "INSERT" {
        extract_insert(ent, ctx, xform, depth, doc, opt, visiting, out);
        return;
    }

    let style = resolve_style(ent, ctx, &doc.layers);
    if !style.visible && !opt.include_invisible {
        out.stats.skipped += 1;
        return;
    }

    match kind.as_str() {
        "POINT" => {
            if let (Some(x), Some(y)) = (get_f(ent, 10), get_f(ent, 20)) {
                let z = get_f(ent, 30).unwrap_or(0.0);
                let p = transform_pt(apply_ocs_pt(ent, x, y, z), xform);
                push_point(out, &style, p, None);
            }
        }
        "LINE" => {
            if let (Some(x1), Some(y1), Some(x2), Some(y2)) =
                (get_f(ent, 10), get_f(ent, 20), get_f(ent, 11), get_f(ent, 21))
            {
                let z1 = get_f(ent, 30).unwrap_or(0.0);
                let z2 = get_f(ent, 31).unwrap_or(0.0);
                let a = transform_pt(apply_ocs_pt(ent, x1, y1, z1), xform);
                let b = transform_pt(apply_ocs_pt(ent, x2, y2, z2), xform);
                push_line(out, &style, vec![a, b]);
            }
        }
        "LWPOLYLINE" => {
            let (pts, closed) = lwpolyline_points(ent, opt.sagitta);
            let pts: Vec<Pt> = pts.into_iter().map(|p| transform_pt(p, xform)).collect();
            emit_polyline(out, &style, pts, closed, opt);
        }
        "POLYLINE" => {
            let xs = get_multi(ent, 10);
            let ys = get_multi(ent, 20);
            let n = xs.len().min(ys.len());
            let mut pts = Vec::with_capacity(n);
            for i in 0..n {
                pts.push(transform_pt(apply_ocs_pt(ent, xs[i], ys[i], 0.0), xform));
            }
            let flags = get_f(ent, 70).unwrap_or(0.0) as i32;
            let closed = flags & 1 != 0;
            emit_polyline(out, &style, pts, closed, opt);
        }
        "CIRCLE" => {
            if let (Some(cx), Some(cy), Some(r)) = (get_f(ent, 10), get_f(ent, 20), get_f(ent, 40))
            {
                let ring: Ring = sample_circle(cx, cy, r, opt.sagitta)
                    .into_iter()
                    .map(|p| {
                        let p = apply_ocs_pt(ent, p[0], p[1], 0.0);
                        transform_pt(p, xform)
                    })
                    .collect();
                if ring.len() >= 4 {
                    push_polygon(out, &style, ring, vec![]);
                }
            }
        }
        "ARC" => {
            if let (Some(cx), Some(cy), Some(r), Some(sa), Some(ea)) = (
                get_f(ent, 10),
                get_f(ent, 20),
                get_f(ent, 40),
                get_f(ent, 50),
                get_f(ent, 51),
            ) {
                let pts: Vec<Pt> = sample_arc(cx, cy, r, sa, ea, opt.sagitta)
                    .into_iter()
                    .map(|p| transform_pt(apply_ocs_pt(ent, p[0], p[1], 0.0), xform))
                    .collect();
                if pts.len() >= 2 {
                    push_line(out, &style, pts);
                }
            }
        }
        "ELLIPSE" => {
            if let (Some(cx), Some(cy), Some(mjx), Some(mjy)) =
                (get_f(ent, 10), get_f(ent, 20), get_f(ent, 11), get_f(ent, 21))
            {
                let ratio = get_f(ent, 40).unwrap_or(1.0);
                let start = get_f(ent, 41).unwrap_or(0.0);
                let end = get_f(ent, 42).unwrap_or(std::f64::consts::TAU);
                let pts: Vec<Pt> = sample_ellipse(cx, cy, mjx, mjy, ratio, start, end, opt.sagitta)
                    .into_iter()
                    .map(|p| transform_pt(apply_ocs_pt(ent, p[0], p[1], 0.0), xform))
                    .collect();
                let full = (end - start).abs() >= std::f64::consts::TAU - 1e-6
                    || (end - start).abs() < 1e-9;
                if full && pts.len() >= 4 {
                    let mut ring = pts;
                    if ring.first() != ring.last() {
                        let f = ring[0];
                        ring.push(f);
                    }
                    push_polygon(out, &style, ring, vec![]);
                } else if pts.len() >= 2 {
                    push_line(out, &style, pts);
                }
            }
        }
        "SPLINE" => {
            let xs = get_multi(ent, 10);
            let ys = get_multi(ent, 20);
            // Prefer fit points (11/21) if present
            let (fx, fy) = (get_multi(ent, 11), get_multi(ent, 21));
            let pts = if fx.len() >= 2 && fy.len() >= 2 {
                sample_spline_controls(&fx, &fy, opt.sagitta)
            } else {
                sample_spline_controls(&xs, &ys, opt.sagitta)
            };
            let pts: Vec<Pt> = pts
                .into_iter()
                .map(|p| transform_pt(apply_ocs_pt(ent, p[0], p[1], 0.0), xform))
                .collect();
            if pts.len() >= 2 {
                push_line(out, &style, pts);
            }
        }
        "SOLID" | "TRACE" | "3DFACE" => {
            let mut pts = Vec::new();
            for (cx, cy) in [(10, 20), (11, 21), (12, 22), (13, 23)] {
                if let (Some(x), Some(y)) = (get_f(ent, cx), get_f(ent, cy)) {
                    pts.push(transform_pt(apply_ocs_pt(ent, x, y, 0.0), xform));
                }
            }
            if pts.len() >= 3 {
                if pts.first() != pts.last() {
                    let f = pts[0];
                    pts.push(f);
                }
                push_polygon(out, &style, pts, vec![]);
            }
        }
        "HATCH" => extract_hatch(ent, &style, xform, opt, out),
        "TEXT" | "ATTRIB" | "ATTDEF" => {
            if let (Some(x), Some(y)) = (get_f(ent, 10), get_f(ent, 20)) {
                let p = transform_pt(apply_ocs_pt(ent, x, y, 0.0), xform);
                let text = ent
                    .vals
                    .get(&1)
                    .cloned()
                    .unwrap_or_default();
                let h = get_f(ent, 40).unwrap_or(1.0) * xform.sx.abs();
                let rot = get_f(ent, 50).unwrap_or(0.0) + xform.rot_deg;
                push_annotation(out, &style, p, &text, h, rot);
            }
        }
        "MTEXT" => {
            if let (Some(x), Some(y)) = (get_f(ent, 10), get_f(ent, 20)) {
                let p = transform_pt(apply_ocs_pt(ent, x, y, 0.0), xform);
                let raw = ent.vals.get(&1).cloned().unwrap_or_default();
                let text = strip_mtext_codes(&raw);
                let h = get_f(ent, 40).unwrap_or(1.0) * xform.sx.abs();
                let rot = get_f(ent, 50).unwrap_or(0.0) + xform.rot_deg;
                push_annotation(out, &style, p, &text, h, rot);
            }
        }
        _ => {
            out.stats.skipped += 1;
        }
    }
}

fn extract_insert(
    ent: &Entity,
    ctx: &StyleCtx,
    parent_xf: &InsertXform,
    depth: u32,
    doc: &DxfDoc,
    opt: &ConvertOptions,
    visiting: &mut HashSet<String>,
    out: &mut ConvertResult,
) {
    let name = ent.vals.get(&2).cloned().unwrap_or_default();
    if name.is_empty() {
        out.stats.skipped += 1;
        return;
    }

    // Paper-space anonymous blocks
    if opt.model_space_only && (name.eq_ignore_ascii_case("*Paper_Space") || name.starts_with("*Paper_Space"))
    {
        out.stats.skipped += 1;
        return;
    }

    let style = resolve_style(ent, ctx, &doc.layers);
    let ox = get_f(ent, 10).unwrap_or(0.0);
    let oy = get_f(ent, 20).unwrap_or(0.0);
    let sx = get_f(ent, 41).unwrap_or(1.0);
    let sy = get_f(ent, 42).unwrap_or(sx);
    let rot = get_f(ent, 50).unwrap_or(0.0);

    let block = match doc.blocks.get(&name) {
        Some(b) => b,
        None => {
            out.warnings
                .push(format!("INSERT references missing block '{}'", name));
            out.stats.skipped += 1;
            return;
        }
    };

    let child_xf = InsertXform {
        origin: [ox, oy],
        base: [block.base.0, block.base.1],
        sx,
        sy,
        rot_deg: rot,
    };
    let xform = compose_xform(parent_xf, &child_xf);

    let path = if ctx.block_path.is_empty() {
        name.clone()
    } else {
        format!("{}/{}", ctx.block_path, name)
    };

    if !opt.explode_blocks {
        // Keep insert as a point marker
        let p = transform_pt([ox, oy], parent_xf);
        let mut st = style.clone();
        st.entity_type = "INSERT".into();
        push_point(out, &st, p, Some(json!({ "block": name })));
        return;
    }

    if depth >= opt.max_depth {
        out.warnings
            .push(format!("max block depth at '{}'", path));
        out.stats.skipped += 1;
        return;
    }
    if visiting.contains(&name) {
        out.warnings
            .push(format!("cyclic block reference '{}'", name));
        out.stats.skipped += 1;
        return;
    }

    visiting.insert(name.clone());
    out.stats.blocks_expanded += 1;

    let child_ctx = StyleCtx {
        layer: style.cad_layer.clone(),
        color_hex: style.color_hex.clone(),
        color_aci: style.color_aci,
        linetype: style.linetype.clone(),
        line_mm: style.line_mm,
        block_path: path,
    };

    for attr in &ent.attribs {
        extract_entity(attr, &child_ctx, &xform, depth + 1, doc, opt, visiting, out);
    }
    for sub in &block.entities {
        extract_entity(sub, &child_ctx, &xform, depth + 1, doc, opt, visiting, out);
    }

    visiting.remove(&name);
}

fn extract_hatch(
    ent: &Entity,
    style: &ResolvedStyle,
    xform: &InsertXform,
    opt: &ConvertOptions,
    out: &mut ConvertResult,
) {
    // Lightweight HATCH: collect boundary polyline vertices from codes 10/20 after path count.
    // Full HATCH is complex; we gather sequential 10/20 pairs as rings split by path bits.
    let xs = get_multi(ent, 10);
    let ys = get_multi(ent, 20);
    let n = xs.len().min(ys.len());
    if n < 3 {
        out.stats.skipped += 1;
        return;
    }

    // Split into rings using elevation of edge type (72) counts if available — fallback: one ring
    let mut rings: Vec<Ring> = Vec::new();
    let edge_counts: Vec<i32> = get_multi(ent, 93)
        .into_iter()
        .map(|v| v as i32)
        .collect();

    if !edge_counts.is_empty() {
        // Skip pattern seed points sometimes stored as 10/20 — use last N vertices.
        let total_edges: usize = edge_counts.iter().map(|&c| c.max(0) as usize).sum();
        let mut idx = n.saturating_sub(total_edges);
        for &ec in &edge_counts {
            let ec = ec.max(0) as usize;
            if idx + ec > n {
                break;
            }
            let mut ring = Vec::with_capacity(ec + 1);
            for _ in 0..ec {
                ring.push(transform_pt(
                    apply_ocs_pt(ent, xs[idx], ys[idx], 0.0),
                    xform,
                ));
                idx += 1;
            }
            if ring.len() >= 3 {
                rings.push(ring);
            }
        }
    }

    if rings.is_empty() {
        let mut ring = Vec::with_capacity(n);
        for i in 0..n {
            ring.push(transform_pt(apply_ocs_pt(ent, xs[i], ys[i], 0.0), xform));
        }
        rings.push(ring);
    }

    // Densify bulges not available in this simplified hatch path
    let _ = opt;
    for (outer, holes) in rings_to_polygons(rings) {
        push_polygon(out, style, outer, holes);
    }
}

fn emit_polyline(
    out: &mut ConvertResult,
    style: &ResolvedStyle,
    mut pts: Vec<Pt>,
    closed: bool,
    opt: &ConvertOptions,
) {
    if pts.len() < 2 {
        return;
    }
    if closed && opt.closed_polyline_as_polygon && pts.len() >= 3 {
        if pts.first() != pts.last() {
            let f = pts[0];
            pts.push(f);
        }
        push_polygon(out, style, pts, vec![]);
    } else {
        if closed && pts.first() != pts.last() {
            let f = pts[0];
            pts.push(f);
        }
        push_line(out, style, pts);
    }
}

fn props(style: &ResolvedStyle) -> Map<String, Value> {
    let mut m = Map::new();
    m.insert("cad_layer".into(), json!(style.cad_layer));
    m.insert("entity_type".into(), json!(style.entity_type));
    m.insert("color_hex".into(), json!(style.color_hex));
    m.insert("color_aci".into(), json!(style.color_aci));
    m.insert("linetype".into(), json!(style.linetype));
    m.insert("line_mm".into(), json!(style.line_mm));
    m.insert("opacity".into(), json!(style.opacity));
    m.insert("handle".into(), json!(style.handle));
    m.insert("block_path".into(), json!(style.block_path));
    m
}

fn feature(geom: Value, style: &ResolvedStyle, extra: Option<Value>) -> Value {
    let mut p = props(style);
    if let Some(Value::Object(map)) = extra {
        for (k, v) in map {
            p.insert(k, v);
        }
    }
    json!({
        "type": "Feature",
        "geometry": geom,
        "properties": p
    })
}

fn push_point(out: &mut ConvertResult, style: &ResolvedStyle, p: Pt, extra: Option<Value>) {
    out.points.push(feature(
        json!({ "type": "Point", "coordinates": [p[0], p[1]] }),
        style,
        extra,
    ));
}

fn push_line(out: &mut ConvertResult, style: &ResolvedStyle, pts: Vec<Pt>) {
    let coords: Vec<Value> = pts.iter().map(|p| json!([p[0], p[1]])).collect();
    out.lines.push(feature(
        json!({ "type": "LineString", "coordinates": coords }),
        style,
        None,
    ));
}

fn push_polygon(out: &mut ConvertResult, style: &ResolvedStyle, outer: Ring, holes: Vec<Ring>) {
    let mut rings = Vec::new();
    let o: Vec<Value> = outer.iter().map(|p| json!([p[0], p[1]])).collect();
    if o.len() >= 3 {
        rings.push(Value::Array(o));
    } else {
        return;
    }
    for h in holes {
        let arr: Vec<Value> = h.iter().map(|p| json!([p[0], p[1]])).collect();
        if arr.len() >= 4 {
            rings.push(Value::Array(arr));
        }
    }
    out.polygons.push(feature(
        json!({ "type": "Polygon", "coordinates": rings }),
        style,
        None,
    ));
}

fn push_annotation(
    out: &mut ConvertResult,
    style: &ResolvedStyle,
    p: Pt,
    text: &str,
    height: f64,
    rot: f64,
) {
    out.annotations.push(feature(
        json!({ "type": "Point", "coordinates": [p[0], p[1]] }),
        style,
        Some(json!({
            "text": text,
            "text_h": height,
            "text_rot": rot
        })),
    ));
}

fn strip_mtext_codes(s: &str) -> String {
    // Remove simple {\f...;} and formatting escapes
    let mut out = String::with_capacity(s.len());
    let chars: Vec<char> = s.chars().collect();
    let mut i = 0;
    while i < chars.len() {
        if chars[i] == '\\' && i + 1 < chars.len() {
            let n = chars[i + 1];
            if matches!(n, 'P' | 'p') {
                out.push('\n');
                i += 2;
                continue;
            }
            // skip \X...; groups
            i += 2;
            while i < chars.len() && chars[i] != ';' && chars[i] != '\\' {
                i += 1;
            }
            if i < chars.len() && chars[i] == ';' {
                i += 1;
            }
            continue;
        }
        if chars[i] == '{' || chars[i] == '}' {
            i += 1;
            continue;
        }
        out.push(chars[i]);
        i += 1;
    }
    out
}
