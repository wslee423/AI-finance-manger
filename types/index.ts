export type ClassType = '수입' | '지출' | '이체'
export type UserName = '운섭' | '아름' | '희온' | '공동'
export type AssetOwner = '운섭' | '아름' | '공동'
export type AssetType = '부동산' | '통장' | '연금' | '예적금' | '기타' | '대출'

export interface Transaction {
  id: string
  date: string
  class_type: ClassType
  category: string
  subcategory: string | null
  item: string | null
  user_name: UserName
  memo: string | null
  amount: number
  tags: string[] | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Asset {
  id: string
  snapshot_date: string
  asset_type: AssetType
  institution: string
  owner: AssetOwner
  balance: number
  contribution_rate: number | null
  memo: string | null
  created_at: string
}

export interface Dividend {
  id: string
  date: string
  account: string | null
  ticker_name: string
  ticker_symbol: string | null
  exchange_rate: number | null
  usd_amount: number | null
  krw_amount: number
  created_at: string
}

export interface PresetTemplate {
  id: string
  name: string
  category: string
  subcategory: string | null
  item: string | null
  user_name: UserName
  memo: string | null
  amount: number
  sort_order: number
  is_active: boolean
}

// 카테고리 정의
// 신규 입력 폼에서는 수입/지출만 선택 (이체는 파일 업로드로만 입력)
export const CATEGORIES: Record<'수입' | '지출', string[]> = {
  수입: ['주수입', '기타수입'],
  지출: ['고정지출', '변동지출', '기타지출'],
}

export const SUBCATEGORIES: Record<string, string[]> = {
  주수입: ['월급', '성과금', '상여금'],
  기타수입: ['양육수당', '보험금', '중고판매', '기타'],
  고정지출: ['보험', '용돈', '관리비', '통신비', '구독/멤버십', '교통/차량'],
  변동지출: ['마트/편의점', '외식비', '의류/미용', '여가비', '병원비', '기타'],
  기타지출: ['경조사', '기타'],
}

export const USER_NAMES: UserName[] = ['운섭', '아름', '희온', '공동']
export const ASSET_OWNERS: AssetOwner[] = ['운섭', '아름', '공동']
