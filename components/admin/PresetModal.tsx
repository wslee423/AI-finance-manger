'use client'

import { useState, useEffect } from 'react'
import { type PresetTemplate } from '@/types'

interface PresetModalProps {
  year: number
  month: number
  onClose: () => void
  onSuccess: () => void
}

export default function PresetModal({ year, month, onClose, onSuccess }: PresetModalProps) {
  const [presets, setPresets] = useState<PresetTemplate[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/presets')
      .then(r => r.json())
      .then((data: PresetTemplate[]) => {
        setPresets(data)
        setSelected(new Set(data.map(p => p.id)))
        const initAmounts: Record<string, string> = {}
        data.forEach(p => { initAmounts[p.id] = String(p.amount) })
        setAmounts(initAmounts)
      })
      .finally(() => setLoading(false))
  }, [])

  function toggleAll() {
    setSelected(selected.size === presets.length ? new Set() : new Set(presets.map(p => p.id)))
  }

  async function handleApply() {
    const toInsert = presets
      .filter(p => selected.has(p.id))
      .filter(p => Number(amounts[p.id]) > 0)
      .map(p => ({
        date: `${year}-${String(month).padStart(2, '0')}-01`,
        class_type: '지출',
        category: p.category,
        subcategory: p.subcategory,
        item: p.item,
        user_name: p.user_name,
        amount: Number(amounts[p.id]),
        memo: p.memo,
      }))

    if (toInsert.length === 0) return

    setSaving(true)
    try {
      const res = await fetch('/api/transactions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: toInsert }),
      })
      if (!res.ok) throw new Error('저장 실패')
      onSuccess()
    } catch {
      setErrorMsg('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const zeroAmounts = presets.filter(p => selected.has(p.id) && Number(amounts[p.id]) === 0)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">고정지출 불러오기</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">로딩 중...</p>
          ) : presets.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">등록된 고정지출 템플릿이 없습니다</p>
          ) : (
            <>
              <div className="flex justify-between items-center mb-3">
                <p className="text-xs text-gray-500">{year}년 {month}월 1일 기준으로 등록됩니다</p>
                <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
                  {selected.size === presets.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="space-y-2">
                {presets.map(p => (
                  <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border ${selected.has(p.id) ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={e => {
                      const s = new Set(selected)
                      if (e.target.checked) { s.add(p.id) } else { s.delete(p.id) }
                      setSelected(s)
                    }} className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.subcategory} · {p.user_name}</p>
                    </div>
                    <input
                      type="number"
                      value={amounts[p.id] ?? ''}
                      onChange={e => setAmounts(a => ({...a, [p.id]: e.target.value}))}
                      className="w-28 px-2 py-1 text-sm text-right border border-gray-300 rounded-lg"
                      min="0"
                    />
                  </div>
                ))}
              </div>
              {zeroAmounts.length > 0 && (
                <p className="text-xs text-amber-600 mt-3">⚠ 금액이 0인 항목 {zeroAmounts.length}개는 제외됩니다</p>
              )}
              {errorMsg && (
                <p className="text-xs text-red-600 mt-3">{errorMsg}</p>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
          <button onClick={handleApply} disabled={saving || selected.size === 0} className="flex-1 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saving ? '저장 중...' : `${selected.size}개 적용`}
          </button>
        </div>
      </div>
    </div>
  )
}
