import { useAuth } from '@/contexts/AuthContext'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Menu } from 'lucide-react'
import { AppSidebar } from '@/components/AppSidebar'
import { SidebarProvider, SidebarInset, useSidebar } from '@/components/ui/sidebar'
import { MeshGradientBackground } from '@/components/ui/mesh-gradient-background'
import { GlobalLoadingIndicator } from '@/components/GlobalLoadingIndicator'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

function MobileMenuButton() {
  const { toggleSidebar } = useSidebar()

  return (
    <div className="fixed bottom-4 right-4 z-20 md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleSidebar}
        className="h-12 w-12 bg-white/70 backdrop-blur-sm border border-white/40 rounded-full shadow-lg"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </Button>
    </div>
  )
}

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  const isMobile = useIsMobile()

  // Don't show sidebar on login page
  const showSidebar = isAuthenticated && location.pathname !== '/login'

  if (!showSidebar) {
    return (
      <>
        <MeshGradientBackground />
        <div className="min-h-screen p-3 md:p-[30px]">
          <div
            className="relative h-[calc(100vh-24px)] md:h-[calc(100vh-60px)] rounded-2xl md:rounded-3xl overflow-hidden flex items-center justify-center"
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow:
                '0 8px 32px rgba(139, 92, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)',
            }}
          >
            <GlobalLoadingIndicator />
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="h-full flex items-center justify-center"
            >
              {children}
            </motion.div>
          </div>
        </div>
      </>
    )
  }

  // Glass container styles - only applied on desktop
  const glassStyles = isMobile
    ? undefined
    : {
        background: 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.5)',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.15), 0 2px 8px rgba(0, 0, 0, 0.08)',
      }

  return (
    <>
      <MeshGradientBackground />
      {/* No padding on mobile, glass container on desktop only */}
      <div className="min-h-screen md:p-[30px]">
        <div
          className="relative h-screen md:h-[calc(100vh-60px)] md:rounded-3xl overflow-hidden flex"
          style={glassStyles}
        >
          <GlobalLoadingIndicator />
          <SidebarProvider>
            <AppSidebar />
            <SidebarInset className="bg-transparent">
              <div className="relative flex flex-col h-full overflow-hidden md:bg-white/20">
                <MobileMenuButton />
                <div className="flex-1 overflow-auto">
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="min-h-full"
                  >
                    {children}
                  </motion.div>
                </div>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      </div>
    </>
  )
}
