'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCurrency, formatAuk } from '@/lib/utils'

interface DividendData {
  byYear: { year: number; total: number; monthlyAvg: number; growthRate: number | null }[]
  pivot: Record<string, number | string>[]
  years: number[]
}

const YEAR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6']

export default function DividendSection({ data }: { data: DividendData }) {
  const { byYear, pivot, years } = data

  return (
    <div className="space-y-6">
      {/* 연도별 배당금 성장 KPI */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['연도', '총 배당금', '월평균', '전년 대비'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-xs font-medium text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {byYear.map(y => (
              <tr key={y.year} className="hover:bg-gray-50">
                <td className="px-4 py-2 font-medium">{y.year}년</td>
                <td className="px-4 py-2 text-green-700 font-medium">{formatCurrency(y.total)}</td>
                <td className="px-4 py-2 text-gray-600">{formatCurrency(y.monthlyAvg)}</td>
                <td className="px-4 py-2">
                  {y.growthRate !== null ? (
                    <span className={y.growthRate >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {y.growthRate >= 0 ? '+' : ''}{y.growthRate}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 월×연도 그룹 막대 차트 */}
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={pivot} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={formatAuk} />
          <Tooltip formatter={(v: number) => formatCurrency(v)} />
          <Legend />
          {years.map((year, i) => (
            <Bar key={year} dataKey={String(year)} fill={YEAR_COLORS[i % YEAR_COLORS.length]} radius={[2, 2, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* 피봇 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-gray-500">월</th>
              {years.map(y => <th key={y} className="px-3 py-2 text-right text-gray-500">{y}년</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pivot.map(row => (
              <tr key={String(row.month)} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 text-gray-600">{row.month}</td>
                {years.map(y => (
                  <td key={y} className="px-3 py-1.5 text-right text-gray-800">
                    {Number(row[y]) > 0 ? formatCurrency(Number(row[y])) : '—'}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="px-3 py-2 text-gray-700">합계</td>
              {years.map(y => {
                const total = pivot.reduce((s, r) => s + Number(r[y] ?? 0), 0)
                return <td key={y} className="px-3 py-2 text-right text-green-700">{formatCurrency(total)}</td>
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
