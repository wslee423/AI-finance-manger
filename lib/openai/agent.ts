import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { getSystemPrompt } from './prompts'
import { TOOLS, executeToolCall } from './tools'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

type HistoryMessage = { role: 'user' | 'assistant'; content: string }

export async function askAgent(question: string, history: HistoryMessage[] = []): Promise<string> {
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: getSystemPrompt() },
    ...(history.slice(-20) as ChatCompletionMessageParam[]),
    { role: 'user', content: question },
  ]

  // Tool use 루프 (최대 5회)
  for (let i = 0; i < 5; i++) {
    const response = await openai.chat.completions.create({
      model: 'gpt-5.1',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
    })

    const choice = response.choices[0]
    if (!choice) break

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      messages.push(choice.message)

      for (const tc of choice.message.tool_calls) {
        if (tc.type !== 'function') continue
        let result: unknown
        try {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>
          result = await executeToolCall(tc.function.name, args, { serviceRole: true })
        } catch {
          result = { error: '데이터 조회에 실패했어요.' }
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
      }
    } else {
      return choice.message.content ?? '답변을 생성하지 못했어요.'
    }
  }

  return '답변을 생성하지 못했어요. 다시 시도해주세요.'
}
