import { useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { apiClient } from '@/lib/api'
import type { ListCardsResponse, QueueResponse, Card, UserSettings, InsightsMetricsResponse } from '@/types'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card as CardComponent, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageLayout } from '@/components/PageLayout'
import { LoadingCards } from '@/components/review/LoadingCards'
import { ArrowUpDown, ArrowUp, ArrowDown, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

type SortField = 'card' | 'state' | 'interval' | 'ease' | 'reps' | 'due' | 'category'
type SortOrder = 'asc' | 'desc'
type MetricsPeriod = 'hour' | 'day' | 'week'

export function DebugPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('queue')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('due')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [metricsPeriod, setMetricsPeriod] = useState<MetricsPeriod>('day')

  const { data: cardsData } = useApiQuery<ListCardsResponse>({
    queryKey: ['debug-cards'],
    queryFn: async () => apiClient.listCards(token!),
    enabled: !!token,
  })

  const { data: queueData, isLoading: queueLoading } = useApiQuery<QueueResponse>({
    queryKey: ['debug-queue-all'],
    queryFn: async () => apiClient.getReviewQueue(token!, { all: true }),
    enabled: !!token,
  })

  const { data: settings } = useApiQuery<{ settings: UserSettings }>({
    queryKey: ['settings'],
    queryFn: async () => ({ settings: await apiClient.getSettings(token!) }),
    enabled: !!token,
  })

  const { data: metricsData, isLoading: metricsLoading } = useApiQuery<InsightsMetricsResponse>({
    queryKey: ['insights-metrics', metricsPeriod],
    queryFn: async () => apiClient.getInsightsMetrics(token!, metricsPeriod),
    enabled: !!token && activeTab === 'ai-metrics',
  })

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const formatDueDateTime = (dateStr: string): string => {
    const date = new Date(dateStr)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    } else {
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }

  const isCategoryDisabled = (category: string | undefined): boolean => {
    if (!category || !settings?.settings?.disabled_categories) return false
    return settings.settings.disabled_categories.includes(category)
  }

  const getStateColor = (state: string): string => {
    switch (state) {
      case 'NEW':
        return 'bg-blue-500'
      case 'LEARNING':
        return 'bg-yellow-500'
      case 'REVIEW':
        return 'bg-green-500'
      case 'RELEARNING':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  // Create a map of card_id to card for enrichment
  const cardMap = new Map<string, Card>()
  cardsData?.cards.forEach((card) => {
    cardMap.set(card.card_id, card)
  })

  // Enrich queue items with card data
  const enrichedQueue = queueData?.queue.map((item) => {
    const card = cardMap.get(item.card_id)
    return {
      ...item,
      category: item.category || card?.category,
      source: card?.source,
    }
  })

  // Filter and sort queue
  const filteredAndSortedQueue = useMemo(() => {
    if (!enrichedQueue) return []

    // Filter by search query
    let filtered = enrichedQueue
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = enrichedQueue.filter(
        (item) =>
          item.front.toLowerCase().includes(query) ||
          item.back.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query)
      )
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (sortField) {
        case 'card':
          aVal = a.front
          bVal = b.front
          break
        case 'state':
          aVal = a.state
          bVal = b.state
          break
        case 'interval':
          aVal = a.interval
          bVal = b.interval
          break
        case 'ease':
          aVal = a.ease_factor
          bVal = b.ease_factor
          break
        case 'reps':
          aVal = a.repetitions
          bVal = b.repetitions
          break
        case 'due':
          aVal = new Date(a.due_date).getTime()
          bVal = new Date(b.due_date).getTime()
          break
        case 'category':
          aVal = a.category || ''
          bVal = b.category || ''
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      } else {
        return sortOrder === 'asc'
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number)
      }
    })

    return sorted
  }, [enrichedQueue, searchQuery, sortField, sortOrder])

  return (
    <PageLayout>
      <PageLayout.Header
        title="Behind the Scenes"
        description="Review data and due dates for all cards in the database"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <PageLayout.TabsBar>
          <TabsList>
            <TabsTrigger value="queue">Review Queue ({queueData?.queue.length || 0})</TabsTrigger>
            <TabsTrigger value="stats">Statistics</TabsTrigger>
            <TabsTrigger value="ai-metrics">AI Metrics</TabsTrigger>
          </TabsList>
        </PageLayout.TabsBar>

        <PageLayout.Content className="mt-4">
          <TabsContent value="queue" className="space-y-4 mt-0">
            {queueLoading ? (
              <div className="flex items-center justify-center py-16">
                <LoadingCards />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search cards, categories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                  <div className="text-sm text-muted-foreground flex items-center gap-3">
                    <span>
                      {filteredAndSortedQueue.length} of {enrichedQueue?.length || 0} items
                    </span>
                    {settings?.settings?.disabled_categories && settings.settings.disabled_categories.length > 0 && (
                      <span className="flex items-center gap-1.5 text-xs">
                        <EyeOff className="h-3 w-3" />
                        {filteredAndSortedQueue.filter(item => isCategoryDisabled(item.category)).length} excluded
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-md border bg-white/30">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent h-9">
                        <TableHead className="w-[50px] py-1">Dir</TableHead>
                        <TableHead className="w-[300px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('card')}
                          >
                            Card
                            {sortField === 'card' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[160px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('due')}
                          >
                            Due
                            {sortField === 'due' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[100px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('state')}
                          >
                            State
                            {sortField === 'state' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[60px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('reps')}
                          >
                            Reps
                            {sortField === 'reps' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[70px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('interval')}
                          >
                            Intv
                            {sortField === 'interval' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[60px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('ease')}
                          >
                            Ease
                            {sortField === 'ease' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[100px] py-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-7"
                            onClick={() => toggleSort('category')}
                          >
                            Category
                            {sortField === 'category' ? (
                              sortOrder === 'asc' ? (
                                <ArrowUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowDown className="ml-1 h-3 w-3" />
                              )
                            ) : (
                              <ArrowUpDown className="ml-1 h-3 w-3" />
                            )}
                          </Button>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedQueue.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="h-16 text-center text-muted-foreground">
                            No items found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedQueue.map((item) => {
                          const isDisabled = isCategoryDisabled(item.category)
                          return (
                            <TableRow
                              key={item.review_item_id}
                              className={`h-8 ${isDisabled ? 'opacity-50' : ''}`}
                              title={isDisabled ? `Excluded from reviews (category "${item.category}" is disabled in settings)` : undefined}
                            >
                              <TableCell className="py-0.5 px-3 text-center">
                                <span className="text-base" title={item.direction === 'forward' ? 'Dutch → English' : 'English → Dutch'}>
                                  {item.direction === 'forward' ? '🇳🇱' : '🇺🇸'}
                                </span>
                              </TableCell>
                              <TableCell className="font-medium max-w-xs truncate py-0.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  {isDisabled && (
                                    <EyeOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                  <span className="text-xs truncate">
                                    {item.front}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-0.5 px-3 text-xs text-muted-foreground">
                                {formatDueDateTime(item.due_date)}
                              </TableCell>
                              <TableCell className="py-0.5 px-3">
                                <Badge className={`${getStateColor(item.state)} text-xs px-1.5 py-0`}>
                                  {item.state}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-0.5 px-3 text-xs">{item.repetitions}</TableCell>
                              <TableCell className="py-0.5 px-3 text-xs">{item.interval.toFixed(3)}d</TableCell>
                              <TableCell className="py-0.5 px-3 text-xs">{item.ease_factor.toFixed(2)}</TableCell>
                              <TableCell className="py-0.5 px-3 text-xs whitespace-nowrap truncate max-w-[100px]">
                                {item.category || '-'}
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="stats" className="space-y-4 mt-0">
            {/* Show warning if review items don't match cards * 2 */}
            {cardsData && queueData && queueData.queue.length !== cardsData.cards.length * 2 && (
              <div className="rounded-lg border border-yellow-500 bg-yellow-50 dark:bg-yellow-950 p-4">
                <div className="flex items-start gap-3">
                  <div className="text-yellow-600 dark:text-yellow-400">⚠️</div>
                  <div>
                    <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                      Review Items Mismatch
                    </h3>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Expected {cardsData.cards.length * 2} review items ({cardsData.cards.length} cards × 2 directions),
                      but found {queueData.queue.length}. Each card should have 2 review items (forward and reverse).
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>Total Cards</CardTitle>
                  <CardDescription>All cards in database</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{cardsData?.cards.length || 0}</div>
                </CardContent>
              </CardComponent>

              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>Review Items</CardTitle>
                  <CardDescription>Should be 2× cards (bidirectional)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{queueData?.queue.length || 0}</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Expected: {(cardsData?.cards.length || 0) * 2}
                  </p>
                </CardContent>
              </CardComponent>

              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>Due Now</CardTitle>
                  <CardDescription>Ready for review</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{queueData?.stats.due_count || 0}</div>
                </CardContent>
              </CardComponent>

              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>New Cards</CardTitle>
                  <CardDescription>Never reviewed</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">{queueData?.stats.new_count || 0}</div>
                </CardContent>
              </CardComponent>

              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>State Breakdown</CardTitle>
                  <CardDescription>Cards by state</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {['NEW', 'LEARNING', 'REVIEW', 'RELEARNING'].map((state) => {
                      const count =
                        queueData?.queue.filter((item) => item.state === state).length || 0
                      return (
                        <div key={state} className="flex items-center justify-between">
                          <Badge className={getStateColor(state)}>{state}</Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </CardComponent>

              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>Sources</CardTitle>
                  <CardDescription>Cards by source</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="default">Manual</Badge>
                      <span className="font-medium">
                        {cardsData?.cards.filter((c) => c.source === 'manual').length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Anki</Badge>
                      <span className="font-medium">
                        {cardsData?.cards.filter((c) => c.source === 'anki').length || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </CardComponent>

              <CardComponent className="bg-white/30">
                <CardHeader>
                  <CardTitle>Directions</CardTitle>
                  <CardDescription>Review items by direction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">NL → EN</Badge>
                      <span className="font-medium">
                        {queueData?.queue.filter((item) => item.direction === 'forward').length || 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">EN → NL</Badge>
                      <span className="font-medium">
                        {queueData?.queue.filter((item) => item.direction === 'reverse').length || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </CardComponent>
            </div>
          </TabsContent>

          <TabsContent value="ai-metrics" className="space-y-4 mt-0">
            {/* Period selector */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Period:</span>
              <div className="flex gap-2">
                {(['hour', 'day', 'week'] as MetricsPeriod[]).map((p) => (
                  <Button
                    key={p}
                    variant={metricsPeriod === p ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMetricsPeriod(p)}
                  >
                    {p === 'hour' ? 'Last Hour' : p === 'day' ? 'Last 24h' : 'Last Week'}
                  </Button>
                ))}
              </div>
            </div>

            {metricsLoading ? (
              <div className="flex items-center justify-center py-16">
                <LoadingCards />
              </div>
            ) : metricsData ? (
              <>
                {/* Summary cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <CardComponent className="bg-white/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {(metricsData.totals.approvalRate * 100).toFixed(1)}%
                      </div>
                    </CardContent>
                  </CardComponent>

                  <CardComponent className="bg-white/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-green-600">Approved</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600">
                        {metricsData.totals.approved}
                      </div>
                    </CardContent>
                  </CardComponent>

                  <CardComponent className="bg-white/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-red-600">Rejected</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-red-600">
                        {metricsData.totals.rejected}
                      </div>
                    </CardContent>
                  </CardComponent>

                  <CardComponent className="bg-white/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Cards Processed</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">
                        {metricsData.totals.cardsProcessed}
                      </div>
                    </CardContent>
                  </CardComponent>
                </div>

                {/* Chart */}
                {metricsData.datapoints.length > 0 ? (
                  <CardComponent className="bg-white/30">
                    <CardHeader>
                      <CardTitle>Insights Over Time</CardTitle>
                      <CardDescription>
                        Approved vs rejected insights
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={metricsData.datapoints.map((dp) => ({
                              ...dp,
                              time: new Date(dp.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            }))}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="approved"
                              stroke="#16a34a"
                              strokeWidth={2}
                              name="Approved"
                            />
                            <Line
                              type="monotone"
                              dataKey="rejected"
                              stroke="#dc2626"
                              strokeWidth={2}
                              name="Rejected"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </CardComponent>
                ) : (
                  <CardComponent className="bg-white/30">
                    <CardContent className="py-16 text-center text-muted-foreground">
                      No metrics data available for this period.
                      Generate and validate some insights to see data here.
                    </CardContent>
                  </CardComponent>
                )}
              </>
            ) : (
              <CardComponent className="bg-white/30">
                <CardContent className="py-16 text-center text-muted-foreground">
                  Failed to load metrics data.
                </CardContent>
              </CardComponent>
            )}
          </TabsContent>
        </PageLayout.Content>
      </Tabs>
    </PageLayout>
  )
}
