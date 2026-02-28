export function AuroraBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-white" />

      {/* Main aurora blob - top left */}
      <div
        className="absolute -top-[20%] -left-[10%] h-[700px] w-[700px] rounded-full opacity-40 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.8) 0%, rgba(168, 85, 247, 0.5) 40%, transparent 70%)',
          animation: 'aurora-pulse 8s ease-in-out infinite, aurora-move 12s ease-in-out infinite',
        }}
      />

      {/* Secondary blob - accent */}
      <div
        className="absolute top-[10%] left-[15%] h-[500px] w-[500px] rounded-full opacity-30 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(192, 132, 252, 0.6) 0%, rgba(216, 180, 254, 0.3) 50%, transparent 70%)',
          animation: 'aurora-pulse 6s ease-in-out infinite reverse, aurora-move-secondary 10s ease-in-out infinite',
        }}
      />

      {/* Subtle glow - right side for balance */}
      <div
        className="absolute top-[40%] -right-[5%] h-[500px] w-[500px] rounded-full opacity-15 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 60%)',
          animation: 'aurora-pulse 10s ease-in-out infinite',
        }}
      />

      <style>{`
        @keyframes aurora-pulse {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.1);
          }
        }

        @keyframes aurora-move {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(20px, 30px);
          }
          50% {
            transform: translate(-10px, 20px);
          }
          75% {
            transform: translate(30px, -10px);
          }
        }

        @keyframes aurora-move-secondary {
          0%, 100% {
            transform: translate(0, 0);
          }
          33% {
            transform: translate(-20px, 20px);
          }
          66% {
            transform: translate(15px, -15px);
          }
        }
      `}</style>
    </div>
  )
}
