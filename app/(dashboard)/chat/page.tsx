'use client'

import { useState, useRef, useEffect, type KeyboardEvent } from 'react'

type Role = 'user' | 'assistant'
type Message = {
  id: string
  role: Role
  content: string
  isThinking?: boolean
}

type HistoryMessage = { role: Role; content: string }

const QUICK_QUESTIONS = [
  '이번달 지출 요약',
  '현재 순자산',
  '올해 배당금 현황',
  '이번달 저축률',
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'init', role: 'assistant', content: '안녕하세요! 재정 데이터에 대해 무엇이든 물어보세요.' },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || isLoading) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    const thinkingId = `t-${Date.now()}`
    const assistantId = `a-${Date.now()}`

    setMessages(prev => [
      ...prev,
      userMsg,
      { id: thinkingId, role: 'assistant', content: '생각 중...', isThinking: true },
    ])
    setInput('')
    setIsLoading(true)

    // history: 비사용자 표시용 메시지(thinking) 제외하고 최대 20개
    const history: HistoryMessage[] = messages
      .filter(m => !m.isThinking)
      .map(m => ({ role: m.role, content: m.content }))
      .slice(-20)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      })

      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let tokenStarted = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const line = event.trim()
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()

          let parsed: { type: string; content?: string }
          try { parsed = JSON.parse(raw) } catch { continue }

          if (parsed.type === 'thinking') {
            setMessages(prev => prev.map(m =>
              m.id === thinkingId ? { ...m, content: parsed.content ?? '데이터 조회 중...' } : m
            ))
          } else if (parsed.type === 'token') {
            if (!tokenStarted) {
              tokenStarted = true
              setMessages(prev => prev.map(m =>
                m.id === thinkingId
                  ? { id: assistantId, role: 'assistant', content: parsed.content ?? '', isThinking: false }
                  : m
              ))
            } else {
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: m.content + (parsed.content ?? '') } : m
              ))
            }
          } else if (parsed.type === 'error') {
            setMessages(prev => prev.map(m =>
              m.id === thinkingId
                ? { id: assistantId, role: 'assistant', content: parsed.content ?? '오류가 발생했어요.', isThinking: false }
                : m
            ))
          }
        }
      }

      // 토큰이 없었으면 (도구 호출만 했는데 텍스트 응답 없는 경우) thinking 제거
      if (!tokenStarted) {
        setMessages(prev => prev.filter(m => m.id !== thinkingId))
      }
    } catch (err) {
      console.error('[chat]', err)
      setMessages(prev => prev.map(m =>
        m.id === thinkingId
          ? { ...m, content: '오류가 발생했어요. 잠시 후 다시 시도해주세요.', isThinking: false }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Header */}
      <div className="mb-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-gray-900">AI 재정 비서</h1>
        <p className="text-sm text-gray-500 mt-0.5">재정 데이터에 대해 자유롭게 질문하세요</p>
      </div>

      {/* Quick questions */}
      <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
        {QUICK_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={isLoading}
            className="text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            💬 {q}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 py-2">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="질문을 입력하세요..."
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-sm"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
        >
          전송
        </button>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm flex-shrink-0">
        🤖
      </div>
      <div className={`max-w-[80%] bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm ${message.isThinking ? 'text-gray-400 italic' : 'text-gray-800'}`}>
        {message.isThinking ? (
          <span>{message.content}</span>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')

  return (
    <div className="space-y-1 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('### ')) {
          return <p key={i} className="font-semibold text-gray-900 mt-2 first:mt-0">{line.slice(4)}</p>
        }
        if (line.startsWith('## ')) {
          return <p key={i} className="font-bold text-gray-900 mt-2 first:mt-0">{line.slice(3)}</p>
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return <div key={i} className="flex gap-1.5"><span className="mt-0.5 text-gray-400">•</span><span>{renderBold(line.slice(2))}</span></div>
        }
        if (/^\d+\./.test(line)) {
          return <div key={i} className="flex gap-1.5"><span className="text-gray-400">{line.match(/^\d+/)?.[0]}.</span><span>{renderBold(line.replace(/^\d+\.\s*/, ''))}</span></div>
        }
        if (line === '') return <div key={i} className="h-1" />
        return <p key={i}>{renderBold(line)}</p>
      })}
    </div>
  )
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  )
}
