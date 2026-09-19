/* ============================================================
 * Base64 编解码工具 · 核心逻辑
 * Base64 ↔ 文本 / 文件 · Data URL 识别
 * 提取自 doSometing/base64-tool/index.html
 * ============================================================ */

export interface ParsedDataUrl {
  mime: string
  isDataUrl: boolean
  data: string
}

export function parseDataUrl(str: string): ParsedDataUrl {
  str = str.trim()
  const m = str.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (m) {
    return { mime: m[1] || 'application/octet-stream', isDataUrl: true, data: m[3]! }
  }
  return { mime: '', isDataUrl: false, data: str }
}

const MIME_EXT_MAP: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg',
  'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-icon': 'ico',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/html': 'html',
  'application/json': 'json', 'application/zip': 'zip', 'application/gzip': 'gz',
  'application/x-tar': 'tar', 'audio/mpeg': 'mp3', 'audio/wav': 'wav',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'application/octet-stream': 'bin'
}

export function mimeToExt(mime: string): string {
  if (MIME_EXT_MAP[mime]) return MIME_EXT_MAP[mime]
  const slash = mime.indexOf('/')
  return slash >= 0 ? mime.slice(slash + 1) : 'bin'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

export function base64ToText(base64: string): string {
  const clean = base64.replace(/\s/g, '')
  const binaryStr = atob(clean)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const clean = base64.replace(/\s/g, '')
  const binaryStr = atob(clean)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i)
  return bytes
}

export function textToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binaryStr = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binaryStr += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)))
  }
  return btoa(binaryStr)
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
