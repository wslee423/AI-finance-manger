import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Finance Management',
  description: '가족 재정 관리 대시보드',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
