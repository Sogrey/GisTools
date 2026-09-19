/* ============================================================
 * Cesium 相机参数计算器 · 核心算法
 * 经纬度→ECEF · 相机位置计算 · setView/lookAt 代码生成
 * 提取自 doSometing/cesium-camera/index.html
 * ============================================================ */

const PI = Math.PI
const A = 6378137.0
const F = 1 / 298.257223563
const E2 = F * (2 - F)

export type Vec3 = [number, number, number]

function toRad(d: number): number {
  return d * PI / 180
}

/** 经纬度+高度 → ECEF（WGS84 椭球） */
export function lngLatToEcef(lng: number, lat: number, h: number): Vec3 {
  const b = toRad(lat)
  const l = toRad(lng)
  const sinB = Math.sin(b)
  const cosB = Math.cos(b)
  const N = A / Math.sqrt(1 - E2 * sinB * sinB)
  return [
    (N + h) * cosB * Math.cos(l),
    (N + h) * cosB * Math.sin(l),
    (N * (1 - E2) + h) * sinB
  ]
}

function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2])
  return [v[0] / len, v[1] / len, v[2] / len]
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ]
}

/** 相机位置：目标点 + 距离/方位角/俯仰 → ECEF */
export function cameraPosition(lng: number, lat: number, h: number, dist: number, azimuth: number, pitch: number): Vec3 {
  const tgt = lngLatToEcef(lng, lat, h)
  const up = normalize([tgt[0], tgt[1], tgt[2]])
  const east = normalize([-Math.sin(toRad(lng)), Math.cos(toRad(lng)), 0])
  const north = normalize(cross(up, east))
  const azR = toRad(azimuth)
  const pitR = toRad(pitch)
  const dx = dist * Math.cos(pitR) * Math.sin(azR)
  const dy = dist * Math.cos(pitR) * Math.cos(azR)
  const dz = dist * Math.sin(pitR)
  const offset: Vec3 = [
    east[0] * dx + north[0] * dy + up[0] * dz,
    east[1] * dx + north[1] * dy + up[1] * dz,
    east[2] * dx + north[2] * dy + up[2] * dz
  ]
  return [tgt[0] + offset[0], tgt[1] + offset[1], tgt[2] + offset[2]]
}

/** 相机到目标的地平线距离 */
export function lookAtRange(cam: Vec3, tgt: Vec3): number {
  const dx = cam[0] - tgt[0]
  const dy = cam[1] - tgt[1]
  const dz = cam[2] - tgt[2]
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export interface CameraResult {
  cam: Vec3
  tgt: Vec3
  heading: number
  pitch: number
  roll: number
}

export function calcCamera(lng: number, lat: number, h: number, dist: number, az: number, pitch: number): CameraResult {
  const cam = cameraPosition(lng, lat, h, dist, az, pitch)
  const tgt = lngLatToEcef(lng, lat, h)
  return { cam, tgt, heading: az, pitch, roll: 0 }
}

export function genSetViewCode(lng: number, lat: number, h: number, dist: number, az: number, pitch: number): string {
  const r = calcCamera(lng, lat, h, dist, az, pitch)
  const f = (v: number) => v.toFixed(4)
  return `// Cesium 相机飞到目标
var target = Cesium.Cartesian3.fromDegrees(${lng}, ${lat}, ${h});
viewer.camera.setView({
  destination: new Cesium.Cartesian3(${f(r.cam[0])}, ${f(r.cam[1])}, ${f(r.cam[2])}),
  orientation: {
    heading: Cesium.Math.toRadians(${az}),
    pitch: Cesium.Math.toRadians(${pitch}),
    roll: Cesium.Math.toRadians(0)
  }
});

// 或 lookAt
viewer.camera.lookAt(target, new Cesium.HeadingPitchRange(
  Cesium.Math.toRadians(${az}),
  Cesium.Math.toRadians(${pitch}),
  ${dist}
));`
}
