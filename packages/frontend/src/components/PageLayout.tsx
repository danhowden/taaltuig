import { ReactNode } from 'react'

interface PageLayoutProps {
  children: ReactNode
}

interface HeaderProps {
  title: string
  description?: string
  actions?: ReactNode
}

interface TabsBarProps {
  children: ReactNode
}

interface ContentProps {
  children: ReactNode
  className?: string
}

export function PageLayout({ children }: PageLayoutProps) {
  return <div className="flex flex-col h-full p-6 gap-4">{children}</div>
}

PageLayout.Header = function Header({ title, description, actions }: HeaderProps) {
  return (
    <div className="flex items-start justify-between flex-shrink-0">
      <div>
        <h1 className="text-base font-semibold uppercase tracking-wide">{title}</h1>
        {description && (
          <p className="text-black/50 text-sm font-light mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}

PageLayout.TabsBar = function TabsBar({ children }: TabsBarProps) {
  return <div className="flex-shrink-0">{children}</div>
}

PageLayout.Content = function Content({ children, className = '' }: ContentProps) {
  return (
    <div
      className={`flex-1 overflow-auto rounded-2xl p-6 ${className}`}
      style={{
        background: 'rgba(255, 255, 255, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
      }}
    >
      {children}
    </div>
  )
}
