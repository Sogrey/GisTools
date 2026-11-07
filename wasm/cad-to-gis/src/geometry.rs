//! Curve tessellation, bulge arcs, simple OCS->WCS, hatch hole parity.

use crate::parser::Entity;

pub type Pt = [f64; 2];
pub type Ring = Vec<Pt>;

pub fn get_f(ent: &Entity, code: i32) -> Option<f64> {
    ent.multi.get(&code).and_then(|v| v.first().copied())
        .or_else(|| ent.vals.get(&code).and_then(|s| s.parse().ok()))
}

pub fn get_multi(ent: &Entity, code: i32) -> Vec<f64> {
    ent.multi.get(&code).cloned().unwrap_or_default()
}

/// Approximate extrusion-based OCS��WCS for Z-aligned and arbitrary extrusion.
pub fn ocs_to_wcs(x: f64, y: f64, z: f64, extrusion: (f64, f64, f64)) -> (f64, f64, f64) {
    let (ex, ey, ez) = extrusion;
    // Arbitrary Axis Algorithm (AutoCAD)
    let (nx, ny, nz) = normalize(ex, ey, ez);
    let (ax, ay, az) = if nx.abs() < 1.0 / 64.0 && ny.abs() < 1.0 / 64.0 {
        cross(0.0, 1.0, 0.0, nx, ny, nz) // Wy �� N
    } else {
        cross(0.0, 0.0, 1.0, nx, ny, nz) // Wz �� N
    };
    let (ax, ay, az) = normalize(ax, ay, az);
    let (ayx, ayy, ayz) = cross(nx, ny, nz, ax, ay, az); // N �� Ax

    (
        ax * x + ayx * y + nx * z,
        ay * x + ayy * y + ny * z,
        az * x + ayz * y + nz * z,
    )
}

fn normalize(x: f64, y: f64, z: f64) -> (f64, f64, f64) {
    let len = (x * x + y * y + z * z).sqrt();
    if len < 1e-12 {
        (0.0, 0.0, 1.0)
    } else {
        (x / len, y / len, z / len)
    }
}

fn cross(ax: f64, ay: f64, az: f64, bx: f64, by: f64, bz: f64) -> (f64, f64, f64) {
    (ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
}

pub fn extrusion_of(ent: &Entity) -> (f64, f64, f64) {
    let x = get_f(ent, 210).unwrap_or(0.0);
    let y = get_f(ent, 220).unwrap_or(0.0);
    let z = get_f(ent, 230).unwrap_or(1.0);
    if x == 0.0 && y == 0.0 && z == 0.0 {
        (0.0, 0.0, 1.0)
    } else {
        (x, y, z)
    }
}

pub fn apply_ocs_pt(ent: &Entity, x: f64, y: f64, z: f64) -> Pt {
    let e = extrusion_of(ent);
    if (e.0 - 0.0).abs() < 1e-9 && (e.1 - 0.0).abs() < 1e-9 && (e.2 - 1.0).abs() < 1e-9 {
        return [x, y];
    }
    let (wx, wy, _) = ocs_to_wcs(x, y, z, e);
    [wx, wy]
}

/// Bulge (code 42) between two vertices �� arc samples (excludes endpoints).
pub fn bulge_arc(p0: Pt, p1: Pt, bulge: f64, sagitta: f64) -> Vec<Pt> {
    if bulge.abs() < 1e-12 {
        return vec![];
    }
    let dx = p1[0] - p0[0];
    let dy = p1[1] - p0[1];
    let chord = (dx * dx + dy * dy).sqrt();
    if chord < 1e-12 {
        return vec![];
    }
    let a = 4.0 * bulge.atan();
    let r = chord / (2.0 * (a / 2.0).sin().abs());
    let mid = [(p0[0] + p1[0]) * 0.5, (p0[1] + p1[1]) * 0.5];
    let px = -dy / chord;
    let py = dx / chord;
    let dist = (r * r - (chord * 0.5).powi(2)).max(0.0).sqrt();
    let side = if bulge > 0.0 { 1.0 } else { -1.0 };
    let flip = if a.abs() > std::f64::consts::PI {
        -1.0
    } else {
        1.0
    };
    let cen = [
        mid[0] + side * flip * px * dist,
        mid[1] + side * flip * py * dist,
    ];
    let start = (p0[1] - cen[1]).atan2(p0[0] - cen[0]);
    let max_dtheta = (2.0 * (1.0 - sagitta / r).clamp(-1.0, 1.0).acos()).max(0.01);
    let segs = ((a.abs() / max_dtheta).ceil() as usize).clamp(3, 256);
    let mut pts = Vec::with_capacity(segs);
    for i in 1..segs {
        let t = i as f64 / segs as f64;
        let ang = start + a * t;
        pts.push([cen[0] + r * ang.cos(), cen[1] + r * ang.sin()]);
    }
    pts
}

pub fn sample_circle(cx: f64, cy: f64, r: f64, sagitta: f64) -> Ring {
    if r <= 0.0 {
        return vec![];
    }
    let max_dtheta = (2.0 * (1.0 - sagitta / r).clamp(-1.0, 1.0).acos()).max(0.01);
    let segs = ((std::f64::consts::TAU / max_dtheta).ceil() as usize).clamp(8, 256);
    let mut pts = Vec::with_capacity(segs + 1);
    for i in 0..=segs {
        let a = std::f64::consts::TAU * (i as f64) / (segs as f64);
        pts.push([cx + r * a.cos(), cy + r * a.sin()]);
    }
    pts
}

pub fn sample_arc(cx: f64, cy: f64, r: f64, start_deg: f64, end_deg: f64, sagitta: f64) -> Vec<Pt> {
    if r <= 0.0 {
        return vec![];
    }
    let sa = start_deg.to_radians();
    let mut ea = end_deg.to_radians();
    if ea < sa {
        ea += std::f64::consts::TAU;
    }
    let sweep = ea - sa;
    let max_dtheta = (2.0 * (1.0 - sagitta / r).clamp(-1.0, 1.0).acos()).max(0.01);
    let segs = ((sweep / max_dtheta).ceil() as usize).clamp(4, 256);
    let mut pts = Vec::with_capacity(segs + 1);
    for i in 0..=segs {
        let a = sa + sweep * (i as f64) / (segs as f64);
        pts.push([cx + r * a.cos(), cy + r * a.sin()]);
    }
    pts
}

pub fn sample_ellipse(
    cx: f64,
    cy: f64,
    mjx: f64,
    mjy: f64,
    ratio: f64,
    start_param: f64,
    end_param: f64,
    sagitta: f64,
) -> Vec<Pt> {
    let major = (mjx * mjx + mjy * mjy).sqrt();
    if major < 1e-12 {
        return vec![];
    }
    let ux = mjx / major;
    let uy = mjy / major;
    let vx = -uy;
    let vy = ux;
    let minor = major * ratio.abs();
    let sa = start_param;
    let mut ea = end_param;
    if (ea - sa).abs() < 1e-9 {
        ea = sa + std::f64::consts::TAU;
    }
    if ea < sa {
        ea += std::f64::consts::TAU;
    }
    let sweep = ea - sa;
    let r_approx = major.max(minor);
    let max_dtheta = (2.0 * (1.0 - sagitta / r_approx).clamp(-1.0, 1.0).acos()).max(0.01);
    let segs = ((sweep / max_dtheta).ceil() as usize).clamp(8, 256);
    let mut pts = Vec::with_capacity(segs + 1);
    for i in 0..=segs {
        let t = sa + sweep * (i as f64) / (segs as f64);
        let x = cx + major * t.cos() * ux + minor * t.sin() * vx;
        let y = cy + major * t.cos() * uy + minor * t.sin() * vy;
        pts.push([x, y]);
    }
    pts
}

/// Quadratic/cubic-ish spline: treat control points as polyline with light Chaikin-ish densify.
pub fn sample_spline_controls(xs: &[f64], ys: &[f64], sagitta: f64) -> Vec<Pt> {
    if xs.len() < 2 || ys.len() < 2 {
        return vec![];
    }
    let n = xs.len().min(ys.len());
    let mut pts: Vec<Pt> = (0..n).map(|i| [xs[i], ys[i]]).collect();
    // Two Chaikin iterations scaled by sagitta coarseness
    let iters = if sagitta > 1.0 { 1 } else { 2 };
    for _ in 0..iters {
        if pts.len() < 2 {
            break;
        }
        let mut next = Vec::with_capacity(pts.len() * 2);
        next.push(pts[0]);
        for w in pts.windows(2) {
            let a = w[0];
            let b = w[1];
            next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
            next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
        }
        next.push(*pts.last().unwrap());
        pts = next;
    }
    pts
}

pub fn lwpolyline_points(ent: &Entity, sagitta: f64) -> (Vec<Pt>, bool) {
    let xs = get_multi(ent, 10);
    let ys = get_multi(ent, 20);
    let bulges = get_multi(ent, 42);
    let flags = get_f(ent, 70).unwrap_or(0.0) as i32;
    let closed = flags & 1 != 0;
    let n = xs.len().min(ys.len());
    if n == 0 {
        return (vec![], closed);
    }
    let mut out = Vec::new();
    for i in 0..n {
        let p = apply_ocs_pt(ent, xs[i], ys[i], 0.0);
        if i > 0 {
            let bulge = bulges.get(i - 1).copied().unwrap_or(0.0);
            if bulge.abs() > 1e-12 {
                let prev = *out.last().unwrap();
                out.extend(bulge_arc(prev, p, bulge, sagitta));
            }
        }
        out.push(p);
    }
    if closed && n >= 2 {
        let bulge = bulges.get(n - 1).copied().unwrap_or(0.0);
        if bulge.abs() > 1e-12 {
            let first = out[0];
            let last = *out.last().unwrap();
            out.extend(bulge_arc(last, first, bulge, sagitta));
        }
        if out.first() != out.last() {
            out.push(out[0]);
        }
    }
    (out, closed)
}

pub fn transform_pt(p: Pt, insert: &InsertXform) -> Pt {
    let (x, y) = (p[0] - insert.base[0], p[1] - insert.base[1]);
    let rad = insert.rot_deg.to_radians();
    let (c, s) = (rad.cos(), rad.sin());
    let xr = x * insert.sx * c - y * insert.sy * s;
    let yr = x * insert.sx * s + y * insert.sy * c;
    [xr + insert.origin[0], yr + insert.origin[1]]
}

#[derive(Debug, Clone)]
pub struct InsertXform {
    pub origin: [f64; 2],
    pub base: [f64; 2],
    pub sx: f64,
    pub sy: f64,
    pub rot_deg: f64,
}

impl Default for InsertXform {
    fn default() -> Self {
        Self {
            origin: [0.0, 0.0],
            base: [0.0, 0.0],
            sx: 1.0,
            sy: 1.0,
            rot_deg: 0.0,
        }
    }
}

pub fn compose_xform(parent: &InsertXform, child: &InsertXform) -> InsertXform {
    // Apply child in parent space
    let o = transform_pt(child.origin, parent);
    let rot = parent.rot_deg + child.rot_deg;
    InsertXform {
        origin: o,
        base: [0.0, 0.0],
        sx: parent.sx * child.sx,
        sy: parent.sy * child.sy,
        rot_deg: rot,
    }
}

/// Even-odd nesting for hatch rings �� polygons with holes.
pub fn rings_to_polygons(mut rings: Vec<Ring>) -> Vec<(Ring, Vec<Ring>)> {
    rings.retain(|r| r.len() >= 3);
    if rings.is_empty() {
        return vec![];
    }
    // Close rings
    for r in &mut rings {
        if r.first() != r.last() {
            let f = r[0];
            r.push(f);
        }
    }
    rings.sort_by(|a, b| {
        ring_area(b)
            .partial_cmp(&ring_area(a))
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let n = rings.len();
    let mut depth = vec![0usize; n];
    for i in 0..n {
        let mut d = 0;
        for j in 0..i {
            if ring_contains(&rings[j], &rings[i]) {
                d += 1;
            }
        }
        depth[i] = d;
    }

    let mut result = Vec::new();
    for i in 0..n {
        if depth[i] % 2 == 1 {
            continue; // hole
        }
        let mut holes = Vec::new();
        for j in (i + 1)..n {
            if depth[j] == depth[i] + 1 && ring_contains(&rings[i], &rings[j]) {
                holes.push(rings[j].clone());
            }
        }
        result.push((rings[i].clone(), holes));
    }
    result
}

fn ring_area(r: &Ring) -> f64 {
    if r.len() < 3 {
        return 0.0;
    }
    let mut a = 0.0;
    for i in 0..r.len() - 1 {
        a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    }
    a.abs() * 0.5
}

fn point_in_ring(pt: Pt, ring: &Ring) -> bool {
    let mut inside = false;
    let n = ring.len();
    if n < 3 {
        return false;
    }
    let mut j = n - 1;
    for i in 0..n {
        let pi = ring[i];
        let pj = ring[j];
        if ((pi[1] > pt[1]) != (pj[1] > pt[1]))
            && (pt[0] < (pj[0] - pi[0]) * (pt[1] - pi[1]) / (pj[1] - pi[1] + 1e-30) + pi[0])
        {
            inside = !inside;
        }
        j = i;
    }
    inside
}

fn ring_contains(outer: &Ring, inner: &Ring) -> bool {
    // representative point: average of first 3 verts
    let m = inner.len().min(3).max(1);
    let mut sx = 0.0;
    let mut sy = 0.0;
    for k in 0..m {
        sx += inner[k][0];
        sy += inner[k][1];
    }
    point_in_ring([sx / m as f64, sy / m as f64], outer)
}
