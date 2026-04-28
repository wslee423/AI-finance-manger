import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { createClient } from '@/lib/supabase/server'

// ─── Tool Definitions (OpenAI function calling format) ────────────────────────

export const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'query_transactions',
      description: '가계부 거래 내역을 조회합니다. 합계/건수/평균/목록 집계를 지원합니다.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '시작 날짜 (YYYY-MM 또는 YYYY-MM-DD)' },
          to: { type: 'string', description: '종료 날짜 (YYYY-MM 또는 YYYY-MM-DD). 미지정 시 오늘까지' },
          class_type: { type: 'string', enum: ['수입', '지출', '이체'], description: '거래 유형 (이체=저축/투자)' },
          category: {
            type: 'string',
            enum: ['보험', '용돈', '관리비', '통신비', '구독/멤버십', '마트/편의점', '외식비', '의류/미용', '여가비', '병원비', '경조사', '기타'],
            description: '지출 카테고리. 특정 카테고리 검색 시만 사용. 전체 지출 조회 시 생략.',
          },
          subcategory: { type: 'string', description: 'category 하위 세부 항목 (자유 입력). category 고정값과 중복 사용 금지.' },
          user_name: { type: 'string', enum: ['운섭', '아름', '희온', '공동'], description: '가족 구성원' },
          tags: { type: 'string', description: '태그 키워드 검색 (예: #육아, #부동산). 쉼표 구분 문자열' },
          keyword: { type: 'string', description: '메모/항목명 키워드 검색' },
          aggregate: {
            type: 'string',
            enum: ['sum', 'count', 'avg', 'list'],
            description: '집계 방식. 합계=sum, 건수=count, 평균=avg, 목록=list. 기본값: sum',
          },
          limit: { type: 'number', description: 'list 조회 시 최대 건수. 최대 10 (기본값: 10)' },
        },
        required: ['from'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_assets',
      description: '자산 현황을 조회합니다. 최신 스냅샷 또는 특정 시점/추이를 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          snapshot_date: { type: 'string', description: '조회할 월 (YYYY-MM). 미지정 시 최신 스냅샷' },
          owner: { type: 'string', enum: ['운섭', '아름', '공동', 'all'], description: '소유자 필터. 기본: all' },
          asset_type: { type: 'string', enum: ['부동산', '통장', '연금', '예적금', '기타', '대출'], description: '자산 유형 필터' },
          history: { type: 'boolean', description: 'true면 전체 추이 반환' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_dividend',
      description: '배당금 현황을 조회합니다.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '시작 날짜 (YYYY-MM 또는 YYYY-MM-DD)' },
          to: { type: 'string', description: '종료 날짜' },
          ticker: { type: 'string', description: '종목 티커 (SCHD, TLT, O 등)' },
          aggregate: {
            type: 'string',
            enum: ['monthly', 'yearly', 'total', 'list'],
            description: '집계 방식. 기본값: total',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_summary',
      description: '재정 지표를 계산합니다. 저축률, 순자산 증가율, 배당금 목표 달성률, 지출 비교, 카테고리 비율.',
      parameters: {
        type: 'object',
        properties: {
          metric: {
            type: 'string',
            enum: ['savings_rate', 'networth_growth', 'dividend_target', 'expense_comparison', 'category_ratio'],
            description: 'savings_rate=저축률, networth_growth=순자산증가율, dividend_target=배당목표달성률, expense_comparison=지출비교, category_ratio=카테고리비율',
          },
          params: {
            type: 'object',
            description: 'savings_rate/category_ratio: {from, to?}. networth_growth: {from_date?, to_date?}. dividend_target: {monthly_target?}. expense_comparison: {from, to?}',
          },
        },
        required: ['metric'],
      },
    },
  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toDateRange(from: string, to?: string): { fromDate: string; toDate: string } {
  const fromDate = from.length === 7 ? `${from}-01` : from
  let toDate: string
  if (to) {
    if (to.length === 7) {
      const [y, m] = to.split('-').map(Number)
      toDate = `${to}-${new Date(y, m, 0).getDate()}`
    } else {
      toDate = to
    }
  } else {
    toDate = new Date().toISOString().slice(0, 10)
  }
  return { fromDate, toDate }
}

// ─── Tool Dispatcher ─────────────────────────────────────────────────────────

export async function executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'query_transactions': return queryTransactions(args)
    case 'query_assets': return queryAssets(args)
    case 'query_dividend': return queryDividend(args)
    case 'calculate_summary': return calculateSummary(args)
    default: throw new Error(`Unknown tool: ${name}`)
  }
}

// ─── Tool Implementations ─────────────────────────────────────────────────────

type TxArgs = {
  from: string; to?: string; class_type?: string; category?: string
  subcategory?: string; user_name?: string; tags?: string
  keyword?: string; aggregate?: string; limit?: number
}

async function runTxQuery(supabase: Awaited<ReturnType<typeof createClient>>, params: TxArgs & { fromDate: string; toDate: string }) {
  const { fromDate, toDate, class_type, category, subcategory, user_name, tags, keyword, aggregate = 'sum', limit = 10 } = params
  const safeLimit = Math.min(Number(limit), 10)

  const columns = aggregate === 'list'
    ? 'date, class, type, category, subcategory, item, user_name, amount, memo'
    : 'amount, class'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('transactions')
    .select(columns)
    .is('deleted_at', null)
    .gte('date', fromDate)
    .lte('date', toDate)

  if (class_type) q = q.eq('class', class_type)
  if (category) q = q.eq('category', category)
  if (subcategory) q = q.ilike('subcategory', `%${subcategory}%`)
  if (user_name) q = q.eq('user_name', user_name)
  if (tags) q = q.ilike('tags', `%${tags}%`)
  if (keyword) q = q.or(`memo.ilike.%${keyword}%,item.ilike.%${keyword}%`)

  if (aggregate === 'list') {
    q = q.order('date', { ascending: false }).limit(safeLimit)
  } else {
    q = q.order('date')
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as { amount: number; class: string }[]
}

async function queryTransactions(args: Record<string, unknown>) {
  const supabase = await createClient()
  const parsed = args as TxArgs
  const { from, to, aggregate = 'sum' } = parsed
  const { fromDate, toDate } = toDateRange(from, to)
  const base = { ...parsed, fromDate, toDate }

  let rows = await runTxQuery(supabase, base)

  // subcategory 0건이면 keyword로 자동 재조회 (subcategory는 자유입력이라 저장 방식이 다를 수 있음)
  if (rows.length === 0 && parsed.subcategory && !parsed.keyword) {
    console.log(`[Auto-retry] subcategory="${parsed.subcategory}" 0건 → keyword로 재조회`)
    rows = await runTxQuery(supabase, { ...base, subcategory: undefined, keyword: parsed.subcategory })
  }

  if (aggregate === 'list') return { period: `${fromDate}~${toDate}`, count: rows.length, items: rows }

  const total = rows.reduce((s, r) => s + r.amount, 0)
  if (aggregate === 'count') return { period: `${fromDate}~${toDate}`, count: rows.length }
  if (aggregate === 'avg') return { period: `${fromDate}~${toDate}`, count: rows.length, avg: rows.length > 0 ? Math.round(total / rows.length) : 0, total }
  return { period: `${fromDate}~${toDate}`, count: rows.length, total }
}

type AssetArgs = { snapshot_date?: string; owner?: string; asset_type?: string; history?: boolean }

async function queryAssets(args: Record<string, unknown>) {
  const supabase = await createClient()
  const { snapshot_date, owner, asset_type, history } = args as AssetArgs

  if (history) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from('assets').select('snapshot_date, asset_type, balance').order('snapshot_date')
    if (owner && owner !== 'all') q = q.eq('owner', owner)
    if (asset_type) q = q.eq('asset_type', asset_type)
    const { data, error } = await q
    if (error) throw new Error(error.message)

    // 날짜별 순자산 요약 (전체 raw 반환 대신 집계 — 토큰 절약)
    const map = new Map<string, number>()
    for (const a of (data ?? []) as { snapshot_date: string; balance: number }[]) {
      map.set(a.snapshot_date, (map.get(a.snapshot_date) ?? 0) + a.balance)
    }
    return {
      history: Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, netWorth]) => ({ date, netWorth })),
    }
  }

  // 최신 또는 특정 날짜 스냅샷
  let targetDate = snapshot_date
  if (!targetDate || targetDate === 'latest') {
    const { data: latest } = await supabase.from('assets')
      .select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1).single()
    targetDate = latest?.snapshot_date
  } else if (targetDate.length === 7) {
    const { data: found } = await supabase.from('assets')
      .select('snapshot_date')
      .gte('snapshot_date', `${targetDate}-01`)
      .lte('snapshot_date', `${targetDate}-31`)
      .order('snapshot_date', { ascending: false }).limit(1).single()
    targetDate = found?.snapshot_date ?? `${targetDate}-01`
  }

  if (!targetDate) return { snapshotDate: null, netWorth: 0, assets: [] }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('assets')
    .select('asset_type, balance')
    .eq('snapshot_date', targetDate)
  if (owner && owner !== 'all') q = q.eq('owner', owner)
  if (asset_type) q = q.eq('asset_type', asset_type)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as { asset_type: string; balance: number }[]
  const netWorth = rows.reduce((s, a) => s + a.balance, 0)
  // asset_type별 합계로 압축 (institution 행 수십 개 → 6개 이하로 토큰 절약)
  const byType = rows.reduce<Record<string, number>>((acc, a) => {
    acc[a.asset_type] = (acc[a.asset_type] ?? 0) + a.balance
    return acc
  }, {})
  return { snapshotDate: targetDate, netWorth, byType }
}

type DivArgs = { from?: string; to?: string; ticker?: string; aggregate?: string }

async function queryDividend(args: Record<string, unknown>) {
  const supabase = await createClient()
  const { from, to, ticker, aggregate = 'total' } = args as DivArgs

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from('dividend')
    .select('date, ticker_name, ticker_symbol, krw_amount')
    .order('date')

  if (from) q = q.gte('date', from.length === 7 ? `${from}-01` : from)
  if (to) {
    if (to.length === 7) {
      const [y, m] = to.split('-').map(Number)
      q = q.lte('date', `${to}-${new Date(y, m, 0).getDate()}`)
    } else {
      q = q.lte('date', to)
    }
  }
  if (ticker) q = q.or(`ticker_symbol.ilike.%${ticker}%,ticker_name.ilike.%${ticker}%`)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { date: string; ticker_name: string; ticker_symbol: string | null; krw_amount: number }[]

  const total = rows.reduce((s, d) => s + d.krw_amount, 0)

  if (aggregate === 'list') return { count: rows.length, items: rows.slice(0, 10) }

  if (aggregate === 'monthly') {
    const map = new Map<string, number>()
    for (const d of rows) {
      const month = d.date.slice(0, 7)
      map.set(month, (map.get(month) ?? 0) + d.krw_amount)
    }
    const months = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({ month, amount }))
    return { total, monthlyAvg: months.length > 0 ? Math.round(total / months.length) : 0, months }
  }

  if (aggregate === 'yearly') {
    const map = new Map<number, number>()
    for (const d of rows) {
      const year = Number(d.date.slice(0, 4))
      map.set(year, (map.get(year) ?? 0) + d.krw_amount)
    }
    return { total, yearly: Array.from(map.entries()).sort(([a], [b]) => a - b).map(([year, amount]) => ({ year, amount })) }
  }

  return { total, count: rows.length }
}

type SummaryArgs = { metric: string; params?: Record<string, unknown> }

async function calculateSummary(args: Record<string, unknown>) {
  const supabase = await createClient()
  const { metric, params = {} } = args as SummaryArgs

  if (metric === 'savings_rate') {
    const { from, to } = params as { from?: string; to?: string }
    const now = new Date()
    const defaultFrom = `${now.getFullYear()}-01-01`
    const { fromDate, toDate } = from ? toDateRange(from, to) : { fromDate: defaultFrom, toDate: now.toISOString().slice(0, 10) }

    const { data } = await supabase.from('transactions')
      .select('class, amount')
      .is('deleted_at', null)
      .neq('class', '이체')
      .gte('date', fromDate)
      .lte('date', toDate)

    const rows = (data ?? []) as { class: string; amount: number }[]
    const income = rows.filter(t => t['class'] === '수입').reduce((s, t) => s + t.amount, 0)
    const expense = rows.filter(t => t['class'] === '지출').reduce((s, t) => s + t.amount, 0)
    return {
      period: `${fromDate}~${toDate}`,
      income, expense,
      savings: income - expense,
      savingsRate: income > 0 ? Math.round(((income - expense) / income) * 10000) / 100 : 0,
    }
  }

  if (metric === 'networth_growth') {
    const { from_date, to_date } = params as { from_date?: string; to_date?: string }

    const [latestRes, earliestRes] = await Promise.all([
      supabase.from('assets').select('snapshot_date').order('snapshot_date', { ascending: false }).limit(1).single(),
      supabase.from('assets').select('snapshot_date').order('snapshot_date').limit(1).single(),
    ])
    const latestDate = to_date ?? latestRes.data?.snapshot_date
    const earliestDate = from_date ?? earliestRes.data?.snapshot_date
    if (!latestDate || !earliestDate) return { error: '자산 데이터가 없어요' }

    const [{ data: latestData }, { data: earliestData }] = await Promise.all([
      supabase.from('assets').select('balance').eq('snapshot_date', latestDate),
      supabase.from('assets').select('balance').eq('snapshot_date', earliestDate),
    ])
    const latestNW = ((latestData ?? []) as { balance: number }[]).reduce((s, a) => s + a.balance, 0)
    const earliestNW = ((earliestData ?? []) as { balance: number }[]).reduce((s, a) => s + a.balance, 0)
    return {
      fromDate: earliestDate, fromNetWorth: earliestNW,
      toDate: latestDate, toNetWorth: latestNW,
      growth: latestNW - earliestNW,
      growthRate: earliestNW > 0 ? Math.round(((latestNW - earliestNW) / earliestNW) * 10000) / 100 : 0,
    }
  }

  if (metric === 'dividend_target') {
    const { monthly_target = 1000000 } = params as { monthly_target?: number }
    const year = new Date().getFullYear()
    const { data } = await supabase.from('dividend').select('date, krw_amount').gte('date', `${year}-01-01`)

    const rows = (data ?? []) as { date: string; krw_amount: number }[]
    const total = rows.reduce((s, d) => s + d.krw_amount, 0)
    const monthCount = new Set(rows.map(d => d.date.slice(0, 7))).size
    const monthlyAvg = monthCount > 0 ? Math.round(total / monthCount) : 0
    return {
      year, total, monthCount, monthlyAvg,
      target: monthly_target,
      achievementRate: Math.round((monthlyAvg / Number(monthly_target)) * 10000) / 100,
      isAchieved: monthlyAvg >= Number(monthly_target),
    }
  }

  if (metric === 'expense_comparison') {
    const { from, to } = params as { from?: string; to?: string }
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`

    const period1 = from ? toDateRange(from, to) : toDateRange(lastMonth, lastMonth)
    const period2 = toDateRange(thisMonth, thisMonth)

    const getExpense = async (pd: { fromDate: string; toDate: string }) => {
      const { data } = await supabase.from('transactions')
        .select('amount')
        .is('deleted_at', null)
        .eq('class', '지출')
        .gte('date', pd.fromDate)
        .lte('date', pd.toDate)
      return ((data ?? []) as { amount: number }[]).reduce((s, t) => s + t.amount, 0)
    }

    const [expense1, expense2] = await Promise.all([getExpense(period1), getExpense(period2)])
    const diff = expense2 - expense1
    return {
      period1: `${period1.fromDate}~${period1.toDate}`, expense1,
      period2: `${period2.fromDate}~${period2.toDate}`, expense2,
      diff, changeRate: expense1 > 0 ? Math.round((diff / expense1) * 10000) / 100 : 0,
    }
  }

  if (metric === 'category_ratio') {
    const { from, to } = params as { from?: string; to?: string }
    const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
    const { fromDate, toDate } = from ? toDateRange(from, to) : toDateRange(thisMonth, thisMonth)

    const { data } = await supabase.from('transactions')
      .select('category, amount')
      .is('deleted_at', null)
      .eq('class', '지출')
      .gte('date', fromDate)
      .lte('date', toDate)

    const rows = (data ?? []) as { category: string; amount: number }[]
    const total = rows.reduce((s, t) => s + t.amount, 0)
    const catMap = new Map<string, number>()
    for (const t of rows) catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount)

    return {
      period: `${fromDate}~${toDate}`, totalExpense: total,
      categories: Array.from(catMap.entries()).sort(([, a], [, b]) => b - a)
        .map(([category, amount]) => ({
          category, amount,
          ratio: total > 0 ? Math.round((amount / total) * 10000) / 100 : 0,
        })),
    }
  }

  throw new Error(`Unknown metric: ${metric}`)
}
