'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'

interface SavingsRateData {
  month: string
  savingsRate: number
}

const TARGET_RATE = 70

export default function SavingsRateChart({ data }: { data: SavingsRateData[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-gray-400">데이터가 없습니다</div>

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(2)} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={['auto', 'auto']} />
        <Tooltip formatter={(v: number) => [`${v}%`, '저축률']} />
        <ReferenceLine y={TARGET_RATE} stroke="#f97316" strokeDasharray="4 4" label={{ value: `목표 ${TARGET_RATE}%`, fill: '#f97316', fontSize: 11 }} />
        <Line type="monotone" dataKey="savingsRate" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
