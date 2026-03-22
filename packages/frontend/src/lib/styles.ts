import type { CSSProperties } from 'react'

export const glassCard: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow:
    '0 8px 32px rgb(var(--primary) / 0.15), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
}

export const glassCardSubtle: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.1)',
  boxShadow:
    '0 8px 32px rgb(var(--primary) / 0.15), 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 0 0 1px rgba(255, 255, 255, 0.4)',
}

export const contentPanel: CSSProperties = {
  background: 'rgba(255, 255, 255, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.3)',
}
