/**
 * 한글 가격 문자열을 만원 단위 숫자로 변환
 * "8억 5,000" → 85000
 * "5억" → 50000
 * "50000" → 50000
 */
export function parseKoreanPrice(priceStr: string): number {
  if (!priceStr) return 0

  const cleaned = priceStr.replace(/,/g, '').trim()

  const eokMatch = cleaned.match(/(\d+)\s*억\s*(\d*)/)
  if (eokMatch) {
    const eok = parseInt(eokMatch[1], 10) * 10000
    const remainder = eokMatch[2] ? parseInt(eokMatch[2], 10) : 0
    return eok + remainder
  }

  const numOnly = parseInt(cleaned, 10)
  return isNaN(numOnly) ? 0 : numOnly
}

/**
 * 만원 단위 숫자를 한글 가격 문자열로 변환
 * 85000 → "8억 5,000"
 * 50000 → "5억"
 * 3000 → "3,000"
 */
export function formatKoreanPrice(priceInManwon: number): string {
  if (priceInManwon <= 0) return '0'

  const eok = Math.floor(priceInManwon / 10000)
  const remainder = priceInManwon % 10000

  if (eok > 0 && remainder > 0) {
    return `${eok}억 ${remainder.toLocaleString()}`
  }
  if (eok > 0) {
    return `${eok}억`
  }
  return priceInManwon.toLocaleString()
}

/**
 * 만원 단위 가격을 억 단위 소수점으로 변환
 * 85000 → "8.5억"
 */
export function formatPriceShort(priceInManwon: number): string {
  if (priceInManwon <= 0) return '0'

  if (priceInManwon >= 10000) {
    const eok = priceInManwon / 10000
    return eok % 1 === 0 ? `${eok}억` : `${eok.toFixed(1)}억`
  }
  return `${priceInManwon.toLocaleString()}만`
}
