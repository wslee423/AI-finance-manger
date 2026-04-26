/**
 * scripts/migrate.ts
 * finance_table.xlsx → Supabase 1회성 마이그레이션 스크립트
 *
 * 실행:
 *   npx tsx scripts/migrate.ts --dry-run    # 검증만 (DB 변경 없음)
 *   npx tsx scripts/migrate.ts              # 실제 마이그레이션
 *   npx tsx scripts/migrate.ts --sheet=transactions
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'

const XLSX_PATH = path.resolve(__dirname, '../../finance_table.xlsx')
const isDryRun = process.argv.includes('--dry-run')
const targetSheet = process.argv.find(a => a.startsWith('--sheet='))?.split('=')[1]

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

function toDateStr(value: unknown): string | null {
  if (!value) return null
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value)
    return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  return String(value).split('T')[0]
}

function toMonthLastDay(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function toAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  return Math.round(Number(value))
}

function normalizeUser(user: unknown): string {
  const u = String(user ?? '').trim()
  return ['운섭', '아름', '희온', '공동'].includes(u) ? u : '공동'
}

function normalizeCategory(type: unknown): string {
  const t = String(type ?? '').trim()
  return t === '부수입' ? '기타수입' : t
}

function parseTags(value: unknown): string[] | null {
  if (!value) return null
  const str = String(value).trim()
  return str ? str.split(',').map(t => t.trim()).filter(Boolean) : null
}

// ─── Transactions ─────────────────────────────────────────────────────────────

async function migrateTransactions(wb: XLSX.WorkBook) {
  console.log('\n=== Transactions 마이그레이션 시작 ===')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Transactions'], { defval: null })

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const classVal = String(row['class'] ?? '').trim()
    const dateStr = toDateStr(row['date'])

    // DB 저장 불가한 행만 제외 (class 없음, 날짜 없음)
    if (!classVal || !dateStr) { skipped++; continue }

    toInsert.push({
      date: dateStr,
      class_type: classVal,
      category: normalizeCategory(row['type']),
      subcategory: row['category'] ? String(row['category']).trim() : null,
      item: row['subcategory'] ? String(row['subcategory']).trim() : null,
      user_name: normalizeUser(row['user']),
      amount: toAmount(row['amount']),
      memo: row['memo'] ? String(row['memo']).trim() : null,
      tags: parseTags(row['tags']),
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  처리 예정: ${toInsert.length}건 / 제외: ${skipped}건`)

  if (isDryRun) {
    console.log('  [DRY RUN] 샘플 3건:')
    toInsert.slice(0, 3).forEach(r => console.log(' ', JSON.stringify(r)))
    return toInsert.length
  }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { error } = await supabase.from('transactions').insert(batch)
    if (error) {
      console.error(`  배치 ${i}~${i + batch.length} 오류:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`  진행: ${inserted}/${toInsert.length}\r`)
    }
  }

  console.log(`\n  완료: ${inserted}건 삽입`)
  return inserted
}

// ─── Assets ───────────────────────────────────────────────────────────────────

async function migrateAssets(wb: XLSX.WorkBook) {
  console.log('\n=== Assets 마이그레이션 시작 ===')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['assets'], { defval: null })

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const year = Number(row['year'])
    const month = Number(row['month'])

    // snapshot_date 계산 불가한 행만 제외
    if (!year || !month || isNaN(year) || isNaN(month)) { skipped++; continue }

    const memo = row['institution'] ? String(row['institution']).trim() : null

    toInsert.push({
      snapshot_date: toMonthLastDay(year, month),
      asset_type: String(row['category'] ?? '').trim(),
      institution: String(row['assettype'] ?? '').trim(),
      owner: normalizeUser(row['owner']),
      balance: toAmount(row['balance']),
      contribution_rate: null,
      created_at: new Date().toISOString(),
      ...(memo && { memo }),
    })
  }

  console.log(`  처리 예정: ${toInsert.length}건 / 제외: ${skipped}건`)

  if (isDryRun) {
    console.log('  [DRY RUN] 샘플 3건:')
    toInsert.slice(0, 3).forEach(r => console.log(' ', JSON.stringify(r)))
    return toInsert.length
  }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { error } = await supabase.from('assets').insert(batch)
    if (error) {
      console.error(`  배치 오류:`, error.message)
    } else {
      inserted += batch.length
      process.stdout.write(`  진행: ${inserted}/${toInsert.length}\r`)
    }
  }

  console.log(`\n  완료: ${inserted}건 삽입`)
  return inserted
}

// ─── Dividend ─────────────────────────────────────────────────────────────────

async function migrateDividend(wb: XLSX.WorkBook) {
  console.log('\n=== Dividend 마이그레이션 시작 ===')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['dividend'], { defval: null })

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const dateStr = toDateStr(row['date'])
    const krwAmount = toAmount(row['krw_quivalent'] ?? row['krw_dividend'])

    // 날짜 없음 또는 원화금액 없음은 저장 불가
    if (!dateStr || krwAmount <= 0) { skipped++; continue }

    toInsert.push({
      date: dateStr,
      account: row['account'] ? String(row['account']).trim() : null,
      ticker_name: row['ticker_name'] ? String(row['ticker_name']).trim() : (row['ticker'] ? String(row['ticker']).trim() : ''),
      ticker_symbol: row['ticker'] !== null ? String(row['ticker']).trim() : null,
      exchange_rate: row['day_usd'] ? Number(row['day_usd']) : null,
      usd_amount: row['usd_dividend'] ? Number(row['usd_dividend']) : null,
      krw_amount: krwAmount,
      created_at: new Date().toISOString(),
    })
  }

  console.log(`  처리 예정: ${toInsert.length}건 / 제외: ${skipped}건`)

  if (isDryRun) {
    console.log('  [DRY RUN] 샘플 3건:')
    toInsert.slice(0, 3).forEach(r => console.log(' ', JSON.stringify(r)))
    return toInsert.length
  }

  let inserted = 0
  for (let i = 0; i < toInsert.length; i += 100) {
    const batch = toInsert.slice(i, i + 100)
    const { error } = await supabase.from('dividend').insert(batch)
    if (error) {
      console.error(`  배치 오류:`, error.message)
    } else {
      inserted += batch.length
    }
  }

  console.log(`  완료: ${inserted}건 삽입`)
  return inserted
}

// ─── 메인 ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nAI Finance Management — 마이그레이션 스크립트`)
  console.log(`소스: ${XLSX_PATH}`)
  console.log(`모드: ${isDryRun ? '🔍 DRY RUN (DB 변경 없음)' : '🚀 실제 실행'}`)
  console.log(`대상: ${targetSheet ?? '전체 시트'}`)

  if (!isDryRun && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    console.error('\n❌ 환경변수 누락: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
    process.exit(1)
  }

  const wb = XLSX.readFile(XLSX_PATH)
  console.log(`\n시트 목록: ${wb.SheetNames.join(', ')}`)

  const results: Record<string, number> = {}
  if (!targetSheet || targetSheet === 'transactions') results.transactions = await migrateTransactions(wb)
  if (!targetSheet || targetSheet === 'assets') results.assets = await migrateAssets(wb)
  if (!targetSheet || targetSheet === 'dividend') results.dividend = await migrateDividend(wb)

  console.log('\n=== 마이그레이션 완료 ===')
  Object.entries(results).forEach(([sheet, count]) => console.log(`  ${sheet}: ${count}건`))

  if (!isDryRun) console.log('\n✅ 완료.')
}

main().catch(err => {
  console.error('\n❌ 마이그레이션 실패:', err)
  process.exit(1)
})
