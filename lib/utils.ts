export function formatCurrency(amount: number): string {
  return '₩' + amount.toLocaleString('ko-KR')
}

export function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function getMonthLastDay(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

export function getTodayStr(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 현재 연도부터 시작 연도까지 연도 목록 (동적)
export function getYearOptions(startYear = 2022): number[] {
  const currentYear = new Date().getFullYear()
  return Array.from({ length: currentYear - startYear + 1 }, (_, i) => startYear + i)
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

// 차트 Y축용 숫자 포맷 (억/만 단위)
export function formatAuk(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100000000) return `${(value / 100000000).toFixed(1)}억`
  if (abs >= 10000) return `${(value / 10000).toFixed(0)}만`
  return String(value)
}
