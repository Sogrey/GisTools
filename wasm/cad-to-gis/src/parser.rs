//! Minimal ASCII DXF group-code parser: TABLES/LAYER, BLOCKS, ENTITIES.

use std::collections::HashMap;

#[derive(Debug, Clone, Default)]
pub struct LayerStyle {
    pub name: String,
    pub color: i32,
    pub true_color: Option<i32>,
    pub linetype: String,
    pub lineweight: i32,
    pub frozen: bool,
    pub off: bool,
}

#[derive(Debug, Clone, Default)]
pub struct Entity {
    pub kind: String,
    pub layer: String,
    pub color: i32,
    pub true_color: Option<i32>,
    pub linetype: String,
    pub lineweight: i32,
    pub handle: String,
    pub invisible: bool,
    pub vals: HashMap<i32, String>,
    pub multi: HashMap<i32, Vec<f64>>,
    pub attribs: Vec<Entity>,
}

#[derive(Debug, Clone, Default)]
pub struct BlockDef {
    pub name: String,
    pub base: (f64, f64, f64),
    pub entities: Vec<Entity>,
}

#[derive(Debug, Default)]
pub struct DxfDoc {
    pub layers: HashMap<String, LayerStyle>,
    pub blocks: HashMap<String, BlockDef>,
    pub entities: Vec<Entity>,
    pub warnings: Vec<String>,
}

struct PairReader<'a> {
    lines: &'a [&'a str],
    i: usize,
}

impl<'a> PairReader<'a> {
    fn new(lines: &'a [&'a str]) -> Self {
        Self { lines, i: 0 }
    }

    fn next(&mut self) -> Option<(i32, String)> {
        while self.i + 1 < self.lines.len() {
            let code_raw = self.lines[self.i].trim();
            let val_raw = self.lines[self.i + 1];
            self.i += 2;
            if let Ok(code) = code_raw.parse::<i32>() {
                return Some((code, val_raw.trim_end_matches('\r').to_string()));
            }
        }
        None
    }

    fn push_back(&mut self) {
        self.i = self.i.saturating_sub(2);
    }
}

pub fn parse_dxf(text: &str) -> DxfDoc {
    let mut doc = DxfDoc::default();
    doc.layers.insert(
        "0".into(),
        LayerStyle {
            name: "0".into(),
            color: 7,
            linetype: "Continuous".into(),
            lineweight: -3,
            ..Default::default()
        },
    );

    let lines: Vec<&str> = text.lines().collect();
    let mut r = PairReader::new(&lines);
    let mut section = String::new();

    while let Some((code, val)) = r.next() {
        if code == 0 && val == "SECTION" {
            if let Some((c2, name)) = r.next() {
                if c2 == 2 {
                    section = name;
                } else {
                    r.push_back();
                }
            }
            continue;
        }
        if code == 0 && val == "ENDSEC" {
            section.clear();
            continue;
        }
        if code == 0 && val == "EOF" {
            break;
        }

        match section.as_str() {
            "TABLES" => {
                if code == 0 && val == "LAYER" {
                    let layer = parse_layer(&mut r);
                    if !layer.name.is_empty() {
                        doc.layers.insert(layer.name.clone(), layer);
                    }
                }
            }
            "BLOCKS" => {
                if code == 0 && val == "BLOCK" {
                    let block = parse_block(&mut r);
                    if !block.name.is_empty() {
                        doc.blocks.insert(block.name.clone(), block);
                    }
                }
            }
            "ENTITIES" => {
                if code == 0 {
                    if let Some(ent) = parse_entity(&val, &mut r) {
                        doc.entities.push(ent);
                    }
                }
            }
            _ => {}
        }
    }

    doc
}

fn parse_layer(r: &mut PairReader<'_>) -> LayerStyle {
    let mut layer = LayerStyle {
        color: 7,
        linetype: "Continuous".into(),
        lineweight: -3,
        ..Default::default()
    };
    while let Some((code, val)) = r.next() {
        if code == 0 {
            r.push_back();
            break;
        }
        match code {
            2 => layer.name = val,
            62 => {
                let c: i32 = val.parse().unwrap_or(7);
                if c < 0 {
                    layer.off = true;
                    layer.color = c.abs();
                } else {
                    layer.color = c;
                }
            }
            420 => layer.true_color = val.parse().ok(),
            6 => layer.linetype = val,
            370 => layer.lineweight = val.parse().unwrap_or(-3),
            70 => {
                let flags: i32 = val.parse().unwrap_or(0);
                if flags & 1 != 0 {
                    layer.frozen = true;
                }
            }
            _ => {}
        }
    }
    layer
}

fn parse_block(r: &mut PairReader<'_>) -> BlockDef {
    let mut block = BlockDef::default();
    while let Some((code, val)) = r.next() {
        if code == 0 {
            if val == "ENDBLK" {
                // drain ENDBLK fields
                while let Some((c2, _)) = r.next() {
                    if c2 == 0 {
                        r.push_back();
                        break;
                    }
                }
                break;
            }
            if let Some(ent) = parse_entity(&val, r) {
                block.entities.push(ent);
            }
            continue;
        }
        match code {
            2 => {
                if block.name.is_empty() {
                    block.name = val;
                }
            }
            10 => block.base.0 = val.parse().unwrap_or(0.0),
            20 => block.base.1 = val.parse().unwrap_or(0.0),
            30 => block.base.2 = val.parse().unwrap_or(0.0),
            _ => {}
        }
    }
    block
}

fn parse_entity(kind: &str, r: &mut PairReader<'_>) -> Option<Entity> {
    let kind_up = kind.to_uppercase();
    if matches!(
        kind_up.as_str(),
        "ENDBLK" | "ENDSEC" | "EOF" | "SEQEND" | "ENDTAB" | "TABLE"
    ) {
        return None;
    }

    if kind_up == "POLYLINE" {
        return parse_polyline(r);
    }

    let mut ent = Entity {
        kind: kind_up.clone(),
        layer: "0".into(),
        color: 256,
        linetype: "BYLAYER".into(),
        lineweight: -1,
        ..Default::default()
    };

    while let Some((code, val)) = r.next() {
        if code == 0 {
            if kind_up == "INSERT" && val.eq_ignore_ascii_case("ATTRIB") {
                if let Some(attr) = parse_entity("ATTRIB", r) {
                    ent.attribs.push(attr);
                }
                continue;
            }
            if kind_up == "INSERT" && val.eq_ignore_ascii_case("SEQEND") {
                while let Some((c2, _)) = r.next() {
                    if c2 == 0 {
                        r.push_back();
                        break;
                    }
                }
                break;
            }
            r.push_back();
            break;
        }
        apply_common(&mut ent, code, &val);
    }

    Some(ent)
}

fn parse_polyline(r: &mut PairReader<'_>) -> Option<Entity> {
    let mut ent = Entity {
        kind: "POLYLINE".into(),
        layer: "0".into(),
        color: 256,
        linetype: "BYLAYER".into(),
        lineweight: -1,
        ..Default::default()
    };
    let mut xs = Vec::new();
    let mut ys = Vec::new();
    let mut zs = Vec::new();

    while let Some((code, val)) = r.next() {
        if code == 0 {
            if val.eq_ignore_ascii_case("VERTEX") {
                let mut vx = 0.0;
                let mut vy = 0.0;
                let mut vz = 0.0;
                while let Some((c2, v2)) = r.next() {
                    if c2 == 0 {
                        r.push_back();
                        break;
                    }
                    match c2 {
                        10 => vx = v2.parse().unwrap_or(0.0),
                        20 => vy = v2.parse().unwrap_or(0.0),
                        30 => vz = v2.parse().unwrap_or(0.0),
                        _ => {}
                    }
                }
                xs.push(vx);
                ys.push(vy);
                zs.push(vz);
                continue;
            }
            if val.eq_ignore_ascii_case("SEQEND") {
                while let Some((c2, _)) = r.next() {
                    if c2 == 0 {
                        r.push_back();
                        break;
                    }
                }
                break;
            }
            r.push_back();
            break;
        }
        apply_common(&mut ent, code, &val);
    }

    ent.multi.insert(10, xs);
    ent.multi.insert(20, ys);
    ent.multi.insert(30, zs);
    Some(ent)
}

fn apply_common(ent: &mut Entity, code: i32, val: &str) {
    match code {
        8 => ent.layer = val.to_string(),
        62 => ent.color = val.parse().unwrap_or(256),
        420 => ent.true_color = val.parse().ok(),
        6 => ent.linetype = val.to_string(),
        370 => ent.lineweight = val.parse().unwrap_or(-1),
        5 => ent.handle = val.to_string(),
        60 => ent.invisible = val.parse::<i32>().unwrap_or(0) == 1,
        10 | 11 | 12 | 13 | 20 | 21 | 22 | 23 | 30 | 31 | 32 | 33 | 40 | 41 | 42 | 43 | 44
        | 50 | 51 | 70 | 71 | 72 | 73 | 90 | 91 | 92 | 93 => {
            if let Ok(n) = val.parse::<f64>() {
                ent.multi.entry(code).or_default().push(n);
            }
            ent.vals.insert(code, val.to_string());
        }
        _ => {
            ent.vals.insert(code, val.to_string());
        }
    }
}
