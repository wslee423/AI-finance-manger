import { captureError, USER_ERROR_MESSAGE } from '@/lib/errors'
import { askAgent } from '@/lib/openai/agent'

async function sendMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN!
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  })
}

function getAllowedIds(): string[] {
  return (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

async function handleCommand(command: string): Promise<string> {
  switch (command) {
    case '/start':
      return '안녕하세요! AI 재정 비서입니다 👋\n\n자연어로 재정 질문을 하거나 아래 명령어를 사용하세요.\n\n/summary — 이번달 재정 요약\n/assets — 현재 순자산\n/dividend — 배당금 현황\n/help — 질문 예시'
    case '/summary':
      return askAgent('이번달 수입, 지출, 저축률 요약해줘')
    case '/assets':
      return askAgent('현재 순자산 얼마야?')
    case '/dividend':
      return askAgent('이번달 배당금이랑 올해 총 배당금 알려줘')
    case '/help':
      return '💬 이렇게 물어보세요:\n\n• 지난달 외식비 얼마야?\n• 올해 경조사 지출 총얼마야?\n• 배당금 월 100만원 목표 달성했어?\n• 현재 순자산 변화 보여줘\n• 이번달 카테고리별 지출 비율 알려줘'
    default:
      return askAgent(command)
  }
}

export async function POST(request: Request) {
  let chatId: number | undefined

  try {
    const body = await request.json() as {
      message?: { chat: { id: number }; text?: string }
    }

    const message = body.message
    if (!message?.text) return Response.json({ ok: true })

    chatId = message.chat.id
    const allowedIds = getAllowedIds()

    if (!allowedIds.includes(String(chatId))) return Response.json({ ok: true })

    const text = message.text.trim()
    const reply = await handleCommand(text.startsWith('/') ? text.split(' ')[0] : text)
    await sendMessage(chatId, reply)
  } catch (err) {
    const errorId = captureError(err, { route: '/api/telegram', feature: 'telegram-bot' })
    if (chatId) await sendMessage(chatId, `${USER_ERROR_MESSAGE} (ID: ${errorId})`).catch(() => {})
  }

  return Response.json({ ok: true })
}
