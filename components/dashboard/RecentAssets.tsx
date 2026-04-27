'use client'

import { formatCurrency } from '@/lib/utils'

interface RecentAssetsData {
  dates: string[]
  assets: { institution: string; asset_type: string; balances: number[] }[]
  totals: number[]
}

function fmt(b: number): string {
  if (b === 0) return '—'
  const abs = Math.abs(b)
  if (abs >= 100000000) return `${(b / 100000000).toFixed(2)}억`
  if (abs >= 10000) return `${(b / 10000).toFixed(0)}만`
  return formatCurrency(b)
}

export default function RecentAssets({ data }: { data: RecentAssetsData }) {
  const { dates, assets, totals } = data

  if (dates.length === 0) return <div className="text-sm text-gray-400 text-center py-8">데이터가 없습니다</div>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 min-w-40">자산</th>
            {dates.map(d => (
              <th key={d} className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 min-w-28">
                {d.slice(0, 7)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {assets.map(a => (
            <tr key={a.institution} className="hover:bg-gray-50">
              <td className="px-4 py-2.5">
                <span className="text-gray-800 font-medium text-xs">{a.institution}</span>
                <span className="text-gray-400 text-xs ml-1.5">({a.asset_type})</span>
              </td>
              {a.balances.map((b, i) => (
                <td key={i} className={`px-4 py-2.5 text-right text-xs font-medium ${b < 0 ? 'text-red-600' : b === 0 ? 'text-gray-300' : 'text-gray-800'}`}>
                  {fmt(b)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-blue-50">
            <td className="px-4 py-2.5 text-xs font-semibold text-blue-800">순자산 합계</td>
            {totals.map((t, i) => (
              <td key={i} className={`px-4 py-2.5 text-right text-xs font-bold ${t < 0 ? 'text-red-700' : 'text-blue-900'}`}>
                {fmt(t)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
