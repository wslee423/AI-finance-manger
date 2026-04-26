'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: '📊' },
  { href: '/admin/transactions', label: '수입/지출', icon: '💰' },
  { href: '/admin/assets', label: '자산', icon: '🏦' },
  { href: '/admin/dividend', label: '배당금', icon: '📈' },
  { href: '/chat', label: 'AI 비서', icon: '🤖' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-sm font-semibold text-gray-900">AI Finance</h1>
        <p className="text-xs text-gray-500 mt-0.5">재정 관리 서비스</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <span>🚪</span>
          <span>로그아웃</span>
        </button>
      </div>
    </aside>
  )
}
