/**
 * scripts/migrate.ts
 * finance_table.xlsx → Supabase 1회성 마이그레이션 스크립트
 *
 * 실행:
 *   npx tsx scripts/migrate.ts --dry-run            # 검증만 (DB 변경 없음)
 *   npx tsx scripts/migrate.ts                      # 전체 마이그레이션
 *   npx tsx scripts/migrate.ts --sheet=transactions # 특정 시트만
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

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
  const s = String(value).split('T')[0]
  return s.length >= 10 ? s : null
}

function toMonthLastDay(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}

function toAmount(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  return Math.abs(Math.round(Number(value)))
}

function str(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  const s = String(value).trim()
  return s || null
}

// 엑셀 한글 이름 → DB 영문 user_name
function toUserName(user: unknown): string {
  const u = String(user ?? '').trim()
  if (u === '운섭') return 'Owner'
  if (u === '아름') return 'Spouse'
  if (u === '희온') return 'Child'
  return 'Shared'
}

// 엑셀 한글 owner → DB 영문 owner
function toOwner(owner: unknown): string {
  const o = String(owner ?? '').trim()
  if (o === '운섭') return 'Owner'
  if (o === '아름') return 'Spouse'
  if (o === '공동') return 'Shared'
  return 'Shared'
}

function parseTags(value: unknown): string[] | null {
  if (!value) return null
  const s = String(value).trim()
  const tags = s.split(',').map(t => t.trim()).filter(Boolean)
  return tags.length > 0 ? tags : null
}

// ─── Transactions ─────────────────────────────────────────────────────────────

async function migrateTransactions(wb: XLSX.WorkBook) {
  console.log('\n=== Transactions 마이그레이션 시작 ===')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['Transactions'], { defval: null })
  console.log(`  엑셀 전체 행 수: ${rows.length}`)

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0
  const skipReasons: string[] = []

  for (const row of rows) {
    const classVal = str(row['class'])
    const typeVal  = str(row['type'])
    const dateStr  = toDateStr(row['date'])
    const amount   = toAmount(row['amount'])

    if (!classVal || !dateStr) {
      skipped++
      skipReasons.push(`date=${row['date']}, class=${row['class']}`)
      continue
    }
    if (!typeVal) {
      skipped++
      skipReasons.push(`type 없음: date=${dateStr}`)
      continue
    }

    toInsert.push({
      date:        dateStr,
      class:       classVal,                    // 수입/지출/이체
      type:        typeVal,                     // 주수입/고정지출/변동지출/기타수입/기타지출/부수입
      category:    str(row['category']),        // 월급/외식비/보험 등
      subcategory: str(row['subcategory']),     // 세부항목
      item:        str(row['item']),            // 더 세부항목
      amount,
      payment:     str(row['payment']),         // 결제수단
      user_name:   toUserName(row['user']),
      memo:        str(row['memo']),
      tags:        parseTags(row['tags']),
    })
  }

  console.log(`  삽입 예정: ${toInsert.length}건 / 제외: ${skipped}건`)
  if (skipReasons.length > 0 && isDryRun) {
    console.log('  제외 이유 (처음 5개):')
    skipReasons.slice(0, 5).forEach(r => console.log(`    - ${r}`))
  }

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
      if (isDryRun === false) {
        console.error('  첫 번째 행:', JSON.stringify(batch[0]))
      }
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
  console.log(`  엑셀 전체 행 수: ${rows.length}`)

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const year  = Number(row['year'])
    const month = Number(row['month'])
    const institution = str(row['institution'])

    if (!year || !month || isNaN(year) || isNaN(month)) { skipped++; continue }

    toInsert.push({
      snapshot_date:    toMonthLastDay(year, month),
      asset_type:       str(row['category']) ?? '기타',  // 부동산/통장/연금/예적금/기타/대출
      assettype:        str(row['assettype']),            // 신용대출/퇴직금DC/CMA 등
      institution:      str(row['institution']),          // 국민은행/k뱅크 등 (현금은 null)
      balance:          Math.round(Number(row['balance'] ?? 0)),
      owner:            toOwner(row['owner']),
      contribution_rate: null,
      memo:             str(row['memo']),
    })
  }

  console.log(`  삽입 예정: ${toInsert.length}건 / 제외: ${skipped}건`)

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
      console.error('  첫 번째 행:', JSON.stringify(batch[0]))
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
  console.log(`  엑셀 전체 행 수: ${rows.length}`)

  const toInsert: Record<string, unknown>[] = []
  let skipped = 0

  for (const row of rows) {
    const dateStr  = toDateStr(row['date'])
    const krwAmount = toAmount(row['krw_quivalent'] ?? row['krw_dividend'])

    if (!dateStr) { skipped++; continue }  // date 없는 완전히 빈 행만 제외

    toInsert.push({
      date:          dateStr,
      account:       str(row['account']),
      ticker_name:   str(row['ticker_name']) ?? str(row['ticker']) ?? '',
      ticker_symbol: str(row['ticker']),
      exchange_rate: row['day_usd'] ? Number(row['day_usd']) : null,
      usd_amount:    row['usd_dividend'] ? Number(row['usd_dividend']) : null,
      krw_amount:    krwAmount,
    })
  }

  console.log(`  삽입 예정: ${toInsert.length}건 / 제외: ${skipped}건`)

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

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('\n❌ 환경변수 누락: .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
    process.exit(1)
  }

  const wb = XLSX.readFile(XLSX_PATH)
  console.log(`\n시트 목록: ${wb.SheetNames.join(', ')}`)

  const results: Record<string, number> = {}
  if (!targetSheet || targetSheet === 'transactions') results.transactions = await migrateTransactions(wb)
  if (!targetSheet || targetSheet === 'assets')       results.assets       = await migrateAssets(wb)
  if (!targetSheet || targetSheet === 'dividend')     results.dividend     = await migrateDividend(wb)

  console.log('\n=== 마이그레이션 완료 ===')
  Object.entries(results).forEach(([sheet, count]) => console.log(`  ${sheet}: ${count}건`))
  if (!isDryRun) console.log('\n✅ 완료.')
}

main().catch(err => {
  console.error('\n❌ 마이그레이션 실패:', err)
  process.exit(1)
})
