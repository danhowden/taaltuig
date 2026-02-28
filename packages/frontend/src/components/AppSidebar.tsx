import { Home, CreditCard, Settings, LogOut, Brain, Loader2, Theater, Sparkles, Lightbulb } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { TaaltuigLogo } from '@/components/TaaltuigLogo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import { useCards } from '@/hooks/useCards'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { useInsightsQueue } from '@/hooks/useInsights'

export function AppSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, isLoading: isUserLoading } = useAuth()
  const { state, toggleSidebar } = useSidebar()
  const { cards, isLoading: isCardsLoading } = useCards()
  const { data: reviewData, isLoading: isReviewLoading } = useReviewQueue()
  const { data: insightsData, isLoading: isInsightsLoading } = useInsightsQueue()

  const isCollapsed = state === 'collapsed'
  const totalCardCount = cards.length
  const reviewCount = reviewData?.stats?.total_count || 0
  const insightsCount = insightsData?.total || 0

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Brain, label: 'Review', path: '/review' },
    { icon: CreditCard, label: 'Cards', path: '/cards' },
    { icon: Lightbulb, label: 'Insights', path: '/insights' },
    { icon: Sparkles, label: 'AI Lab', path: '/ai-lab' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: Theater, label: 'Behind the Scenes', path: '/debug' },
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        {isCollapsed ? (
          <div
            className="flex items-center justify-center px-2 cursor-pointer hover:bg-white/40 rounded-md transition-colors"
            onClick={toggleSidebar}
          >
            <TaaltuigLogo size={32} animate={false} showWordmark={false} />
          </div>
        ) : (
          <div className="flex items-center justify-between px-2">
            <TaaltuigLogo size={32} animate={false} showWordmark={true} />
            <SidebarTrigger />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path

                // Determine badge content and loading state
                let badgeContent = null
                let showBadge = false

                if (item.path === '/review') {
                  showBadge = true
                  badgeContent = isReviewLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    reviewCount
                  )
                } else if (item.path === '/cards') {
                  showBadge = true
                  badgeContent = isCardsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    totalCardCount
                  )
                } else if (item.path === '/insights') {
                  showBadge = insightsCount > 0
                  badgeContent = isInsightsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    insightsCount
                  )
                }

                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => navigate(item.path)}
                      tooltip={item.label}
                    >
                      <Icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    {showBadge && <SidebarMenuBadge>{badgeContent}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {!isCollapsed && (
          <>
            {isUserLoading ? (
              <div className="flex items-center gap-3 px-2 py-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-muted rounded w-24 mb-1.5"></div>
                  <div className="h-3 bg-muted rounded w-32"></div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-2">
                {user?.picture_url ? (
                  <img
                    key={user.picture_url}
                    src={user.picture_url}
                    alt={user.name || 'User'}
                    className="h-10 w-10 rounded-full flex-shrink-0"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground leading-tight">{user?.name || 'User'}</p>
                  <button
                    onClick={() => logout()}
                    className="text-xs text-foreground/50 hover:text-foreground/70 transition-colors leading-tight"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        {isCollapsed && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => logout()} tooltip="Logout">
                <LogOut />
                <span>Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  )
}
