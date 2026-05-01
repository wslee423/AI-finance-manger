import * as Sentry from '@sentry/nextjs'

export function assertDemoSafe(): void {
  if (process.env.APP_MODE !== 'demo') return
  // Demo 모드인데 NEXT_PUBLIC_APP_MODE와 불일치하면 설정 오류
  if (process.env.NEXT_PUBLIC_APP_MODE !== 'demo') {
    const err = new Error('[DEMO GUARD] APP_MODE=demo인데 NEXT_PUBLIC_APP_MODE가 demo가 아닙니다')
    Sentry.captureException(err)
    throw err
  }
}
