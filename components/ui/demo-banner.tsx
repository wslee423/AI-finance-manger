export default function DemoBanner() {
  if (process.env.NEXT_PUBLIC_APP_MODE !== 'demo') return null

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-400 text-amber-900 text-center text-sm font-semibold py-2 px-4">
      DEMO DATA — 실제 개인 재정 데이터가 아닌 샘플 데이터입니다
    </div>
  )
}
