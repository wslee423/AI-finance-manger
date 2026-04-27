'use client'

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatAuk } from '@/lib/utils'

interface MonthlyData {
  month: string
  income: number
  expense: number
  savings: number
}

export default function MonthlyChart({ data }: { data: MonthlyData[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-gray-400">데이터가 없습니다</div>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(2)} />
        <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={formatAuk} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={formatAuk} />
        <Tooltip
          formatter={(value: number, name: string) => [
            formatCurrency(value),
            name === 'income' ? '수입' : name === 'expense' ? '지출' : '저축',
          ]}
        />
        <Legend formatter={v => v === 'income' ? '수입' : v === 'expense' ? '지출' : '저축'} />
        <Bar yAxisId="left" dataKey="income" fill="#3b82f6" opacity={0.8} radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="expense" fill="#ef4444" opacity={0.8} radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="savings" stroke="#22c55e" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
