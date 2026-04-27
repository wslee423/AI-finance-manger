'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatAuk } from '@/lib/utils'

interface NetWorthData {
  date: string
  realestate: number
  stocks: number
  pension: number
  savings: number
  others: number
  loans: number
  netWorth: number
}

const AREAS = [
  { key: 'realestate', label: '부동산', color: '#3b82f6' },
  { key: 'stocks',     label: '통장',   color: '#22c55e' },
  { key: 'pension',    label: '연금',   color: '#8b5cf6' },
  { key: 'savings',    label: '예적금', color: '#f59e0b' },
  { key: 'others',     label: '기타',   color: '#6b7280' },
]

export default function NetWorthChart({ data }: { data: NetWorthData[] }) {
  if (data.length === 0) return <div className="flex items-center justify-center h-64 text-sm text-gray-400">데이터가 없습니다</div>

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(0, 7)} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAuk} />
        <Tooltip
          formatter={(v: number, name: string) => [
            formatAuk(v),
            AREAS.find(a => a.key === name)?.label ?? name,
          ]}
          labelFormatter={v => v.slice(0, 7)}
        />
        <Legend formatter={v => AREAS.find(a => a.key === v)?.label ?? v} />
        {AREAS.map(({ key, color }) => (
          <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={color} fill={color} fillOpacity={0.6} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}
