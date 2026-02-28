import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useApiMutation } from '@/hooks/useApiMutation'
import {
  useCreateCard,
  useUpdateCard,
  useDeleteCard,
  useRenameCategory,
} from '@/hooks/useCards'
import { usePaginatedCards, InsightStatusFilter } from '@/hooks/usePaginatedCards'
import { useCardSelection } from '@/hooks/useCardSelection'
import { useGenerateInsights, useValidateInsights } from '@/hooks/useInsights'
import { Plus, Loader2, Trash2, Sparkles, X, LayoutGrid, List } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AnkiImport } from '@/components/AnkiImport'
import { CardsSearchBar } from '@/components/cards/CardsSearchBar'
import { BulkCardCreator } from '@/components/cards/BulkCardCreator'
import { CategorizedCardsList } from '@/components/cards/CategorizedCardsList'
import { VirtualizedCardsTable } from '@/components/cards/VirtualizedCardsTable'
import { LoadingCards } from '@/components/review/LoadingCards'
import type { Card, UserSettings } from '@/types'
import type { NewCardForm } from '@/types/cards'
import { BULK_THRESHOLD } from '@/constants/cards'
import { categorizeCards, filterCardsBySearch } from '@/utils/cardFilters'

const INSIGHT_STATUS_OPTIONS: { value: InsightStatusFilter | 'all'; label: string }[] = [
  { value: 'all', label: 'All insights' },
  { value: 'none', label: 'No insights' },
  { value: 'pending', label: 'Pending insights' },
  { value: 'approved', label: 'Approved insights' },
  { value: 'any', label: 'Has insights' },
]

type ViewMode = 'grouped' | 'flat'

export function CardsPage() {
  const { token } = useAuth()
  const { toast } = useToast()

  // Filter state (all client-side now since we load all cards)
  const [searchQuery, setSearchQuery] = useState('')
  const [insightStatusFilter, setInsightStatusFilter] = useState<InsightStatusFilter | 'all'>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('grouped')

  // API hooks - load ALL cards (no server-side filtering)
  const {
    cards: allCards,
    isLoading,
    isFetchingNextPage,
    invalidate: invalidateCards,
  } = usePaginatedCards({
    pageSize: 200,
  })

  // Client-side filtering
  const cards = useMemo(() => {
    let filtered = allCards

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((card) =>
        card.front?.toLowerCase().includes(query) ||
        card.back?.toLowerCase().includes(query) ||
        card.explanation?.toLowerCase().includes(query)
      )
    }

    // Insight status filter
    if (insightStatusFilter !== 'all') {
      filtered = filtered.filter((card) => {
        const hasInsights = card.insights && card.insights.length > 0

        if (insightStatusFilter === 'none') return !hasInsights
        if (insightStatusFilter === 'any') return hasInsights
        if (!hasInsights) return false

        return card.insights!.some((i) => i.status === insightStatusFilter)
      })
    }

    return filtered
  }, [allCards, searchQuery, insightStatusFilter])

  const createCard = useCreateCard()
  const updateCard = useUpdateCard()
  const deleteCard = useDeleteCard()
  const renameCategory = useRenameCategory()
  const generateInsights = useGenerateInsights()
  const validateInsights = useValidateInsights()

  // Selection state
  const {
    selectedIds,
    selectedCardIds,
    selectedCount,
    toggleCard,
    selectAll,
    deselectAll,
    clearSelection,
  } = useCardSelection()

  const [generatingInsightsCategory, setGeneratingInsightsCategory] = useState<string | null>(null)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [isBulkGeneratingInsights, setIsBulkGeneratingInsights] = useState(false)

  // Bulk create state
  const [isCreating, setIsCreating] = useState(false)

  // Track user's manual category toggles (category -> isOpen)
  const [manualToggles, setManualToggles] = useState<Map<string, boolean>>(
    new Map()
  )

  // Fetch settings for active categories
  const { data: settings } = useApiQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: async () => apiClient.getSettings(token!),
    enabled: !!token,
  })

  // Local state for disabled categories (synced with settings)
  const [disabledCategories, setDisabledCategories] = useState<string[] | null>(
    null
  )

  // Sync disabled categories from settings
  useEffect(() => {
    if (settings?.disabled_categories !== undefined) {
      setDisabledCategories(settings.disabled_categories)
    }
  }, [settings])

  // Mutation to update settings
  const updateSettingsMutation = useApiMutation<UserSettings, Partial<UserSettings>>({
    mutationFn: async (data) => apiClient.updateSettings(token!, data),
    invalidateQueries: ['settings'],
  })

  // Group cards by category and filter (client-side from loaded cards)
  const categorizedCards = useMemo(() => {
    // Additional client-side filtering if needed
    const filtered = filterCardsBySearch(cards, '')
    return categorizeCards(filtered)
  }, [cards])

  // Reset manual toggles when search changes
  const prevSearchQuery = useRef(searchQuery)
  useEffect(() => {
    if (prevSearchQuery.current !== searchQuery) {
      setManualToggles(new Map())
      prevSearchQuery.current = searchQuery
    }
  }, [searchQuery])

  // Clear selection when filters change
  useEffect(() => {
    clearSelection()
  }, [searchQuery, insightStatusFilter, clearSelection])

  // Calculate which categories should be collapsed
  const collapsedCategories = useMemo(() => {
    if (categorizedCards.length === 0) return new Set<string>()

    const collapsed = new Set<string>()

    for (const [category] of categorizedCards) {
      // Check if user manually toggled this category
      if (manualToggles.has(category)) {
        if (!manualToggles.get(category)) {
          collapsed.add(category)
        }
        continue
      }

      // Otherwise, use automatic behavior
      if (searchQuery.trim() === '') {
        // No search: collapse all
        collapsed.add(category)
      } else {
        // Searching: check total cards
        const totalFilteredCards = categorizedCards.reduce(
          (sum, [, categoryCards]) => sum + categoryCards.length,
          0
        )

        if (totalFilteredCards >= BULK_THRESHOLD) {
          // Many cards: collapse all
          collapsed.add(category)
        }
        // Few cards: leave expanded (don't add to collapsed set)
      }
    }

    return collapsed
  }, [searchQuery, categorizedCards, manualToggles])

  const toggleCategory = (category: string) => {
    setManualToggles((prev) => {
      const next = new Map(prev)
      const isCurrentlyCollapsed = collapsedCategories.has(category)
      // Toggle: if collapsed, set to open (true), if open, set to collapsed (false)
      next.set(category, isCurrentlyCollapsed)
      return next
    })
  }

  const handleToggleCategoryActive = (category: string) => {
    // Category is active if it's NOT in the disabled list
    const isCurrentlyActive =
      disabledCategories === null || !disabledCategories.includes(category)

    let newDisabledCategories: string[] | null
    if (isCurrentlyActive) {
      // Disable this category - add to disabled list
      if (disabledCategories === null || disabledCategories.length === 0) {
        newDisabledCategories = [category]
      } else {
        newDisabledCategories = [...disabledCategories, category]
      }
    } else {
      // Enable this category - remove from disabled list
      if (disabledCategories === null) {
        newDisabledCategories = null
      } else {
        newDisabledCategories = disabledCategories.filter((c) => c !== category)
        // If no categories are disabled, set to empty array
        if (newDisabledCategories.length === 0) {
          newDisabledCategories = []
        }
      }
    }

    setDisabledCategories(newDisabledCategories)

    // Save immediately
    updateSettingsMutation.mutate(
      {
        disabled_categories: newDisabledCategories,
      },
      {
        onSuccess: () => {
          toast({
            title: 'Category updated',
            description: isCurrentlyActive
              ? 'New cards from this category will not appear in reviews. Existing progress unaffected.'
              : 'New cards from this category will appear in reviews.',
          })
        },
        onError: (error) => {
          console.error('Failed to save settings:', error)
          toast({
            title: 'Error',
            description: 'Failed to update category status',
            variant: 'destructive',
          })
          // Revert on error
          setDisabledCategories(settings?.disabled_categories ?? null)
        },
      }
    )
  }

  const handleRenameCategory = async (
    oldCategory: string,
    newCategory: string
  ) => {
    if (oldCategory === newCategory.trim()) {
      toast({
        title: 'No change',
        description: 'Category name is the same',
        variant: 'destructive',
      })
      throw new Error('No change')
    }

    return new Promise<void>((resolve, reject) => {
      renameCategory.mutate(
        {
          oldCategory,
          newCategory: newCategory.trim(),
        },
        {
          onSuccess: (result) => {
            toast({
              title: 'Category renamed',
              description: `Updated ${result.cardsUpdated || result.updated_count} cards${
                result.reviewItemsUpdated
                  ? ` and ${result.reviewItemsUpdated} review items`
                  : ''
              }`,
            })

            // Update local disabled categories if the old category was in the list
            if (disabledCategories && disabledCategories.includes(oldCategory)) {
              setDisabledCategories(
                disabledCategories.map((cat) =>
                  cat === oldCategory ? newCategory.trim() : cat
                )
              )
            }

            resolve()
          },
          onError: (error) => {
            console.error('Failed to rename category:', error)
            toast({
              title: 'Error',
              description: 'Failed to rename category',
              variant: 'destructive',
            })
            reject(error)
          },
        }
      )
    })
  }

  const handleUpdateCard = async (cardId: string, updates: Partial<Card>) => {
    return new Promise<void>((resolve, reject) => {
      updateCard.mutate(
        { cardId, data: updates },
        {
          onSuccess: () => {
            toast({
              title: 'Success',
              description: 'Card updated successfully',
            })
            resolve()
          },
          onError: (error) => {
            console.error('Failed to update card:', error)
            toast({
              title: 'Error',
              description: 'Failed to update card',
              variant: 'destructive',
            })
            reject(error)
          },
        }
      )
    })
  }

  const handleDeleteCard = async (cardId: string) => {
    return new Promise<void>((resolve, reject) => {
      deleteCard.mutate(cardId, {
        onSuccess: () => {
          toast({
            title: 'Success',
            description: 'Card and associated review items deleted',
          })
          resolve()
        },
        onError: (error) => {
          console.error('Failed to delete card:', error)
          toast({
            title: 'Error',
            description: 'Failed to delete card',
            variant: 'destructive',
          })
          reject(error)
        },
      })
    })
  }

  const handleCreateCards = async (newCards: NewCardForm[]) => {
    const validCards = newCards.filter((card) => card.front.trim() && card.back.trim())

    if (validCards.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'At least one card must have front and back text',
        variant: 'destructive',
      })
      throw new Error('No valid cards')
    }

    try {
      // Create all cards in parallel
      await Promise.all(
        validCards.map((card) =>
          createCard.mutateAsync({
            front: card.front,
            back: card.back,
            explanation: card.explanation || undefined,
            tags: card.tags.length > 0 ? card.tags : undefined,
            source: 'manual',
          })
        )
      )

      setIsCreating(false)

      toast({
        title: 'Success',
        description: `Created ${validCards.length} card(s) successfully`,
      })
    } catch (error) {
      console.error('Failed to create cards:', error)
      toast({
        title: 'Error',
        description: 'Failed to create cards',
        variant: 'destructive',
      })
      throw error
    }
  }

  // Generate insights for specific cards (by category)
  const handleGenerateInsights = useCallback(async (cardIds: string[]) => {
    if (cardIds.length === 0) return

    // Find category for this set of cards (for UI state)
    const firstCard = cards.find((c) => c.card_id === cardIds[0])
    const category = firstCard?.category || firstCard?.tags?.[0] || 'Uncategorized'

    setGeneratingInsightsCategory(category)

    try {
      // Process in batches of 20
      const batchSize = 20
      let totalGenerated = 0

      for (let i = 0; i < cardIds.length; i += batchSize) {
        const batch = cardIds.slice(i, i + batchSize)

        // Generate insights
        const genResult = await generateInsights.mutateAsync({ card_ids: batch })
        totalGenerated += genResult.generated.filter((g) => g.insights_count > 0).length

        // Validate the generated insights
        const cardsWithPending = genResult.generated
          .filter((g) => g.insights_count > 0)
          .map((g) => g.card_id)

        if (cardsWithPending.length > 0) {
          await validateInsights.mutateAsync({ card_ids: cardsWithPending })
        }
      }

      toast({
        title: 'Insights generated',
        description: `Generated insights for ${totalGenerated} cards. Visit the Insights page to review them.`,
      })
    } catch (error) {
      console.error('Failed to generate insights:', error)
      toast({
        variant: 'destructive',
        title: 'Failed to generate insights',
        description: 'Please try again.',
      })
    } finally {
      setGeneratingInsightsCategory(null)
    }
  }, [cards, generateInsights, validateInsights, toast])

  // Bulk delete selected cards
  const handleBulkDelete = async () => {
    if (selectedCount === 0) return

    setIsBulkDeleting(true)
    try {
      // Delete all selected cards
      await Promise.all(selectedCardIds.map((cardId) => deleteCard.mutateAsync(cardId)))

      toast({
        title: 'Success',
        description: `Deleted ${selectedCount} card(s)`,
      })

      clearSelection()
    } catch (error) {
      console.error('Failed to delete cards:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete some cards',
        variant: 'destructive',
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // Bulk generate insights for selected cards
  const handleBulkGenerateInsights = async () => {
    if (selectedCount === 0) return

    setIsBulkGeneratingInsights(true)
    try {
      // Filter to cards without insights
      const cardsWithoutInsights = selectedCardIds.filter((cardId) => {
        const card = cards.find((c) => c.card_id === cardId)
        return !card?.insights || card.insights.length === 0
      })

      if (cardsWithoutInsights.length === 0) {
        toast({
          title: 'No action needed',
          description: 'All selected cards already have insights',
        })
        return
      }

      // Process in batches of 20
      const batchSize = 20
      let totalGenerated = 0

      for (let i = 0; i < cardsWithoutInsights.length; i += batchSize) {
        const batch = cardsWithoutInsights.slice(i, i + batchSize)

        const genResult = await generateInsights.mutateAsync({ card_ids: batch })
        totalGenerated += genResult.generated.filter((g) => g.insights_count > 0).length

        const cardsWithPending = genResult.generated
          .filter((g) => g.insights_count > 0)
          .map((g) => g.card_id)

        if (cardsWithPending.length > 0) {
          await validateInsights.mutateAsync({ card_ids: cardsWithPending })
        }
      }

      toast({
        title: 'Insights generated',
        description: `Generated insights for ${totalGenerated} cards.`,
      })

      clearSelection()
    } catch (error) {
      console.error('Failed to generate insights:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate insights',
        variant: 'destructive',
      })
    } finally {
      setIsBulkGeneratingInsights(false)
    }
  }

  if (isLoading) {
    return (
      <div className="relative flex h-full flex-col">
        <div className="flex flex-1 items-center justify-center py-8">
          <LoadingCards />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex-1 overflow-auto">
        {/* Bulk Create Section */}
        <BulkCardCreator
          isCreating={isCreating}
          onCreateCards={handleCreateCards}
          onCancel={() => setIsCreating(false)}
        />

        {/* Header */}
        <div className="px-3 py-2 border-b bg-background flex items-center gap-2 sticky top-0 z-10">
          {/* Search */}
          <div className="flex-1 max-w-sm">
            <CardsSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              showHint={false}
            />
          </div>

          {/* Filters */}
          <Select
            value={insightStatusFilter}
            onValueChange={(value) => setInsightStatusFilter(value as InsightStatusFilter | 'all')}
          >
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder="Insights" />
            </SelectTrigger>
            <SelectContent>
              {INSIGHT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-xs">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View Toggle */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className="border rounded-md h-8"
          >
            <ToggleGroupItem value="grouped" aria-label="Grouped view" className="h-8 w-8 p-0">
              <LayoutGrid className="h-3.5 w-3.5" />
            </ToggleGroupItem>
            <ToggleGroupItem value="flat" aria-label="Flat view" className="h-8 w-8 p-0">
              <List className="h-3.5 w-3.5" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          {!isCreating && (
            <div className="flex items-center gap-1.5">
              <AnkiImport onImportComplete={() => invalidateCards()} />
              <Button onClick={() => setIsCreating(true)} size="sm" className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create
              </Button>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedCount > 0 && (
          <div className="px-3 py-1.5 bg-muted/50 border-b flex items-center gap-2 sticky top-[41px] z-10">
            <span className="text-xs font-medium text-muted-foreground">
              {selectedCount} selected
            </span>
            <div className="h-4 w-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={handleBulkGenerateInsights}
              disabled={isBulkGeneratingInsights}
            >
              {isBulkGeneratingInsights ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              )}
              Insights
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Delete
            </Button>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Cards List */}
        {viewMode === 'grouped' ? (
          <CategorizedCardsList
            cards={cards}
            searchQuery=""
            disabledCategories={disabledCategories}
            collapsedCategories={collapsedCategories}
            onToggleCategory={toggleCategory}
            onToggleCategoryActive={handleToggleCategoryActive}
            onRenameCategory={handleRenameCategory}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onGenerateInsights={handleGenerateInsights}
            generatingInsightsCategory={generatingInsightsCategory}
            selectedIds={selectedIds}
            onToggleSelect={toggleCard}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        ) : (
          <VirtualizedCardsTable
            cards={cards}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            selectedIds={selectedIds}
            onToggleSelect={toggleCard}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
          />
        )}

        {/* Stats */}
        {cards.length > 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {isFetchingNextPage ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading cards... ({cards.length} loaded)
              </span>
            ) : (
              `${cards.length} cards`
            )}
          </div>
        )}
      </div>
    </div>
  )
}
