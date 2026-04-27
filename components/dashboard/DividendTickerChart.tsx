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

export default function DividendTickerChart({ tickers, series }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(tickers.slice(0, 5).map(t => t.symbol)) // 기본 상위 5개 선택
  )

  function toggle(symbol: string) {
    const next = new Set(selected)
    if (next.has(symbol)) { next.delete(symbol) } else { next.add(symbol) }
    setSelected(next)
  }

  // 선택된 종목들의 데이터를 월별로 합쳐서 차트 데이터 구성
  const chartData = useMemo(() => {
    const monthSet = new Set<string>()
    const selectedSeries = series.filter(s => selected.has(s.symbol))
    selectedSeries.forEach(s => s.data.forEach(d => monthSet.add(d.month)))

    return Array.from(monthSet).sort().map(month => {
      const row: Record<string, string | number> = { month }
      selectedSeries.forEach(s => {
        const found = s.data.find(d => d.month === month)
        row[s.symbol] = found?.amount ?? 0
      })
      return row
    })
  }, [series, selected])

  const selectedSeries = series.filter(s => selected.has(s.symbol))

  if (tickers.length === 0) return <div className="text-sm text-gray-400 text-center py-8">데이터가 없습니다</div>

  return (
    <div className="space-y-4">
      {/* 종목 선택 */}
      <div className="flex flex-wrap gap-2">
        {tickers.map((t, i) => (
          <button
            key={t.symbol}
            onClick={() => toggle(t.symbol)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-colors ${
              selected.has(t.symbol)
                ? 'text-white border-transparent'
                : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
            }`}
            style={selected.has(t.symbol) ? { backgroundColor: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] } : {}}
          >
            <span className="font-medium">{t.symbol}</span>
          </button>
        ))}
      </div>

      {/* 라인 차트 */}
      {selectedSeries.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(2)} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAuk} />
            <Tooltip
              formatter={(v: number, name: string) => [
                formatCurrency(v),
                tickers.find(t => t.symbol === name)?.name ?? name,
              ]}
              labelFormatter={v => `${v}`}
            />
            <Legend formatter={name => tickers.find(t => t.symbol === name)?.name ?? name} />
            {selectedSeries.map((s) => (
              <Line
                key={s.symbol}
                type="monotone"
                dataKey={s.symbol}
                stroke={COLORS[tickers.findIndex(t => t.symbol === s.symbol) % COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          종목을 선택해주세요
        </div>
      )}
    </div>
  )
}
