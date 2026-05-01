/**
 * scripts/import-demo-data.ts
 * ai_finance_demo_data_2023_2025.xlsx → Supabase demo schema
 *
 * 실행:
 *   npx tsx scripts/import-demo-data.ts --dry-run   # 검증만 (DB 변경 없음)
 *   npx tsx scripts/import-demo-data.ts              # 실제 import
 */

import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const XLSX_PATH = path.resolve(__dirname, '../../ai_finance_demo_data_2023_2025.xlsx')
const isDryRun = process.argv.includes('--dry-run')
const BATCH_SIZE = 200

// ── 날짜 변환 ──────────────────────────────────────────────
function excelDateToISO(serial: number): string {
  const date = new Date((serial - 25569) * 86400 * 1000)
  return date.toISOString().split('T')[0]
}

// ── 사용자명 매핑 ──────────────────────────────────────────
const USER_MAP: Record<string, string> = {
  '공동': 'Shared',
  '아빠': 'Owner',
  '엄마': 'Spouse',
  '아이': 'Child',
}
// assets.owner 에는 'Child' check constraint 없음 → 'Shared' 처리
const OWNER_MAP: Record<string, string> = {
  '공동': 'Shared',
  '아빠': 'Owner',
  '엄마': 'Spouse',
  '아이': 'Shared',
}

// ── tags 파싱 ──────────────────────────────────────────────
function parseTags(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(/\s+/)
    .filter(t => t.startsWith('#'))
    .map(t => t.slice(1))
    .filter(Boolean)
}

// ── Supabase client (demo schema) ─────────────────────────
function createDemoClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('.env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
  return createClient(url, key, { db: { schema: 'demo' } })
}

// ── 배치 insert ────────────────────────────────────────────
async function batchInsert<T extends object>(
  supabase: ReturnType<typeof createDemoClient>,
  table: string,
  rows: T[]
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    if (isDryRun) {
      console.log(`  [dry-run] ${table} ${i + 1}~${i + batch.length} 행`)
      continue
    }
    const { error } = await supabase.from(table).insert(batch)
    if (error) throw new Error(`${table} insert 실패 (${i}~): ${error.message}`)
    console.log(`  ✓ ${table} ${i + 1}~${i + batch.length} 완료`)
  }
}

// ── Transactions import ────────────────────────────────────
async function importTransactions(supabase: ReturnType<typeof createDemoClient>, wb: XLSX.WorkBook) {
  const ws = wb.Sheets['Transactions']
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  const rows = raw.map(r => ({
    date:       excelDateToISO(r.date as number),
    class:      r.class as string,
    type:       r.type as string,
    category:   (r.category as string) || null,
    subcategory:(r.subcategory as string) || null,
    item:       (r.item as string) || null,
    amount:     Number(r.amount) || 0,
    payment:    (r.payment as string) || null,
    user_name:  USER_MAP[r.user as string] ?? null,
    memo:       (r.memo as string) || null,
    tags:       parseTags(r.tags as string),
  }))

  console.log(`\ntransactions: ${rows.length}건 import`)
  if (!isDryRun) {
    const { error } = await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`transactions 초기화 실패: ${error.message}`)
  }
  await batchInsert(supabase, 'transactions', rows)
}

// ── Assets import ──────────────────────────────────────────
async function importAssets(supabase: ReturnType<typeof createDemoClient>, wb: XLSX.WorkBook) {
  const ws = wb.Sheets['assets']
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  const rows = raw.map(r => ({
    snapshot_date: excelDateToISO(r.date as number),
    asset_type:    r.category as string,
    assettype:     (r.assettype as string) || null,
    institution:   (r.institution as string) || null,
    balance:       Number(r.balance) || 0,
    owner:         OWNER_MAP[r.owner as string] ?? 'Shared',
    memo:          (r.memo as string) || null,
  }))

  console.log(`\nassets: ${rows.length}건 import`)
  if (!isDryRun) {
    const { error } = await supabase.from('assets').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`assets 초기화 실패: ${error.message}`)
  }
  await batchInsert(supabase, 'assets', rows)
}

// ── Dividend import ────────────────────────────────────────
async function importDividend(supabase: ReturnType<typeof createDemoClient>, wb: XLSX.WorkBook) {
  const ws = wb.Sheets['dividend']
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

  const rows = raw.map(r => ({
    date:          excelDateToISO(r.date as number),
    account:       (r.account as string) || null,
    ticker_name:   r.ticker_name as string,
    ticker_symbol: (r.ticker as string) || null,
    exchange_rate: r.day_usd ? Number(r.day_usd) : null,
    usd_amount:    r.usd_dividend ? Number(r.usd_dividend) : null,
    krw_amount:    Number(r.krw_dividend) || 0,
  }))

  console.log(`\ndividend: ${rows.length}건 import`)
  if (!isDryRun) {
    const { error } = await supabase.from('dividend').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw new Error(`dividend 초기화 실패: ${error.message}`)
  }
  await batchInsert(supabase, 'dividend', rows)
}

// ── Main ───────────────────────────────────────────────────
async function main() {
  console.log(isDryRun ? '=== DRY RUN (DB 변경 없음) ===' : '=== Demo 데이터 Import ===')
  console.log(`파일: ${XLSX_PATH}`)

  const wb = XLSX.readFile(XLSX_PATH)
  console.log(`시트: ${wb.SheetNames.join(', ')}`)

  const supabase = createDemoClient()

  await importTransactions(supabase, wb)
  await importAssets(supabase, wb)
  await importDividend(supabase, wb)

  console.log('\n✅ 완료')
}

main().catch(err => {
  console.error('\n❌ 오류:', err.message)
  process.exit(1)
})
