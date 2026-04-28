import { getAuthUser, unauthorized } from '@/lib/api'
import { getSystemPrompt } from '@/lib/openai/prompts'
import { TOOLS, executeToolCall } from '@/lib/openai/tools'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type HistoryMessage = { role: 'user' | 'assistant'; content: string }

function sse(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}

export async function POST(request: Request) {
  const user = await getAuthUser()
  if (!user) return unauthorized()

  const { message, history = [] } = await request.json() as { message: string; history: HistoryMessage[] }
  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: '메시지가 비어있습니다' }), { status: 400 })
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: getSystemPrompt() },
          // OD-004: 직전 20개 메시지만 포함 (토큰 비용 상한)
          ...(history.slice(-20) as ChatCompletionMessageParam[]),
          { role: 'user', content: message },
        ]

        // Tool use 루프 (최대 5회 방어)
        let iterations = 0
        while (iterations < 5) {
          iterations++

          const streamResponse = await openai.chat.completions.create({
            model: 'gpt-5.1',
            messages,
            tools: TOOLS,
            tool_choice: 'auto',
            stream: true,
          })

          // 스트리밍 청크 수집
          let finishReason: string | null = null
          let assistantContent = ''
          const toolCallMap = new Map<number, { id: string; name: string; args: string }>()

          for await (const chunk of streamResponse) {
            const choice = chunk.choices[0]
            if (!choice) continue

            if (choice.finish_reason) finishReason = choice.finish_reason

            const delta = choice.delta
            if (delta.content) {
              assistantContent += delta.content
              controller.enqueue(sse({ type: 'token', content: delta.content }))
            }

            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const cur = toolCallMap.get(tc.index) ?? { id: '', name: '', args: '' }
                if (tc.id) cur.id = tc.id
                if (tc.function?.name) cur.name += tc.function.name
                if (tc.function?.arguments) cur.args += tc.function.arguments
                toolCallMap.set(tc.index, cur)
              }
            }
          }

          if (finishReason === 'tool_calls' && toolCallMap.size > 0) {
            const toolCalls = Array.from(toolCallMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([, tc]) => ({
                id: tc.id,
                type: 'function' as const,
                function: { name: tc.name, arguments: tc.args },
              }))

            messages.push({ role: 'assistant', content: assistantContent || null, tool_calls: toolCalls })
            controller.enqueue(sse({ type: 'thinking', content: '데이터 조회 중...' }))

            for (const tc of toolCalls) {
              let result: unknown
              try {
                const args = JSON.parse(tc.function.arguments) as Record<string, unknown>
                if (process.env.NODE_ENV === 'development') {
                  console.log(`\n[Tool Call] ${tc.function.name}`)
                  console.log(`[Args]`, JSON.stringify(args, null, 2))
                }
                result = await executeToolCall(tc.function.name, args)
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[Result]`, JSON.stringify(result, null, 2))
                }
              } catch (err) {
                console.error(`[tool] ${tc.function.name} 실패:`, err)
                result = { error: '데이터 조회에 실패했어요. 다시 시도해주세요.' }
              }
              messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              })
            }
          } else {
            // 텍스트 응답 완료 — 루프 종료
            break
          }
        }

        controller.enqueue(sse({ type: 'done' }))
      } catch (error) {
        console.error('[chat] 오류:', error)
        controller.enqueue(sse({ type: 'error', content: '오류가 발생했어요. 잠시 후 다시 시도해주세요.' }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
