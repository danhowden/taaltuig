import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Bug } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { TaaltuigLogo } from '@/components/TaaltuigLogo'
import type { QueueResponse } from '@/types'

export function AppHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, token } = useAuth()
  const { toast } = useToast()
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)
  const [debugData, setDebugData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // Don't show header on landing or login pages
  if (!user || location.pathname === '/' || location.pathname === '/login') {
    return null
  }

  const loadDebugData = async () => {
    if (!token) return
    try {
      setLoading(true)
      const response = await apiClient.getReviewQueue(token)
      setDebugData(response)
    } catch (error) {
      console.error('Failed to load debug data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load debug data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const resetDailyReviews = async () => {
    if (!token) return
    try {
      setLoading(true)
      const response = await apiClient.resetDailyReviews(token)
      toast({
        title: 'Success',
        description: `Reset ${response.deleted_count} review(s) for today`,
      })
      // Reload debug data
      await new Promise((resolve) => setTimeout(resolve, 2000))
      await loadDebugData()
    } catch (error) {
      console.error('Failed to reset daily reviews:', error)
      toast({
        title: 'Error',
        description: 'Failed to reset daily reviews',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDebugClick = () => {
    setDebugPanelOpen(true)
    loadDebugData()
  }

  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <TaaltuigLogo size={40} animate={false} showWordmark={true} />

          {/* Desktop navigation */}
          <nav className="hidden md:flex gap-2 items-center">
            <Button
              variant={location.pathname === '/review' ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate('/review')}
            >
              Review
            </Button>
            <Button
              variant={location.pathname === '/cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate('/cards')}
            >
              Cards
            </Button>
            <Button
              variant={location.pathname === '/settings' ? 'default' : 'outline'}
              size="sm"
              onClick={() => navigate('/settings')}
            >
              Settings
            </Button>

            <Sheet open={debugPanelOpen} onOpenChange={setDebugPanelOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleDebugClick}>
                  <Bug className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="pointer-events-auto" hideOverlay>
                <SheetHeader>
                  <SheetTitle>Debug Panel</SheetTitle>
                  <SheetDescription>
                    Review queue statistics and testing tools
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {loading && (
                    <p className="text-sm text-muted-foreground">Loading...</p>
                  )}
                  {debugData && !loading && (
                    <>
                      <div>
                        <h3 className="font-semibold text-sm mb-2">
                          Review Queue Stats
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-muted p-3 rounded-md">
                            <div className="text-xs text-muted-foreground">
                              Total in queue
                            </div>
                            <div className="text-2xl font-bold">
                              {debugData.stats?.total_count || 0}
                            </div>
                          </div>
                          <div className="bg-muted p-3 rounded-md">
                            <div className="text-xs text-muted-foreground">
                              NEW cards
                            </div>
                            <div className="text-2xl font-bold">
                              {debugData.stats?.new_count || 0}
                            </div>
                          </div>
                          <div className="bg-muted p-3 rounded-md">
                            <div className="text-xs text-muted-foreground">
                              Due reviews
                            </div>
                            <div className="text-2xl font-bold">
                              {debugData.stats?.due_count || 0}
                            </div>
                          </div>
                          <div className="bg-muted p-3 rounded-md">
                            <div className="text-xs text-muted-foreground">
                              NEW remaining
                            </div>
                            <div className="text-2xl font-bold">
                              {debugData.stats?.new_remaining_today ?? '?'}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={loadDebugData}
                          disabled={loading}
                        >
                          Refresh Stats
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="w-full"
                          onClick={resetDailyReviews}
                          disabled={loading}
                        >
                          Reset Today's Reviews
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </nav>
        </div>
      </div>
    </header>
  )
}
