import { ReactNode } from 'react'

interface SessionLayoutProps {
  children: ReactNode
}

export function SessionLayout({ children }: SessionLayoutProps) {
  return <div className="relative flex h-full flex-col">{children}</div>
}

SessionLayout.Center = function Center({ children }: SessionLayoutProps) {
  return (
    <div className="flex flex-1 items-center justify-center py-8">
      {children}
    </div>
  )
}
