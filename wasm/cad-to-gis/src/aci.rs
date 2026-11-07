//! AutoCAD Color Index (ACI 1..=255) → RGB. ACI 7 is black for light GIS basemaps.

pub fn aci_to_rgb(aci: i32) -> (u8, u8, u8) {
    match aci {
        1 => (255, 0, 0),
        2 => (255, 255, 0),
        3 => (0, 255, 0),
        4 => (0, 255, 255),
        5 => (0, 0, 255),
        6 => (255, 0, 255),
        7 => (0, 0, 0),
        8 => (128, 128, 128),
        9 => (192, 192, 192),
        n if (10..=249).contains(&n) => {
            // Standard ACI hue/value table (approximate, good enough for GIS symbology)
            let idx = (n - 10) as usize;
            let hue = (idx % 10) as f64 / 10.0;
            let value_band = idx / 10;
            let value = match value_band {
                0 => 1.0,
                1 => 0.8,
                2 => 0.6,
                3 => 0.5,
                4 => 0.35,
                5..=9 => 0.25 + (9 - value_band) as f64 * 0.05,
                10..=14 => 0.75 - (value_band - 10) as f64 * 0.1,
                15..=19 => 0.5 - (value_band - 15) as f64 * 0.05,
                20..=23 => 0.9 - (value_band - 20) as f64 * 0.15,
                _ => 0.5,
            };
            let sat = if value_band >= 20 { 0.15 } else { 1.0 };
            hsv_to_rgb(hue * 360.0, sat, value.clamp(0.15, 1.0))
        }
        250 => (0, 0, 0),
        251 => (43, 43, 43),
        252 => (85, 85, 85),
        253 => (128, 128, 128),
        254 => (170, 170, 170),
        255 => (255, 255, 255),
        _ => (128, 128, 128),
    }
}

pub fn rgb_to_hex(r: u8, g: u8, b: u8) -> String {
    format!("#{r:02x}{g:02x}{b:02x}")
}

pub fn true_color_to_hex(tc: i32) -> String {
    let r = ((tc >> 16) & 0xff) as u8;
    let g = ((tc >> 8) & 0xff) as u8;
    let b = (tc & 0xff) as u8;
    rgb_to_hex(r, g, b)
}

fn hsv_to_rgb(h: f64, s: f64, v: f64) -> (u8, u8, u8) {
    let c = v * s;
    let x = c * (1.0 - ((h / 60.0) % 2.0 - 1.0).abs());
    let m = v - c;
    let (r1, g1, b1) = match h as i32 {
        0..=59 => (c, x, 0.0),
        60..=119 => (x, c, 0.0),
        120..=179 => (0.0, c, x),
        180..=239 => (0.0, x, c),
        240..=299 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    (
        ((r1 + m) * 255.0).round() as u8,
        ((g1 + m) * 255.0).round() as u8,
        ((b1 + m) * 255.0).round() as u8,
    )
}
