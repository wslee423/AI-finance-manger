'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { CATEGORIES, SUBCATEGORIES, USER_NAMES, type Transaction, type ClassType, type UserName } from '@/types'
import { formatCurrency, formatDate, getTodayStr, getCurrentYearMonth, getYearOptions } from '@/lib/utils'
import Toast from '@/components/ui/Toast'
import ConfirmModal from '@/components/ui/ConfirmModal'
import PresetModal from '@/components/admin/PresetModal'
import ImportModal from '@/components/admin/ImportModal'
import TagInput from '@/components/admin/TagInput'

function normalizeTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean)
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

const makeEmptyForm = () => ({
  date: getTodayStr(),
  class: '지출' as ClassType,
  category: '변동지출',
  subcategory: '',
  item: '',
  user_name: '공동' as UserName,
  amount: '',
  memo: '',
  tags: '',
})

const CLASS_BADGE: Record<string, string> = {
  수입: 'bg-blue-50 text-blue-700',
  지출: 'bg-red-50 text-red-700',
  이체: 'bg-gray-100 text-gray-600',
}

const CLASS_AMOUNT: Record<string, string> = {
  수입: 'text-blue-600',
  지출: 'text-red-600',
  이체: 'text-gray-500',
}

export default function TransactionsPage() {
  const { year: curYear, month: curMonth } = getCurrentYearMonth()
  const [year, setYear] = useState(curYear)
  const [month, setMonth] = useState(curMonth)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showPreset, setShowPreset] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [form, setForm] = useState(makeEmptyForm)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [allTags, setAllTags] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(setAllTags).catch(() => {})
  }, [])

  // 필터 상태
  const [filterClass, setFilterClass] = useState('전체')
  const [filterCategory, setFilterCategory] = useState('전체')
  const [filterUser, setFilterUser] = useState('전체')
  const [filterKeyword, setFilterKeyword] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?year=${year}&month=${month}`)
      if (!res.ok) throw new Error('조회 실패')
      setTransactions(await res.json())
    } catch {
      setToast({ message: '데이터 조회에 실패했습니다', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { fetchData() }, [fetchData])

  // 필터 변경 시 카테고리 리셋
  useEffect(() => { setFilterCategory('전체') }, [filterClass])

  // 현재 데이터에서 카테고리 목록 동적 추출
  const categoryOptions = useMemo(() => {
    const base = transactions
      .filter(t => filterClass === '전체' || t.class === filterClass)
      .map(t => t.category)
    return ['전체', ...Array.from(new Set(base))]
  }, [transactions, filterClass])

  // 클라이언트 필터링
  const filtered = useMemo(() => transactions.filter(t => {
    if (filterClass !== '전체' && t.class !== filterClass) return false
    if (filterCategory !== '전체' && t.category !== filterCategory) return false
    if (filterUser !== '전체' && t.user_name !== filterUser) return false
    if (filterKeyword) {
      const kw = filterKeyword.toLowerCase()
      const hit = [t.item, t.subcategory, t.memo, t.category].some(v => v?.toLowerCase().includes(kw))
      if (!hit) return false
    }
    return true
  }), [transactions, filterClass, filterCategory, filterUser, filterKeyword])

  function handleClassChange(classType: '수입' | '지출') {
    const defaultCat = CATEGORIES[classType][0]
    setForm(f => ({ ...f, class: classType, category: defaultCat, subcategory: '' }))
  }

  function handleEdit(t: Transaction) {
    const tagsStr = normalizeTags(t.tags).join(', ')
    setForm({
      date: t.date,
      class: t.class,
      category: t.category,
      subcategory: t.subcategory ?? '',
      item: t.item ?? '',
      user_name: t.user_name,
      amount: String(t.amount),
      memo: t.memo ?? '',
      tags: tagsStr,
    })
    setEditId(t.id)
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      ...form,
      amount: Number(form.amount),
      subcategory: form.subcategory || null,
      item: form.item || null,
      memo: form.memo || null,
      tags: form.tags || null,
    }
    try {
      const res = editId
        ? await fetch(`/api/transactions/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error()
      setToast({ message: editId ? '수정되었습니다' : '저장되었습니다', type: 'success' })
      setForm(makeEmptyForm()); setEditId(null); setShowForm(false); fetchData()
    } catch {
      setToast({ message: '저장에 실패했습니다', type: 'error' })
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setToast({ message: '삭제되었습니다', type: 'success' })
      fetchData()
    } catch {
      setToast({ message: '삭제에 실패했습니다', type: 'error' })
    } finally {
      setDeleteId(null)
    }
  }

  const income = transactions.filter(t => t.class === '수입').reduce((s, t) => s + t.amount, 0)
  const expense = transactions.filter(t => t.class === '지출').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="max-w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">수입/지출</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">📂 파일 업로드</button>
          <button onClick={() => setShowPreset(true)} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">고정지출 불러오기</button>
          <button onClick={() => { setShowForm(!showForm); setEditId(null); setForm(makeEmptyForm()) }} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ 새 항목</button>
        </div>
      </div>

      {/* 기간 필터 */}
      <div className="flex gap-2 mb-4">
        <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          {getYearOptions().map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg">
          {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>

      {/* 입력 폼 */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
              <input type="date" value={form.date} onChange={e => setForm(f=>({...f, date: e.target.value}))} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">분류</label>
              <div className="flex gap-2">
                {(['수입','지출'] as const).map(ct => (
                  <button key={ct} type="button" onClick={() => handleClassChange(ct)}
                    className={`flex-1 py-2 text-sm rounded-lg border ${form.class === ct ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                    {ct}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">카테고리 <span className="text-red-500">*</span></label>
              <select value={form.category} onChange={e => setForm(f=>({...f, category: e.target.value, subcategory: ''}))} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                {(CATEGORIES[form.class as '수입' | '지출'] ?? []).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">세부카테고리</label>
              <select value={form.subcategory} onChange={e => setForm(f=>({...f, subcategory: e.target.value}))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
                <option value="">선택 안함</option>
                {(SUBCATEGORIES[form.category] ?? []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">항목명</label>
              <input type="text" value={form.item} onChange={e => setForm(f=>({...f, item: e.target.value}))} placeholder="선택 입력" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">금액 (원)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f=>({...f, amount: e.target.value}))} required min="0" placeholder="0" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
              <input type="text" value={form.memo} onChange={e => setForm(f=>({...f, memo: e.target.value}))} placeholder="선택 입력" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">사용자</label>
              <div className="flex gap-1 flex-wrap">
                {USER_NAMES.map(u => (
                  <button key={u} type="button" onClick={() => setForm(f=>({...f, user_name: u}))}
                    className={`px-3 py-1.5 text-xs rounded-lg border ${form.user_name === u ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">태그</label>
              <TagInput value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} existingTags={allTags} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(makeEmptyForm()) }} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg">취소</button>
            <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700">{editId ? '수정' : '저장'}</button>
          </div>
        </form>
      )}

      {/* 월 합계 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '수입', value: income, color: 'text-blue-600' },
          { label: '지출', value: expense, color: 'text-red-600' },
          { label: '저축', value: income - expense, color: income - expense >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`text-lg font-semibold ${color}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white">
          {['전체','수입','지출','이체'].map(v => <option key={v} value={v}>{v === '전체' ? '분류 전체' : v}</option>)}
        </select>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white">
          {categoryOptions.map(v => <option key={v} value={v}>{v === '전체' ? '카테고리 전체' : v}</option>)}
        </select>
        <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white">
          {['전체', ...USER_NAMES].map(v => <option key={v} value={v}>{v === '전체' ? '사용자 전체' : v}</option>)}
        </select>
        <input
          type="text" value={filterKeyword} onChange={e => setFilterKeyword(e.target.value)}
          placeholder="항목명/세부/메모 검색..."
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white flex-1 min-w-40"
        />
        {(filterClass !== '전체' || filterCategory !== '전체' || filterUser !== '전체' || filterKeyword) && (
          <button onClick={() => { setFilterClass('전체'); setFilterCategory('전체'); setFilterUser('전체'); setFilterKeyword('') }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">
            필터 초기화
          </button>
        )}
        <span className="px-2 py-1.5 text-xs text-gray-400">{filtered.length} / {transactions.length}건</span>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">로딩 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            {transactions.length === 0 ? '이 기간에 데이터가 없어요' : '필터 조건에 맞는 항목이 없어요'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['날짜','분류','카테고리','세부카테고리','항목명','사용자','금액','메모','태그',''].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{formatDate(t.date)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CLASS_BADGE[t.class] ?? 'bg-gray-100 text-gray-600'}`}>
                        {t.class}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 text-xs">{t.category || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{t.subcategory || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">{t.item || '-'}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs">{t.user_name}</td>
                    <td className={`px-3 py-2.5 font-medium text-xs ${CLASS_AMOUNT[t.class] ?? 'text-gray-600'}`}>
                      {t.class === '수입' ? '+' : t.class === '지출' ? '-' : ''}{formatCurrency(t.amount)}
                    </td>
                    {/* 메모: 내용 있으면 truncate + hover 시 전체 내용 표시 */}
                    <td className="px-3 py-2.5 text-xs max-w-36">
                      {t.memo ? (
                        <span
                          title={t.memo}
                          className="block truncate text-gray-500 cursor-help border-b border-dotted border-gray-300"
                        >
                          {t.memo}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 max-w-40">
                      {normalizeTags(t.tags).length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {normalizeTags(t.tags).map(tag => (
                            <span key={tag} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full whitespace-nowrap">{tag}</span>
                          ))}
                        </div>
                      ) : <span className="text-gray-300 text-xs">-</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(t)} className="text-xs text-blue-600 hover:underline">수정</button>
                        <button onClick={() => setDeleteId(t.id)} className="text-xs text-red-500 hover:underline">삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteId && <ConfirmModal message="이 항목을 삭제할까요? (복구 가능)" onConfirm={() => handleDelete(deleteId)} onCancel={() => setDeleteId(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSuccess={count => { setShowImport(false); fetchData(); setToast({ message: `${count}개 항목이 저장되었습니다`, type: 'success' }) }} />}
      {showPreset && <PresetModal year={year} month={month} onClose={() => setShowPreset(false)} onSuccess={() => { setShowPreset(false); fetchData(); setToast({ message: '고정지출이 등록되었습니다', type: 'success' }) }} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
