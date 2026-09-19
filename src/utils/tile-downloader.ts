/* ============================================================
 * 瓦片下载脚本 · 核心：按范围生成 wget 批量下载脚本
 * 提取自 doSometing/tile-downloader/index.html
 * ============================================================ */

import { lngToTileX, latToTileY, tmsY as tmsFlip } from './tile-tools'
export { lngToTileX, latToTileY, tmsFlip }

export interface TileSource {
  url: string
  ext: string
}

export const SRCS: Record<string, TileSource> = {
  osm: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', ext: 'png' },
  carto: { url: 'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', ext: 'png' },
  arcgis: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', ext: 'png' },
  gaode: { url: 'https://webrd01.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', ext: 'png' },
  tdt: { url: 'https://t1.tianditu.gov.cn/vec_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=YOUR_KEY', ext: 'png' },
}

export const SRC_NAMES: Record<string, string> = {
  osm: 'OpenStreetMap（无密钥）',
  carto: 'CARTO 浅色（无密钥）',
  arcgis: 'ArcGIS 街道（无密钥）',
  gaode: '高德矢量（webrd01）',
  tdt: '天地图矢量（需 tk 密钥）',
}

export interface GenScriptOptions {
  west: number
  south: number
  east: number
  north: number
  zMin: number
  zMax: number
  tms: boolean
  src: string
}

export interface GenScriptResult {
  script: string
  total: number
}

export function genScript(opts: GenScriptOptions): GenScriptResult {
  const src = SRCS[opts.src] || SRCS.osm!
  const zMin = opts.zMin, zMax = opts.zMax
  const lines: string[] = []
  lines.push('#!/bin/bash')
  lines.push('# 瓦片批量下载脚本 · 生成于 ' + new Date().toISOString().slice(0, 10))
  lines.push('# 范围: ' + opts.west + ',' + opts.south + ' → ' + opts.east + ',' + opts.north)
  lines.push('mkdir -p tiles')
  lines.push('UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"')
  lines.push('')
  let total = 0
  for (let z = zMin; z <= zMax; z++) {
    const x0 = lngToTileX(opts.west, z), x1 = lngToTileX(opts.east, z)
    const y0 = latToTileY(opts.north, z), y1 = latToTileY(opts.south, z)
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const ty = opts.tms ? tmsFlip(y, z) : y
        const url = src.url.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(ty))
        lines.push('mkdir -p tiles/' + z + '/' + x)
        lines.push('wget -q -nc -U "$UA" -O tiles/' + z + '/' + x + '/' + y + '.' + src.ext + ' "' + url + '"')
        total++
      }
    }
    lines.push('')
  }
  return { script: lines.join('\n'), total }
}
