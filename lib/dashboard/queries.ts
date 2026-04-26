import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Supabase max-rows 프로젝트 설정(기본 1000)을 우회하는 페이지네이션 전체 조회
async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyFilters: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000
  const result: T[] = []
  let from = 0

  while (true) {
    const baseQuery = supabase.from(table).select(columns)
    const { data, error } = await applyFilters(baseQuery).range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    result.push(...data)
    if (data.length < PAGE) break
    from += PAGE
  }

  return result
}

// ─── KPI ─────────────────────────────────────────────────────────────────────
export async function getKpi(from?: string, to?: string) {
  const supabase = await createClient()

  const [tx, div] = await Promise.all([
    fetchAll<{ class_type: string; amount: number }>(supabase, 'transactions', 'class_type, amount', q => {
      let r = q.is('deleted_at', null).neq('class_type', '이체')
      if (from) r = r.gte('date', `${from}-01`)
      if (to) { const [y, m] = to.split('-').map(Number); r = r.lte('date', `${to}-${new Date(y, m, 0).getDate()}`) }
      return r
    }),
    fetchAll<{ krw_amount: number }>(supabase, 'dividend', 'krw_amount', q => {
      let r = q
      if (from) r = r.gte('date', `${from}-01`)
      if (to) { const [y, m] = to.split('-').map(Number); r = r.lte('date', `${to}-${new Date(y, m, 0).getDate()}`) }
      return r
    }),
  ])

  const income = tx.filter(t => t.class_type === '수입').reduce((s, t) => s + t.amount, 0)
  const expense = tx.filter(t => t.class_type === '지출').reduce((s, t) => s + t.amount, 0)
  return {
    income, expense,
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 10000) / 100 : 0,
    totalDividend: div.reduce((s, d) => s + d.krw_amount, 0),
  }
}

// ─── 월별 수입/지출 ───────────────────────────────────────────────────────────
export async function getMonthlySummary(from?: string, to?: string) {
  const supabase = await createClient()
  const data = await fetchAll<{ date: string; class_type: string; amount: number }>(
    supabase, 'transactions', 'date, class_type, amount', q => {
      let r = q.is('deleted_at', null).neq('class_type', '이체').order('date')
      if (from) r = r.gte('date', `${from}-01`)
      if (to) { const [y, m] = to.split('-').map(Number); r = r.lte('date', `${to}-${new Date(y, m, 0).getDate()}`) }
      return r
    }
  )

  const map = new Map<string, { income: number; expense: number }>()
  for (const t of data) {
    const month = t.date.slice(0, 7)
    const cur = map.get(month) ?? { income: 0, expense: 0 }
    if (t.class_type === '수입') cur.income += t.amount; else cur.expense += t.amount
    map.set(month, cur)
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income, expense }]) => ({ month, income, expense, savings: income - expense }))
}

// ─── 지출 카테고리 ────────────────────────────────────────────────────────────
export async function getCategoryBreakdown(from?: string, to?: string) {
  const supabase = await createClient()
  const data = await fetchAll<{ category: string; subcategory: string | null; amount: number }>(
    supabase, 'transactions', 'category, subcategory, amount', q => {
      let r = q.is('deleted_at', null).eq('class_type', '지출')
      if (from) r = r.gte('date', `${from}-01`)
      if (to) { const [y, m] = to.split('-').map(Number); r = r.lte('date', `${to}-${new Date(y, m, 0).getDate()}`) }
      return r
    }
  )

  const total = data.reduce((s, t) => s + t.amount, 0)
  const catMap = new Map<string, { amount: number; subMap: Map<string, number> }>()
  for (const t of data) {
    const cat = catMap.get(t.category) ?? { amount: 0, subMap: new Map() }
    cat.amount += t.amount
    const sub = t.subcategory ?? '기타'
    cat.subMap.set(sub, (cat.subMap.get(sub) ?? 0) + t.amount)
    catMap.set(t.category, cat)
  }
  return Array.from(catMap.entries())
    .map(([category, { amount, subMap }]) => ({
      category, amount,
      ratio: total > 0 ? Math.round((amount / total) * 1000) / 1000 : 0,
      subcategories: Array.from(subMap.entries()).map(([name, amt]) => ({ name, amount: amt })).sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.amount - a.amount)
}

// ─── 순자산 히스토리 ──────────────────────────────────────────────────────────
export async function getNetworthHistory() {
  const supabase = await createClient()
  const data = await fetchAll<{ snapshot_date: string; asset_type: string; balance: number }>(
    supabase, 'assets', 'snapshot_date, asset_type, balance', q => q.order('snapshot_date')
  )

  const dateMap = new Map<string, { realestate: number; stocks: number; pension: number; savings: number; others: number; loans: number }>()
  for (const a of data) {
    const cur = dateMap.get(a.snapshot_date) ?? { realestate: 0, stocks: 0, pension: 0, savings: 0, others: 0, loans: 0 }
    if (a.asset_type === '부동산') cur.realestate += a.balance
    else if (a.asset_type === '통장') cur.stocks += a.balance
    else if (a.asset_type === '연금') cur.pension += a.balance
    else if (a.asset_type === '예적금') cur.savings += a.balance
    else if (a.asset_type === '대출') cur.loans += a.balance
    else cur.others += a.balance
    dateMap.set(a.snapshot_date, cur)
  }
  return Array.from(dateMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v, netWorth: v.realestate + v.stocks + v.pension + v.savings + v.others + v.loans }))
}

// ─── 저축률 추이 ──────────────────────────────────────────────────────────────
export async function getSavingsRate(from?: string, to?: string) {
  const monthly = await getMonthlySummary(from, to)
  return monthly.map(({ month, income, expense }) => ({
    month, income, expense,
    savingsRate: income > 0 ? Math.round(((income - expense) / income) * 10000) / 100 : 0,
  }))
}

// ─── 연도별 기여도 ────────────────────────────────────────────────────────────
export async function getYearlyContribution() {
  const supabase = await createClient()
  const [tx, assets] = await Promise.all([
    fetchAll<{ date: string; class_type: string; amount: number }>(
      supabase, 'transactions', 'date, class_type, amount',
      q => q.is('deleted_at', null).neq('class_type', '이체')
    ),
    fetchAll<{ snapshot_date: string; balance: number }>(
      supabase, 'assets', 'snapshot_date, balance', q => q.order('snapshot_date')
    ),
  ])

  const savingsByYear = new Map<number, { income: number; expense: number }>()
  for (const t of tx) {
    const year = Number(t.date.slice(0, 4))
    const cur = savingsByYear.get(year) ?? { income: 0, expense: 0 }
    if (t.class_type === '수입') cur.income += t.amount; else cur.expense += t.amount
    savingsByYear.set(year, cur)
  }

  const dateNw = new Map<string, number>()
  for (const a of assets) dateNw.set(a.snapshot_date, (dateNw.get(a.snapshot_date) ?? 0) + a.balance)

  const latestByYear = new Map<number, { date: string; networth: number }>()
  for (const [d, nw] of dateNw.entries()) {
    const year = Number(d.slice(0, 4))
    const cur = latestByYear.get(year)
    if (!cur || d > cur.date) latestByYear.set(year, { date: d, networth: nw })
  }

  const years = Array.from(new Set([...savingsByYear.keys(), ...latestByYear.keys()])).sort()
  return years.map((year, i) => {
    const nw = latestByYear.get(year)?.networth ?? 0
    const prevNw = i > 0 ? (latestByYear.get(years[i - 1])?.networth ?? 0) : 0
    const totalChange = nw - prevNw
    const { income = 0, expense = 0 } = savingsByYear.get(year) ?? {}
    const pureSavings = income - expense
    return {
      year: `${year}년`, endNetWorth: nw,
      growthRate: prevNw > 0 ? Math.round((totalChange / prevNw) * 10000) / 100 : 0,
      totalChange, pureSavings, investmentGain: totalChange - pureSavings,
    }
  })
}

// ─── 배당금 요약 ──────────────────────────────────────────────────────────────
export async function getDividendSummary() {
  const supabase = await createClient()
  const data = await fetchAll<{ date: string; krw_amount: number }>(
    supabase, 'dividend', 'date, krw_amount', q => q.order('date')
  )

  const yearMap = new Map<number, number>()
  const pivotMap = new Map<string, number>()
  for (const d of data) {
    const year = Number(d.date.slice(0, 4))
    yearMap.set(year, (yearMap.get(year) ?? 0) + d.krw_amount)
    pivotMap.set(d.date.slice(0, 7), (pivotMap.get(d.date.slice(0, 7)) ?? 0) + d.krw_amount)
  }
  const years = Array.from(yearMap.keys()).sort()
  const byYear = years.map((year, i) => {
    const total = yearMap.get(year)!
    const monthCount = new Set(data.filter(d => d.date.startsWith(String(year))).map(d => d.date.slice(0, 7))).size
    const prevTotal = i > 0 ? yearMap.get(years[i - 1])! : null
    return { year, total, monthlyAvg: monthCount > 0 ? Math.round(total / monthCount) : 0, growthRate: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 10000) / 100 : null }
  })
  const pivot = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1
    const row: Record<string, number | string> = { month: `${month}월` }
    years.forEach(y => { row[String(y)] = pivotMap.get(`${y}-${String(month).padStart(2, '0')}`) ?? 0 })
    return row
  })
  return { byYear, pivot, years }
}

// ─── 최근 자산 현황 ───────────────────────────────────────────────────────────
export async function getRecentAssets(months = 5) {
  const supabase = await createClient()
  const allDates = await fetchAll<{ snapshot_date: string }>(
    supabase, 'assets', 'snapshot_date', q => q.order('snapshot_date', { ascending: false })
  )
  const uniqueDates = [...new Set(allDates.map(d => d.snapshot_date))].slice(0, months).reverse()
  if (uniqueDates.length === 0) return { dates: [], assets: [], totals: [] }

  const data = await fetchAll<{ snapshot_date: string; asset_type: string; institution: string; balance: number }>(
    supabase, 'assets', 'snapshot_date, asset_type, institution, balance',
    q => q.in('snapshot_date', uniqueDates).order('asset_type')
  )

  const institutionMap = new Map<string, { asset_type: string; balances: Map<string, number> }>()
  for (const a of data) {
    const cur = institutionMap.get(a.institution) ?? { asset_type: a.asset_type, balances: new Map() }
    cur.balances.set(a.snapshot_date, (cur.balances.get(a.snapshot_date) ?? 0) + a.balance)
    institutionMap.set(a.institution, cur)
  }

  const assets = Array.from(institutionMap.entries()).map(([institution, { asset_type, balances }]) => ({
    institution, asset_type, balances: uniqueDates.map(d => balances.get(d) ?? 0),
  }))
  const totals = uniqueDates.map((_, i) => assets.reduce((s, a) => s + a.balances[i], 0))
  return { dates: uniqueDates, assets, totals }
}

// ─── 개인별 순자산 ────────────────────────────────────────────────────────────
export async function getPersonalNetworth() {
  const supabase = await createClient()
  const { data: latest } = await supabase.from('assets')
    .select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1).single()
  if (!latest) return { snapshotDate: '', owner: [], spouse: [], ownerTotal: 0, spouseTotal: 0 }

  const data = await fetchAll<{ asset_type: string; owner: string; balance: number; contribution_rate: number | null }>(
    supabase, 'assets', 'asset_type, owner, balance, contribution_rate',
    q => q.eq('snapshot_date', latest.snapshot_date)
  )

  const ownerMap = new Map<string, number>()
  const spouseMap = new Map<string, number>()
  for (const a of data) {
    const rate = a.contribution_rate ?? (a.owner === '공동' ? 0.5 : a.owner === '운섭' ? 1 : 0)
    if (a.owner === '운섭') ownerMap.set(a.asset_type, (ownerMap.get(a.asset_type) ?? 0) + a.balance)
    else if (a.owner === '아름') spouseMap.set(a.asset_type, (spouseMap.get(a.asset_type) ?? 0) + a.balance)
    else {
      ownerMap.set(a.asset_type, (ownerMap.get(a.asset_type) ?? 0) + Math.round(a.balance * rate))
      spouseMap.set(a.asset_type, (spouseMap.get(a.asset_type) ?? 0) + Math.round(a.balance * (1 - rate)))
    }
  }

  const toArr = (m: Map<string, number>) => Array.from(m.entries()).map(([category, balance]) => ({ category, balance })).sort((a, b) => b.balance - a.balance)
  const owner = toArr(ownerMap)
  const spouse = toArr(spouseMap)
  return { snapshotDate: latest.snapshot_date, owner, spouse, ownerTotal: owner.reduce((s, v) => s + v.balance, 0), spouseTotal: spouse.reduce((s, v) => s + v.balance, 0) }
}
