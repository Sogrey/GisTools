/* ============================================================
 * 投影带速查 · 核心算法
 * 高斯3°/6°带、UTM 带号与中央经线
 * 提取自 doSometing/band-lookup/index.html
 * ============================================================ */

export function gaussBand3(lng: number): number {
  return Math.floor((lng + 1.5) / 3)
}
export function gaussCM3(band: number): number {
  return band * 3
}
export function gaussBand6(lng: number): number {
  return Math.floor(lng / 6) + 1
}
export function gaussCM6(band: number): number {
  return band * 6 - 3
}
export function utmZone(lng: number): number {
  return Math.floor((lng + 180) / 6) + 1
}
export function utmCM(zone: number): number {
  return -180 + zone * 6 - 3
}

export interface BandQueryResult {
  b3: number
  c3: number
  b6: number
  c6: number
  uz: number
  uc: number
  latBand: string
}

export function query(lng: number, lat: number): BandQueryResult {
  const b3 = gaussBand3(lng), c3 = gaussCM3(b3)
  const b6 = gaussBand6(lng), c6 = gaussCM6(b6)
  const uz = utmZone(lng), uc = utmCM(uz)
  const latBand = lat < 0 ? 'S' : 'N'
  return { b3, c3, b6, c6, uz, uc, latBand }
}

export const PROVINCES: [string, string][] = [
  ['北京', '116.41'], ['天津', '117.20'], ['上海', '121.47'], ['重庆', '106.55'],
  ['河北(石家庄)', '114.51'], ['山西(太原)', '112.55'], ['内蒙古(呼和浩特)', '111.75'],
  ['辽宁(沈阳)', '123.43'], ['吉林(长春)', '125.32'], ['黑龙江(哈尔滨)', '126.63'],
  ['江苏(南京)', '118.80'], ['浙江(杭州)', '120.15'], ['安徽(合肥)', '117.23'],
  ['福建(福州)', '119.30'], ['江西(南昌)', '115.86'], ['山东(济南)', '117.00'],
  ['河南(郑州)', '113.63'], ['湖北(武汉)', '114.30'], ['湖南(长沙)', '112.94'],
  ['广东(广州)', '113.26'], ['广西(南宁)', '108.33'], ['海南(海口)', '110.20'],
  ['四川(成都)', '104.07'], ['贵州(贵阳)', '106.71'], ['云南(昆明)', '102.71'],
  ['西藏(拉萨)', '91.11'], ['陕西(西安)', '108.94'], ['甘肃(兰州)', '103.83'],
  ['青海(西宁)', '101.78'], ['宁夏(银川)', '106.23'], ['新疆(乌鲁木齐)', '87.62'],
  ['香港', '114.17'], ['澳门', '113.55'], ['台湾(台北)', '121.51'],
]

export const CITY_MAP: Record<string, string> = {
  '北京': '116.398', '上海': '121.47', '广州': '113.26', '深圳': '114.1', '成都': '104.07',
  '西安': '108.94', '武汉': '114.3', '哈尔滨': '126.63', '乌鲁木齐': '87.62', '拉萨': '91.11',
}
