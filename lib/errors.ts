import * as Sentry from '@sentry/nextjs'

interface ErrorContext {
  route: string
  feature: string
  userId?: string
}

export const USER_ERROR_MESSAGE = '문제가 발생했습니다. 잠시 후 다시 시도해주세요.'

export function captureError(error: unknown, ctx: ErrorContext): string {
  const errorId = Math.random().toString(36).slice(2, 10).toUpperCase()

  Sentry.withScope((scope) => {
    scope.setTag('route', ctx.route)
    scope.setTag('feature', ctx.feature)
    if (ctx.userId) scope.setUser({ id: ctx.userId })
    scope.setExtra('errorId', errorId)
    Sentry.captureException(error)
  })

  return errorId
}

// production 전용: 서버 에러를 Telegram 운영 채널로 알림
export async function notifyTelegramOps(errorId: string, route: string): Promise<void> {
  if (process.env.NODE_ENV !== 'production') return
  const chatId = process.env.TELEGRAM_OPS_CHAT_ID
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!chatId || !token) return

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: `🚨 서버 오류\nRoute: ${route}\nID: ${errorId}`,
    }),
  }).catch(() => {})
}
