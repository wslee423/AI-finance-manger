import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

type ImportRow = {
  row: number
  date: string
  class: string
  category: string
  subcategory: string | null
  item: string | null
  user_name: string | null
  amount: number
  memo: string | null
  error?: string
}

const VALID_USERS = ['운섭', '아름', '희온', '공동']

function toDateStr(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  const str = String(value).trim()
  // YYYY-MM-DD 또는 YYYY.MM.DD 처리
  return str.replace(/\./g, '-').split('T')[0]
}

function normalizeCategory(type: unknown): string {
  const t = String(type ?? '').trim()
  if (t === '부수입') return '기타수입'
  return t
}

function normalizeUser(user: unknown): string | null {
  const u = String(user ?? '').trim()
  return VALID_USERS.includes(u) ? u : null
}

// 지원 컬럼명 (기존 구글시트 형식 + 간편 형식 모두)
function getField(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key]
  }
  return null
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const mode = formData.get('mode') as string // 'preview' | 'confirm'
  const confirmedJson = formData.get('rows') as string | null

  if (!file && mode !== 'confirm') {
    return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 })
  }

  // confirm 모드: 미리보기에서 확인한 데이터 바로 저장
  if (mode === 'confirm' && confirmedJson) {
    let rows: ImportRow[]
    try {
      rows = JSON.parse(confirmedJson) as ImportRow[]
    } catch {
      return NextResponse.json({ error: '데이터 형식이 올바르지 않습니다' }, { status: 400 })
    }
    const valid = rows.filter(r => !r.error)
    if (valid.length === 0) return NextResponse.json({ error: '저장할 유효한 데이터가 없습니다' }, { status: 400 })

    const { data, error } = await supabase.from('transactions').insert(
      valid.map(r => ({
        date: r.date,
        class: r.class,
        category: r.category,
        subcategory: r.subcategory,
        item: r.item,
        user_name: r.user_name,
        amount: r.amount,
        memo: r.memo,
      }))
    ).select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ saved: data?.length ?? 0 })
  }

  // preview 모드: 파일 파싱 후 미리보기 반환
  const buffer = await file!.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheetName = wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null })

  const result: ImportRow[] = []

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i]
    const rowNum = i + 2

    const classVal = String(getField(raw, 'class', '분류', 'class') ?? '').trim()
    if (classVal === '이체' || classVal === '') continue
    if (classVal !== '수입' && classVal !== '지출') {
      result.push({ row: rowNum, date: '', class: classVal, category: '', subcategory: null, item: null, user_name: '', amount: 0, memo: null, error: `분류값 오류: "${classVal}"` })
      continue
    }

    const dateStr = toDateStr(getField(raw, 'date', '날짜'))
    if (!dateStr) {
      result.push({ row: rowNum, date: '', class: classVal, category: '', subcategory: null, item: null, user_name: '', amount: 0, memo: null, error: '날짜 오류' })
      continue
    }

    const amount = Math.round(Number(getField(raw, 'amount', '금액') ?? 0))
    if (amount <= 0) {
      result.push({ row: rowNum, date: dateStr, class: classVal, category: '', subcategory: null, item: null, user_name: '', amount: 0, memo: null, error: '금액 오류 (0 이하)' })
      continue
    }

    result.push({
      row: rowNum,
      date: dateStr,
      class: classVal,
      category: normalizeCategory(getField(raw, 'type', '카테고리', 'category')),
      subcategory: getField(raw, 'category', '세부카테고리', 'subcategory') ? String(getField(raw, 'category', '세부카테고리', 'subcategory')).trim() : null,
      item: getField(raw, 'subcategory', '항목명', 'item') ? String(getField(raw, 'subcategory', '항목명', 'item')).trim() : null,
      user_name: normalizeUser(getField(raw, 'user', '사용자', 'user_name')),
      amount,
      memo: getField(raw, 'memo', '메모') ? String(getField(raw, 'memo', '메모')).trim() : null,
    })
  }

  return NextResponse.json({
    total: result.length,
    valid: result.filter(r => !r.error).length,
    errors: result.filter(r => r.error).length,
    rows: result,
  })
}
