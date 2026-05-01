'use client'

import { useState, useEffect, useCallback } from 'react'
import { type Dividend } from '@/types'
import { formatCurrency, formatDate, getTodayStr, getYearOptions } from '@/lib/utils'
import Toast from '@/components/ui/Toast'
import ConfirmModal from '@/components/ui/ConfirmModal'

const EMPTY_FORM = {
  date: getTodayStr(),
  ticker_name: '',
  ticker_symbol: '',
  account: '',
  usd_amount: '',
  exchange_rate: '',
  krw_amount: '',
}

export default function DividendPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [dividends, setDividends] = useState<Dividend[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [rateLoading, setRateLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dividend?year=${year}`)
      if (!res.ok) throw new Error()
      setDividends(await res.json())
    } catch {
      setToast({ message: '조회에 실패했습니다', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { fetchData() }, [fetchData])

  // USD 금액 또는 환율 변경 시 원화 자동 계산
  useEffect(() => {
    const usd = Number(form.usd_amount)
    const rate = Number(form.exchange_rate)
    if (usd > 0 && rate > 0) {
      setForm(f => ({ ...f, krw_amount: String(Math.round(usd * rate)) }))
    }
  }, [form.usd_amount, form.exchange_rate])

  async function fetchExchangeRate() {
    if (!form.date) return
    setRateLoading(true)
    try {
      const res = await fetch(`/api/dividend/exchange-rate?date=${form.date}`)
      if (!res.ok) throw new Error()
      const { rate } = await res.json()
      setForm(f => ({ ...f, exchange_rate: String(rate) }))
      setToast({ message: `환율 조회 완료: ${rate.toLocaleString()}원`, type: 'success' })
    } catch {
      setToast({ message: '환율 조회에 실패했습니다. 수동 입력해주세요', type: 'error' })
    } finally {
      setRateLoading(false)
    }
  }

  function handleEdit(d: Dividend) {
    setForm({
      date: d.date,
      ticker_name: d.ticker_name,
      ticker_symbol: d.ticker_symbol ?? '',
      account: d.account ?? '',
      usd_amount: d.usd_amount != null ? String(d.usd_amount) : '',
      exchange_rate: d.exchange_rate != null ? String(d.exchange_rate) : '',
      krw_amount: String(d.krw_amount),
    })
    setEditId(d.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      date: form.date,
      ticker_name: form.ticker_name,
      ticker_symbol: form.ticker_symbol || null,
      account: form.account || null,
      usd_amount: form.usd_amount ? Number(form.usd_amount) : null,
      exchange_rate: form.exchange_rate ? Number(form.exchange_rate) : null,
      krw_amount: Number(form.krw_amount),
    }
    try {
      const res = editId
        ? await fetch(`/api/dividend/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/dividend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

      if (!res.ok) throw new Error()
      setToast({ message: editId ? '수정되었습니다' : '저장되었습니다', type: 'success' })
      setForm(EMPTY_FORM)
      setEditId(null)
      setShowForm(false)
      fetchData()
    } catch {
      setToast({ message: '저장에 실패했습니다', type: 'error' })
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/dividend/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setToast({ message: '삭제되었습니다', type: 'success' })
      fetchData()
    } catch {
      setToast({ message: '삭제에 실패했습니다', type: 'error' })
    } finally {
      setDeleteId(null)
    }
  }

  const totalKrw = dividends.reduce((s, d) => s + d.krw_amount, 0)

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">배당금</h1>
        <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(EMPTY_FORM) }}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + 배당금 입력
        </button>
      </div>

      {/* 연도 선택 */}
      <div className="flex gap-2 mb-4">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          {getYearOptions(2023).map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium">
          {year}년 총 배당금: {formatCurrency(totalKrw)}
        </div>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">날짜 <span className="text-red-500">*</span></label>
              <input type="date" value={form.date} onChange={e => setForm(f=>({...f, date: e.target.value}))} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종목명 <span className="text-red-500">*</span></label>
              <input type="text" value={form.ticker_name} onChange={e => setForm(f=>({...f, ticker_name: e.target.value}))} required placeholder="SCHD, TLT, O..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">티커 심볼</label>
              <input type="text" value={form.ticker_symbol} onChange={e => setForm(f=>({...f, ticker_symbol: e.target.value}))} placeholder="SCHD" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">계좌</label>
              <input type="text" value={form.account} onChange={e => setForm(f=>({...f, account: e.target.value}))} placeholder="선택 입력" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">USD 금액</label>
              <input type="number" value={form.usd_amount} onChange={e => setForm(f=>({...f, usd_amount: e.target.value}))} step="0.0001" placeholder="원화 배당이면 비워둠" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">환율 (원/USD)</label>
              <div className="flex gap-1">
                <input type="number" value={form.exchange_rate} onChange={e => setForm(f=>({...f, exchange_rate: e.target.value}))} placeholder="자동 조회" className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg" />
                <button type="button" onClick={fetchExchangeRate} disabled={rateLoading} className="px-2 py-2 text-xs bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 whitespace-nowrap">
                  {rateLoading ? '...' : '조회'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">원화금액 <span className="text-red-500">*</span></label>
              <input type="number" value={form.krw_amount} onChange={e => setForm(f=>({...f, krw_amount: e.target.value}))} required min="1" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">취소</button>
            <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">{editId ? '수정' : '저장'}</button>
          </div>
        </form>
      )}

      {/* 목록 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
        ) : dividends.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">이 연도에 배당금 데이터가 없어요</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['날짜','종목','티커','USD','환율','원화금액',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dividends.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{formatDate(d.date)}</td>
                  <td className="px-4 py-3 text-gray-800 font-medium">{d.ticker_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{d.ticker_symbol ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.usd_amount != null ? `$${d.usd_amount}` : '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{d.exchange_rate != null ? d.exchange_rate.toLocaleString() : '-'}</td>
                  <td className="px-4 py-3 text-green-700 font-medium">{formatCurrency(d.krw_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(d)} className="text-xs text-blue-600 hover:underline">수정</button>
                      <button onClick={() => setDeleteId(d.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteId && (
        <ConfirmModal message="이 배당금 내역을 삭제할까요?" onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
