'use client'

import { useState, useRef } from 'react'
import { formatCurrency } from '@/lib/utils'

interface ImportRow {
  row: number
  date: string
  class_type: string
  category: string
  subcategory: string | null
  item: string | null
  user_name: string
  amount: number
  memo: string | null
  error?: string
}

interface ImportResult {
  total: number
  valid: number
  errors: number
  rows: ImportRow[]
}

interface ImportModalProps {
  onClose: () => void
  onSuccess: (count: number) => void
}

export default function ImportModal({ onClose, onSuccess }: ImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMsg('xlsx, xls, csv 파일만 지원합니다')
      return
    }
    setErrorMsg(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('mode', 'preview')
      const res = await fetch('/api/transactions/import', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('파싱 실패')
      const data: ImportResult = await res.json()
      setResult(data)
      setStep('preview')
    } catch {
      setErrorMsg('파일 파싱에 실패했습니다. 파일 형식을 확인해주세요.')
    } finally {
      setUploading(false)
    }
  }

  async function handleConfirm() {
    if (!result) return
    const valid = result.rows.filter(r => !r.error)
    if (valid.length === 0) return

    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('mode', 'confirm')
      fd.append('rows', JSON.stringify(valid))
      const res = await fetch('/api/transactions/import', { method: 'POST', body: fd })
      if (!res.ok) throw new Error()
      const { saved } = await res.json()
      onSuccess(saved)
    } catch {
      setErrorMsg('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="font-semibold text-gray-900">파일로 일괄 입력</h2>
            <p className="text-xs text-gray-500 mt-0.5">Excel(.xlsx) 또는 CSV 파일을 업로드하세요</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {/* Step 1: 업로드 */}
        {step === 'upload' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f) }}
              onClick={() => fileRef.current?.click()}
              className={`w-full max-w-md border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
            >
              <span className="text-4xl">📂</span>
              <p className="text-sm font-medium text-gray-700">파일을 드래그하거나 클릭해서 선택</p>
              <p className="text-xs text-gray-400">.xlsx / .xls / .csv 지원</p>
              {uploading && <p className="text-xs text-blue-600 mt-2">파싱 중...</p>}
            {errorMsg && <p className="text-xs text-red-600 mt-2">{errorMsg}</p>}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />

            {/* 지원 컬럼 안내 */}
            <div className="w-full max-w-md bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
              <p className="font-medium mb-2 text-gray-700">지원하는 컬럼명</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  ['날짜', 'date / 날짜'],
                  ['분류', 'class / 분류 (수입/지출)'],
                  ['카테고리', 'type / 카테고리'],
                  ['세부카테고리', 'category / 세부카테고리'],
                  ['항목명', 'subcategory / 항목명'],
                  ['사용자', 'user / 사용자'],
                  ['금액', 'amount / 금액'],
                  ['메모', 'memo / 메모'],
                ].map(([label, cols]) => (
                  <div key={label}>
                    <span className="text-gray-500">{label}: </span>
                    <span className="text-gray-700">{cols}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 미리보기 */}
        {step === 'preview' && result && (
          <>
            {/* 요약 */}
            <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-4 bg-gray-50">
              <span className="text-sm text-gray-600">전체 <strong>{result.total}</strong>행</span>
              <span className="text-sm text-green-700">유효 <strong>{result.valid}</strong>행</span>
              {result.errors > 0 && (
                <span className="text-sm text-red-600">오류 <strong>{result.errors}</strong>행</span>
              )}
              <button onClick={() => setStep('upload')} className="ml-auto text-xs text-blue-600 hover:underline">← 파일 다시 선택</button>
            </div>

            {/* 오류 행 토글 */}
            {result.errors > 0 && (
              <div className="px-5 py-2 border-b border-gray-100">
                <button onClick={() => setShowErrors(!showErrors)} className="text-xs text-amber-600 hover:underline">
                  {showErrors ? '▲ 오류 행 숨기기' : `▼ 오류 행 ${result.errors}개 보기`}
                </button>
              </div>
            )}

            {/* 미리보기 테이블 */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['행', '날짜', '분류', '카테고리', '세부', '사용자', '금액', '메모'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 border-b border-gray-200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.rows
                    .filter(r => showErrors || !r.error)
                    .map(r => (
                      <tr key={r.row} className={r.error ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-3 py-2 text-gray-400">{r.row}</td>
                        <td className="px-3 py-2 text-gray-700">{r.date}</td>
                        <td className="px-3 py-2">
                          {r.error ? (
                            <span className="text-red-600 text-xs">{r.error}</span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-xs ${r.class_type === '수입' ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
                              {r.class_type}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700">{r.category}</td>
                        <td className="px-3 py-2 text-gray-500">{r.subcategory ?? '-'}</td>
                        <td className="px-3 py-2 text-gray-500">{r.user_name}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-800">{r.amount > 0 ? formatCurrency(r.amount) : '-'}</td>
                        <td className="px-3 py-2 text-gray-400 max-w-24 truncate">{r.memo ?? '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* 저장 버튼 */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200">
              <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">취소</button>
              <button onClick={handleConfirm} disabled={saving || result.valid === 0}
                className="flex-1 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {saving ? '저장 중...' : `${result.valid}개 저장`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
