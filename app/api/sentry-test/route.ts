import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

export async function GET() {
  const error = new Error('Sentry 연동 테스트 에러')
  Sentry.captureException(error)
  await Sentry.flush(2000)
  return NextResponse.json({ error: 'test' }, { status: 500 })
}
