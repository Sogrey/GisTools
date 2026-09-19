/* ============================================================
 * 七参数/四参数坐标转换 · 核心算法
 * Bursa-Wolf 七参数、2D 四参数、最小二乘反算
 * 提取自 doSometing/seven-param/index.html
 * ============================================================ */

const A2R = Math.PI / (180 * 3600) // arcsec → rad
const R2A = (180 * 3600) / Math.PI // rad → arcsec
const R2D = 180 / Math.PI // rad → deg
const D2R = Math.PI / 180 // deg → rad

/* ---------- 矩阵运算 ---------- */
function matT(m: number[][]): number[][] {
  return m[0]!.map((_, j) => m.map((r) => r[j]!))
}
function matMul(a: number[][], b: number[][]): number[][] {
  const bt = matT(b)
  return a.map((row) => bt.map((col) => row.reduce((s, v, i) => s + v * col[i]!, 0)))
}
function matVec(m: number[][], v: number[]): number[] {
  return m.map((row) => row.reduce((s, val, i) => s + val * v[i]!, 0))
}
function matInv(m: number[][]): number[][] {
  const n = m.length
  const a = m.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => +(i === j))))
  for (let i = 0; i < n; i++) {
    let mr = i
    for (let k = i + 1; k < n; k++) if (Math.abs(a[k]![i]!) > Math.abs(a[mr]![i]!)) mr = k
    const tmp = a[i]!; a[i] = a[mr]!; a[mr] = tmp
    if (Math.abs(a[i]![i]!) < 1e-15) throw new Error('法方程矩阵奇异，公共点可能共线/共面，无法求解')
    for (let k2 = 0; k2 < n; k2++) {
      if (k2 === i) continue
      const f = a[k2]![i]! / a[i]![i]!
      for (let j = i; j < 2 * n; j++) a[k2]![j]! -= f * a[i]![j]!
    }
    const p = a[i]![i]!
    for (let j = 0; j < 2 * n; j++) a[i]![j]! /= p
  }
  return a.map((r) => r.slice(n))
}

/* ---------- 解析器 ---------- */
function pnums(line: string): number[] {
  return line.split(/[\s,\t;]+/).filter((s) => s.length > 0).map(Number)
}

export function parsePts(text: string, dim: number): number[][] {
  const pts: number[][] = []
  text.trim().split('\n').forEach((line) => {
    line = line.trim()
    if (!line || line.charAt(0) === '#') return
    const p = pnums(line)
    if (p.length >= dim && !p.some(isNaN)) pts.push(p.slice(0, dim))
  })
  return pts
}

export function parseCommon(text: string, dim: number): [number[], number[]][] {
  const pts: [number[], number[]][] = []
  text.trim().split('\n').forEach((line) => {
    line = line.trim()
    if (!line || line.charAt(0) === '#') return
    let s: number[], t: number[]
    const arr = line.split(/→|-->|->/)
    if (arr.length === 2) {
      s = pnums(arr[0]!)
      t = pnums(arr[1]!)
    } else {
      const p = pnums(line)
      s = p.slice(0, dim)
      t = p.slice(dim)
    }
    if (s.length >= dim && t.length >= dim && !s.slice(0, dim).some(isNaN) && !t.slice(0, dim).some(isNaN))
      pts.push([s.slice(0, dim), t.slice(0, dim)])
  })
  return pts
}

/* ---------- 正向转换 ---------- */
export function fwd7(dx: number, dy: number, dz: number, rxs: number, rys: number, rzs: number, ppm: number, pts: number[][]): number[][] {
  const m = ppm / 1e6, f = 1 + m
  const Rx = rxs * A2R, Ry = rys * A2R, Rz = rzs * A2R
  return pts.map((p) => {
    const Xs = p[0]!, Ys = p[1]!, Zs = p[2]!
    return [
      dx + f * (Xs - Rz * Ys + Ry * Zs),
      dy + f * (Rz * Xs + Ys - Rx * Zs),
      dz + f * (-Ry * Xs + Rx * Ys + Zs),
    ]
  })
}

export function fwd4(dx: number, dy: number, rotD: number, k: number, pts: number[][]): number[][] {
  const th = rotD * D2R, c = Math.cos(th), s = Math.sin(th)
  return pts.map((p) => {
    const xs = p[0]!, ys = p[1]!
    return [dx + k * (c * xs - s * ys), dy + k * (s * xs + c * ys)]
  })
}

/* ---------- 反算（最小二乘，重心化） ---------- */
export interface Inv7Result {
  params: { Dx: number; Dy: number; Dz: number; Rx: number; Ry: number; Rz: number; ppm: number }
  n: number
  dof: number
  sigma0: number
  residuals: { idx: number; vx: number; vy: number; vz: number }[]
}

export function inv7(common: [number[], number[]][]): Inv7Result {
  const n = common.length
  if (n < 3) throw new Error('七参数至少需要 3 组公共点（当前 ' + n + ' 组）')
  let xsm = 0, ysm = 0, zsm = 0, xtm = 0, ytm = 0, ztm = 0
  common.forEach((p) => {
    xsm += p[0][0]!; ysm += p[0][1]!; zsm += p[0][2]!
    xtm += p[1][0]!; ytm += p[1][1]!; ztm += p[1][2]!
  })
  xsm /= n; ysm /= n; zsm /= n; xtm /= n; ytm /= n; ztm /= n
  const A: number[][] = []
  const L: number[] = []
  common.forEach((p) => {
    const dxs = p[0][0]! - xsm, dys = p[0][1]! - ysm, dzs = p[0][2]! - zsm
    const dxt = p[1][0]! - xtm, dyt = p[1][1]! - ytm, dzt = p[1][2]! - ztm
    A.push([0, dzs, -dys, dxs])
    A.push([-dzs, 0, dxs, dys])
    A.push([dys, -dxs, 0, dzs])
    L.push(dxt - dxs, dyt - dys, dzt - dzs)
  })
  const At = matT(A)
  const x = matVec(matInv(matMul(At, A)), matVec(At, L))
  const Rx = x[0]!, Ry = x[1]!, Rz = x[2]!, m = x[3]!, f = 1 + m
  const Dx = xtm - f * (xsm - Rz * ysm + Ry * zsm)
  const Dy = ytm - f * (Rz * xsm + ysm - Rx * zsm)
  const Dz = ztm - f * (-Ry * xsm + Rx * ysm + zsm)
  const residuals: { idx: number; vx: number; vy: number; vz: number }[] = []
  let vv = 0
  common.forEach((p, i) => {
    const s = p[0], t = p[1]
    const xc = Dx + f * (s[0]! - Rz * s[1]! + Ry * s[2]!)
    const yc = Dy + f * (Rz * s[0]! + s[1]! - Rx * s[2]!)
    const zc = Dz + f * (-Ry * s[0]! + Rx * s[1]! + s[2]!)
    const vx = t[0]! - xc, vy = t[1]! - yc, vz = t[2]! - zc
    vv += vx * vx + vy * vy + vz * vz
    residuals.push({ idx: i + 1, vx: vx * 1e3, vy: vy * 1e3, vz: vz * 1e3 })
  })
  const dof = 3 * n - 7
  const sigma0 = dof > 0 ? Math.sqrt(vv / dof) : 0
  return { params: { Dx, Dy, Dz, Rx: Rx * R2A, Ry: Ry * R2A, Rz: Rz * R2A, ppm: m * 1e6 }, n, dof, sigma0, residuals }
}

export interface Inv4Result {
  params: { Dx: number; Dy: number; rotation: number; k: number }
  n: number
  dof: number
  sigma0: number
  residuals: { idx: number; vx: number; vy: number }[]
}

export function inv4(common: [number[], number[]][]): Inv4Result {
  const n = common.length
  if (n < 2) throw new Error('四参数至少需要 2 组公共点（当前 ' + n + ' 组）')
  let xsm = 0, ysm = 0, xtm = 0, ytm = 0
  common.forEach((p) => {
    xsm += p[0][0]!; ysm += p[0][1]!; xtm += p[1][0]!; ytm += p[1][1]!
  })
  xsm /= n; ysm /= n; xtm /= n; ytm /= n
  const A: number[][] = []
  const L: number[] = []
  common.forEach((p) => {
    const dxs = p[0][0]! - xsm, dys = p[0][1]! - ysm
    const dxt = p[1][0]! - xtm, dyt = p[1][1]! - ytm
    A.push([dxs, -dys])
    A.push([dys, dxs])
    L.push(dxt, dyt)
  })
  const At = matT(A)
  const x = matVec(matInv(matMul(At, A)), matVec(At, L))
  const a = x[0]!, b = x[1]!
  const k = Math.hypot(a, b)
  const th = Math.atan2(b, a)
  const Dx = xtm - (a * xsm - b * ysm)
  const Dy = ytm - (b * xsm + a * ysm)
  const residuals: { idx: number; vx: number; vy: number }[] = []
  let vv = 0
  common.forEach((p, i) => {
    const s = p[0], t = p[1]
    const xc = Dx + a * s[0]! - b * s[1]!
    const yc = Dy + b * s[0]! + a * s[1]!
    const vx = t[0]! - xc, vy = t[1]! - yc
    vv += vx * vx + vy * vy
    residuals.push({ idx: i + 1, vx: vx * 1e3, vy: vy * 1e3 })
  })
  const dof = 2 * n - 4
  const sigma0 = dof > 0 ? Math.sqrt(vv / dof) : 0
  return { params: { Dx, Dy, rotation: th * R2D, k }, n, dof, sigma0, residuals }
}

/* ---------- 格式化 ---------- */
export function fmt(v: number, d = 6): string {
  return Number.isFinite(v) ? v.toFixed(d) : '—'
}
