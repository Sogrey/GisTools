/* ============================================================
 * IFC 元信息解析器 · 核心逻辑
 * STEP 物理文件解析 · IFC 版本 / 文件头 / 实体统计 / 属性集
 * 提取自 doSometing/ifc-info/index.html
 * ============================================================ */

function _stripQuotes(s: string): string {
  s = (s == null ? '' : String(s)).trim()
  if (s.length >= 2 && s.charAt(0) === "'" && s.charAt(s.length - 1) === "'") {
    return s.slice(1, -1).replace(/''/g, "'")
  }
  return s
}

function _splitTopArgs(s: string): string[] {
  const out: string[] = []
  let depth = 0, inStr = false, start = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i)
    if (inStr) {
      if (c === "'") {
        if (s.charAt(i + 1) === "'") { i++ } else { inStr = false }
      }
      continue
    }
    if (c === "'") { inStr = true; continue }
    if (c === '(') { depth++ }
    else if (c === ')') { depth-- }
    else if (c === ',' && depth === 0) { out.push(s.slice(start, i)); start = i + 1 }
  }
  out.push(s.slice(start))
  return out
}

function _tupleItems(s: string): string[] {
  s = (s || '').trim()
  if (s.charAt(0) === '(' && s.charAt(s.length - 1) === ')') {
    return _splitTopArgs(s.slice(1, -1))
      .map(_stripQuotes)
      .filter(x => x !== '' && x !== '$')
  }
  const one = _stripQuotes(s)
  return one && one !== '$' ? [one] : []
}

export interface IfcHeader {
  isStep: boolean
  description: string[]
  descriptionLevel: string
  name: string
  timeStamp: string
  authors: string[]
  organizations: string[]
  preprocessor: string
  originatingSystem: string
  authorization: string
  schema: string
}

export function extractHeader(text: string): IfcHeader {
  const res: IfcHeader = {
    isStep: false, description: [], descriptionLevel: '',
    name: '', timeStamp: '', authors: [], organizations: [],
    preprocessor: '', originatingSystem: '', authorization: '', schema: ''
  }
  if (!text) return res
  if (/ISO-10303-21/i.test(text)) res.isStep = true
  let m: RegExpMatchArray | null
  m = text.match(/\bFILE_DESCRIPTION\s*\(([\s\S]*?)\)\s*;/)
  if (m) {
    const dArgs = _splitTopArgs(m[1]!)
    if (dArgs.length > 0) res.description = _tupleItems(dArgs[0]!)
    if (dArgs.length > 1) res.descriptionLevel = _stripQuotes(dArgs[1]!)
  }
  m = text.match(/\bFILE_NAME\s*\(([\s\S]*?)\)\s*;/)
  if (m) {
    const a = _splitTopArgs(m[1]!)
    if (a.length > 0) res.name = _tupleItems(a[0]!).join(' ')
    if (a.length > 1) res.timeStamp = _stripQuotes(a[1]!)
    if (a.length > 2) res.authors = _tupleItems(a[2]!)
    if (a.length > 3) res.organizations = _tupleItems(a[3]!)
    if (a.length > 4) res.preprocessor = _stripQuotes(a[4]!)
    if (a.length > 5) res.originatingSystem = _stripQuotes(a[5]!)
    if (a.length > 6) res.authorization = _stripQuotes(a[6]!)
  }
  m = text.match(/\bFILE_SCHEMA\s*\(([\s\S]*?)\)\s*;/)
  if (m) {
    const sArgs = _splitTopArgs(m[1]!)
    const items: string[] = []
    for (const s of sArgs) items.push(..._tupleItems(s))
    if (items.length) res.schema = items[0]!.toUpperCase()
  }
  return res
}

export function countEntities(text: string): { total: number; counts: Record<string, number> } {
  const counts: Record<string, number> = {}
  let total = 0
  const re = /#(\d+)\s*=\s*([A-Za-z0-9_]+)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const t = m[2]!.toUpperCase()
    counts[t] = (counts[t] || 0) + 1
    total++
  }
  return { total, counts }
}

const ENTITY_CATEGORIES: [RegExp, string][] = [
  [/^(IFCPROJECT|IFCSITE|IFCBUILDING|IFCBUILDINGSTOREY|IFCSPACE)$/, '空间结构'],
  [/^(IFCWALL|IFCWALLSTANDARDCASE|IFCCURTAINWALL|IFCPLATE)$/, '墙 / 幕墙'],
  [/^(IFCSLAB|IFCROOF|IFCFOOTING|IFCPILE)$/, '板 / 屋面 / 基础'],
  [/^(IFCCOLUMN|IFCBEAM|IFCMEMBER)$/, '柱 / 梁 / 杆件'],
  [/^(IFCDOOR|IFCWINDOW)$/, '门窗'],
  [/^(IFCSTAIR|IFCSTAIRFLIGHT|IFCRAMP|IFCRAMPFLIGHT|IFCRAILING)$/, '楼梯 / 坡道'],
  [/^IFCPROPERTYSET$/, '属性集'],
  [/^IFCPROPERTY/, '属性值'],
  [/^IFCELEMENTQUANTITY|^IFCQUANTITY/, '工程量'],
  [/^IFCMATERIAL/, '材料'],
  [/^IFCUNIT/, '单位'],
  [/^IFCOWNERHISTORY$|^IFCPERSON$|^IFCPERSONANDORGANIZATION$|^IFCORGANIZATION$|^IFCAPPLICATION$|^IFCAPPROVAL/, '责任 / 审批'],
  [/^(IFCEXTRUDEDAREASOLID|IFCREVOLVEDAREASOLID|IFCSWEPTDISKSOLID|IFCFACETEDBREP|IFCPOLYLOOP|IFCFACEOUTERBOUND|IFCFACEBOUND|IFCFACE$|IFCCLOSEDSHELL|IFCOPENSHELL|IFCTRIANGULATEDFACESET|IFCTESSELLATEDFACESET|IFCPOLYGONALFACESET|IFCBOOLEANRESULT|IFCHALFSPACESOLID|IFCBLOCK|IFCRECTANGLEPROFILEDEF|IFCARBITRARYCLOSEDPROFILEDEF|IFCISHAPEPROFILEDEF|IFCCIRCLEPROFILEDEF|IFCCIRCLEHOLLOWPROFILEDEF)$/, '几何表达'],
  [/^IFCAXIS2PLACEMENT|^IFCCARTESIANPOINT$|^IFCDIRECTION$|^IFCGEOMETRICREPRESENTATIONCONTEXT$|^IFCMAPPEDITEM$|^IFCLINE$|^IFCVECTOR$/, '定位 / 上下文'],
  [/^IFCSHAPEREPRESENTATION$|^IFCPRODUCTDEFINITIONSHAPE$|^IFCREPRESENTATIONMAP$|^IFCSTYLEDITEM$|^IFCPRESENTATIONSTYLE|^IFCSURFACESTYLE|^IFCCOLOURRGB|^IFCMATERIALLAYERSET|^IFCMATERIALCONSTITUENTSET/, '形状 / 样式'],
  [/^IFCREL/, '关系'],
  [/^IFC(TYPED|DEFINED)/, '类型定义']
]

export function entityCategory(type: string): string {
  for (const [re, label] of ENTITY_CATEGORIES) {
    if (re.test(type)) return label
  }
  return '其他'
}

export function versionName(schema: string): string {
  if (!schema) return '未知'
  const s = String(schema).toUpperCase()
  if (s === 'IFC4') return 'IFC4'
  if (s === 'IFC2X3') return 'IFC2X3（IFC 2x3）'
  if (/^IFC4X/.test(s)) return s + '（IFC4 扩展）'
  if (/^IFC2X/.test(s)) return s + '（IFC 2x 扩展）'
  return s
}

export interface IfcStats {
  projects: number; sites: number; buildings: number
  storeys: number; spaces: number
  walls: number; slabs: number; columns: number; beams: number
  doors: number; windows: number; stairs: number; roofs: number
  materials: number; propertySets: number; propertyValues: number
  elementQuantities: number; geometry: number; rels: number
}

export interface IfcParseResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  header: IfcHeader
  schema: string
  versionName: string
  totalLines: number
  totalIfc: number
  counts: Record<string, number>
  stats: IfcStats
}

export function parseIfc(text: string): IfcParseResult {
  const out: IfcParseResult = {
    ok: false, errors: [], warnings: [],
    header: {} as IfcHeader, schema: '', versionName: '',
    totalLines: 0, totalIfc: 0, counts: {}, stats: {} as IfcStats
  }
  if (text == null || !String(text).trim()) {
    out.errors.push('输入为空：请粘贴 IFC 文本或选择 .ifc 文件')
    return out
  }
  const t = String(text).replace(/^\uFEFF/, '')
  out.header = extractHeader(t)

  const ec = countEntities(t)
  out.totalLines = ec.total

  const counts: Record<string, number> = {}
  let totalIfc = 0
  for (const k in ec.counts) {
    if (k.indexOf('IFC') === 0) {
      counts[k] = ec.counts[k]!
      totalIfc += ec.counts[k]!
    }
  }
  out.counts = counts
  out.totalIfc = totalIfc

  const c = (n: string) => counts[n] || 0
  let rels = 0, pv = 0, geo = 0
  for (const k in counts) {
    if (/^IFCREL/.test(k)) rels += counts[k]!
    if (/^IFCPROPERTY/.test(k) && k !== 'IFCPROPERTYSET') pv += counts[k]!
    if (entityCategory(k) === '几何表达') geo += counts[k]!
  }

  out.stats = {
    projects: c('IFCPROJECT'), sites: c('IFCSITE'), buildings: c('IFCBUILDING'),
    storeys: c('IFCBUILDINGSTOREY'), spaces: c('IFCSPACE'),
    walls: c('IFCWALL') + c('IFCWALLSTANDARDCASE'), slabs: c('IFCSLAB'),
    columns: c('IFCCOLUMN'), beams: c('IFCBEAM'),
    doors: c('IFCDOOR'), windows: c('IFCWINDOW'),
    stairs: c('IFCSTAIR') + c('IFCSTAIRFLIGHT'), roofs: c('IFCROOF'),
    materials: c('IFCMATERIAL'),
    propertySets: c('IFCPROPERTYSET'),
    propertyValues: pv,
    elementQuantities: c('IFCELEMENTQUANTITY'),
    geometry: geo,
    rels: rels
  }

  out.schema = out.header.schema
  out.versionName = versionName(out.header.schema)

  if (!out.header.isStep) out.errors.push('未发现 ISO-10303-21 文件签名，可能不是标准 IFC/STEP 文件')
  if (!out.header.schema) out.errors.push('未解析到 FILE_SCHEMA，无法识别 IFC 版本')
  if (!/\bDATA\s*;/.test(t)) out.errors.push('未发现 DATA; 数据段，文件可能不完整或被截断')
  if (ec.total === 0) out.warnings.push('未发现任何实体实例（#n=IFCxxx(...)）')

  out.ok = out.errors.length === 0
  return out
}

export const SAMPLE_IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('demo-house.ifc','2026-09-01T10:00:00',('张三'),('某设计院'),'GIS Toolbox IFC Writer 1.0','GIS Toolbox','None');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('0x0ScReJo4RxdPB1X4VkXQ',$,'示范住宅项目',$,$,$,$,#11,$);
#2=IFCSITE('2FnQlvHF9BRuXYc1Xk51kO',$,'场地',$,$,#20,$,$,.ELEMENT.,$,$,$,$);
#3=IFCBUILDING('1rN3W9BP9Ce8uX4VkXQ1rN',$,'住宅楼',$,$,#21,$,$,.ELEMENT.,$,$,$);
#4=IFCBUILDINGSTOREY('3rVFlCFWH2xAW9aXjOnc1P',$,'首层',$,$,#22,$,$,.ELEMENT.,0.);
#5=IFCBUILDINGSTOREY('3rVFlCFWH2xAW9aXjOnc2P',$,'二层',$,$,#23,$,$,.ELEMENT.,3.3);
#6=IFCWALL('1a2b3c4d5e6f7g8h9i0j1k',$,'W-1 外墙',$,$,#30,$,#31,$);
#7=IFCWALLSTANDARDCASE('2b3c4d5e6f7g8h9i0j1k2',$,'W-2 内墙',$,$,#32,$,#33,$);
#8=IFCSLAB('3c4d5e6f7g8h9i0j1k2b3c4',$,'楼板-101',$,$,#34,$,#35,$);
#9=IFCDOOR('4d5e6f7g8h9i0j1k2b3c4d5',$,'M-1',$,$,#36,$,#37,$);
#10=IFCWINDOW('5e6f7g8h9i0j1k2b3c4d5e6f',$,'C-1',$,$,#38,$,#39,$);
#11=IFCEXTRUDEDAREASOLID(#40,#41,#42,3.3);
#12=IFCPROPERTYSET('6f7g8h9i0j1k2b3c4d5e6f7g',$,'Pset_WallCommon',$,(#13,#14));
#13=IFCPROPERTYSINGLEVALUE('IsExternal',$,IFCBOOLEAN(.T.),$);
#14=IFCPROPERTYSINGLEVALUE('LoadBearing',$,IFCBOOLEAN(.F.),$);
#15=IFCELEMENTQUANTITY('7g8h9i0j1k2b3c4d5e6f7g8h',$,'Qto_WallBaseQuantities',$,$,(#16));
#16=IFCQUANTITYLENGTH('Height','',$,$,$,3.3,$);
#17=IFCMATERIAL('混凝土 C30',$,$);
#18=IFCRELAGGREGATES('8h9i0j1k2b3c4d5e6f7g8h',$,$,$,#1,(#2));
ENDSEC;
END-ISO-10303-21;`
