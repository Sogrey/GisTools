/* ============================================================
 * 属性字段计算器 · 核心算法
 * 提取自 doSometing/field-calculator/index.html
 * ============================================================ */

export type Feature = Record<string, unknown>
export type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] }
export type Properties = Record<string, unknown>

export interface ExprValidation {
  valid: boolean
  error?: string
}

export function validateExpr(expr: string): ExprValidation {
  if (!expr || !expr.trim()) return { valid: false, error: '表达式为空' }
  try {
    // eslint-disable-next-line no-new-func
    new Function('p', 'with(p){ return (' + expr + '); }')
    return { valid: true }
  } catch (e) {
    return { valid: false, error: (e as Error).message }
  }
}

export function calcField(properties: Properties, expr: string): unknown {
  if (!expr || !expr.trim()) throw new Error('表达式为空')
  // eslint-disable-next-line no-new-func
  const fn = new Function('p', 'with(p){ return (' + expr + '); }') as (p: Properties) => unknown
  return fn(properties || {})
}

export interface ApplyResult {
  fc: FeatureCollection
  okCount: number
  errCount: number
  total: number
}

export function applyToAll(fc: FeatureCollection, fieldName: string, expr: string): ApplyResult {
  if (!fieldName || !fieldName.trim()) throw new Error('字段名不能为空')
  const v = validateExpr(expr)
  if (!v.valid) throw new Error('表达式错误: ' + v.error)
  // eslint-disable-next-line no-new-func
  const fn = new Function('p', 'with(p){ return (' + expr + '); }') as (p: Properties) => unknown
  const result = JSON.parse(JSON.stringify(fc)) as FeatureCollection
  const features = result.features || []
  let okCount = 0
  let errCount = 0

  for (const f of features) {
    f.properties = (f.properties as Properties) || {}
    try {
      const val = fn(f.properties as Properties)
      ;(f.properties as Properties)[fieldName] = val
      okCount++
    } catch {
      ;(f.properties as Properties)[fieldName] = null
      errCount++
    }
  }
  return { fc: result, okCount, errCount, total: features.length }
}

export interface PreviewItem {
  index: number
  value: unknown
  error: string | null
}

export function previewValues(fc: FeatureCollection, expr: string, n = 3): PreviewItem[] {
  const v = validateExpr(expr)
  if (!v.valid) throw new Error('表达式错误: ' + v.error)
  // eslint-disable-next-line no-new-func
  const fn = new Function('p', 'with(p){ return (' + expr + '); }') as (p: Properties) => unknown
  const features = (fc && fc.features) || []
  const results: PreviewItem[] = []
  for (let i = 0; i < Math.min(n, features.length); i++) {
    const f = features[i]!
    const props = (f.properties as Properties) || {}
    try {
      const val = fn(props)
      results.push({ index: i, value: val, error: null })
    } catch (e) {
      results.push({ index: i, value: null, error: (e as Error).message })
    }
  }
  return results
}
