'use client'

import { useState, useEffect, useCallback } from 'react'
import { type Asset, type AssetType, type AssetOwner, ASSET_OWNERS } from '@/types'
import { formatCurrency, getMonthLastDay, getYearOptions } from '@/lib/utils'
import Toast from '@/components/ui/Toast'

const ASSET_TYPES: AssetType[] = ['부동산', '통장', '연금', '예적금', '기타', '대출']

interface AssetRow {
  id?: string
  asset_type: AssetType
  institution: string
  owner: AssetOwner
  balance: string
  contribution_rate: string
  memo: string
}

export default function AssetsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<AssetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true)
    try {
      const date = `${y}-${String(m).padStart(2, '0')}`
      const res = await fetch(`/api/assets?date=${date}`)
      if (!res.ok) throw new Error()
      const data: Asset[] = await res.json()
      setRows(data.map(a => ({
        id: a.id,
        asset_type: a.asset_type,
        institution: a.institution,
        owner: a.owner,
        balance: String(a.balance),
        contribution_rate: a.contribution_rate != null ? String(a.contribution_rate) : '',
        memo: a.memo ?? '',
      })))
    } catch {
      setToast({ message: '조회에 실패했습니다', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(year, month) }, [fetchData, year, month])

  async function loadPrevMonth() {
    const prevMonth = month === 1 ? 12 : month - 1
    const prevYear = month === 1 ? year - 1 : year
    const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
    try {
      const res = await fetch(`/api/assets?date=${date}`)
      const data: Asset[] = await res.json()
      if (data.length === 0) {
        setToast({ message: '직전 월 데이터가 없습니다', type: 'error' })
        return
      }
      setRows(data.map(a => ({
        asset_type: a.asset_type,
        institution: a.institution,
        owner: a.owner,
        balance: String(a.balance),
        contribution_rate: a.contribution_rate != null ? String(a.contribution_rate) : '',
        memo: a.memo ?? '',
      })))
    } catch {
      setToast({ message: '불러오기에 실패했습니다', type: 'error' })
    }
  }

  function addRow() {
    setRows(r => [...r, { asset_type: '통장', institution: '', owner: '운섭', balance: '0', contribution_rate: '', memo: '' }])
  }

  function removeRow(i: number) {
    setRows(r => r.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    const snapshotDate = getMonthLastDay(year, month)
    const items = rows
      .filter(r => r.institution.trim())
      .map(r => ({
        snapshot_date: snapshotDate,
        asset_type: r.asset_type,
        institution: r.institution.trim(),
        owner: r.owner,
        balance: Number(r.balance) || 0,
        contribution_rate: r.contribution_rate ? Number(r.contribution_rate) : null,
        memo: r.memo || null,
      }))

    if (items.length === 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/assets/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error()
      setToast({ message: '저장되었습니다', type: 'success' })
      fetchData(year, month)
    } catch {
      setToast({ message: '저장에 실패했습니다', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const netWorth = rows.reduce((s, r) => s + (Number(r.balance) || 0), 0)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">자산 스냅샷</h1>
        <div className="flex gap-2">
          <button onClick={loadPrevMonth} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            직전 월 불러오기
          </button>
          <button onClick={addRow} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            + 행 추가
          </button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-2 mb-4">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          {getYearOptions().map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
        <span className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">
          스냅샷: {getMonthLastDay(year, month)}
        </span>
      </div>

      {/* 자산 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['자산유형','기관명','소유자','잔액 (원)','기여율','메모',''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <select value={row.asset_type} onChange={e => setRows(r => r.map((x,j)=>j===i?{...x,asset_type:e.target.value as AssetType}:x))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded">
                      {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.institution} onChange={e => setRows(r => r.map((x,j)=>j===i?{...x,institution:e.target.value}:x))}
                      placeholder="기관명" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <select value={row.owner} onChange={e => setRows(r => r.map((x,j)=>j===i?{...x,owner:e.target.value as AssetOwner}:x))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded">
                      {ASSET_OWNERS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={row.balance} onChange={e => setRows(r => r.map((x,j)=>j===i?{...x,balance:e.target.value}:x))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" value={row.contribution_rate} onChange={e => setRows(r => r.map((x,j)=>j===i?{...x,contribution_rate:e.target.value}:x))}
                      placeholder="0~1" step="0.0001" className="w-20 px-2 py-1 text-sm border border-gray-300 rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={row.memo} onChange={e => setRows(r => r.map((x,j)=>j===i?{...x,memo:e.target.value}:x))}
                      placeholder="메모" className="w-full px-2 py-1 text-sm border border-gray-300 rounded" />
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeRow(i)} className="text-xs text-red-500 hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 순자산 합계 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex justify-between items-center">
        <span className="text-sm font-medium text-blue-800">순자산 합계</span>
        <span className="text-xl font-bold text-blue-900">{formatCurrency(netWorth)}</span>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
