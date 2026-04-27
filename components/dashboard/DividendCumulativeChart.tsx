'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatAuk } from '@/lib/utils'

interface TickerData {
  symbol: string
  name: string
  data: { month: string; amount: number }[]
}

interface Props {
  tickers: { symbol: string; name: string }[]
  series: TickerData[]
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']
const TOTAL_COLOR = '#1e293b'

export default function DividendCumulativeChart({ tickers, series }: Props) {
  const [selectedTickers, setSelectedTickers] = useState<Set<string>>(new Set())
  const [showTotal, setShowTotal] = useState(true)

  function toggleTicker(symbol: string) {
    const next = new Set(selectedTickers)
    if (next.has(symbol)) { next.delete(symbol) } else { next.add(symbol) }
    setSelectedTickers(next)
  }

  // 전체 월 목록 생성
  const allMonths = useMemo(() => {
    const s = new Set<string>()
    series.forEach(t => t.data.forEach(d => s.add(d.month)))
    return Array.from(s).sort()
  }, [series])

  // 종목별 누적합 계산
  const cumulativeByTicker = useMemo(() => {
    return series.map(s => {
      const monthMap = new Map(s.data.map(d => [d.month, d.amount]))
      let running = 0
      const cumData = allMonths.map(month => {
        running += monthMap.get(month) ?? 0
        return { month, cumulative: running }
      })
      return { symbol: s.symbol, name: s.name, data: cumData }
    })
  }, [series, allMonths])

  // 전체 누적합
  const totalCumulative = useMemo(() => {
    const monthMap = new Map<string, number>()
    series.forEach(s => s.data.forEach(d => {
      monthMap.set(d.month, (monthMap.get(d.month) ?? 0) + d.amount)
    }))
    let running = 0
    return allMonths.map(month => {
      running += monthMap.get(month) ?? 0
      return { month, cumulative: running }
    })
  }, [series, allMonths])

  // 차트 데이터 병합
  const chartData = useMemo(() => {
    return allMonths.map((month, i) => {
      const row: Record<string, string | number> = { month }
      if (showTotal) row['__total__'] = totalCumulative[i]?.cumulative ?? 0
      cumulativeByTicker
        .filter(t => selectedTickers.has(t.symbol))
        .forEach(t => { row[t.symbol] = t.data[i]?.cumulative ?? 0 })
      return row
    })
  }, [allMonths, showTotal, totalCumulative, cumulativeByTicker, selectedTickers])

  const currentTotal = totalCumulative.at(-1)?.cumulative ?? 0

  return (
    <div className="space-y-4">
      {/* 현재 누적 총액 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">현재까지 누적 배당금</span>
        <span className="text-lg font-bold text-gray-900">{formatCurrency(currentTotal)}</span>
      </div>

      {/* 선택 버튼 */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowTotal(!showTotal)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border font-semibold transition-colors ${
            showTotal ? 'text-white border-transparent' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
          }`}
          style={showTotal ? { backgroundColor: TOTAL_COLOR } : {}}
        >
          전체 합계
        </button>
        {tickers.map((t, i) => (
          <button
            key={t.symbol}
            onClick={() => toggleTicker(t.symbol)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              selectedTickers.has(t.symbol)
                ? 'text-white border-transparent'
                : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
            }`}
            style={selectedTickers.has(t.symbol) ? { backgroundColor: COLORS[i % COLORS.length] } : {}}
          >
            {t.symbol}
          </button>
        ))}
      </div>

      {/* 누적 라인 차트 */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(2)} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAuk} />
          <Tooltip
            formatter={(v: number, name: string) => [
              formatCurrency(v),
              name === '__total__' ? '전체 합계' : (tickers.find(t => t.symbol === name)?.name ?? name),
            ]}
            labelFormatter={v => `${v} 누적`}
          />
          <Legend
            formatter={name => name === '__total__' ? '전체 합계' : (tickers.find(t => t.symbol === name)?.name ?? name)}
          />
          {showTotal && (
            <Line
              type="monotone"
              dataKey="__total__"
              stroke={TOTAL_COLOR}
              strokeWidth={3}
              dot={false}
              strokeDasharray="6 2"
            />
          )}
          {cumulativeByTicker
            .filter(t => selectedTickers.has(t.symbol))
            .map(t => (
              <Line
                key={t.symbol}
                type="monotone"
                dataKey={t.symbol}
                stroke={COLORS[tickers.findIndex(tk => tk.symbol === t.symbol) % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))
          }
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
