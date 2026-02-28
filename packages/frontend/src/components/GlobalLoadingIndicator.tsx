import { useLoading } from '@/contexts/LoadingContext'

export function GlobalLoadingIndicator() {
  const { isLoading } = useLoading()

  if (!isLoading) return null

  return (
    <div
      className="absolute top-0 left-0 right-0 h-6 overflow-hidden z-50 pointer-events-none"
      style={{
        maskImage: 'linear-gradient(to bottom, white, transparent)',
        WebkitMaskImage: 'linear-gradient(to bottom, white, transparent)',
      }}
    >
      <div
        className="h-full"
        style={{
          width: '50%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
          boxShadow: '0 0 20px 5px rgba(255, 255, 255, 0.3)',
          animation: 'glow-slide 1.2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes glow-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  )
}
