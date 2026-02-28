import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageLayout } from '@/components/PageLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useToast } from '@/hooks/use-toast'
import { apiClient } from '@/lib/api'
import { AlertTriangle, Save, RotateCcw } from 'lucide-react'
import type { QueueResponse, UserSettings, ProficiencyLevel } from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Default settings values (matching backend)
const DEFAULT_SETTINGS = {
  new_cards_per_day: 20,
  max_reviews_per_day: null as number | null,
  learning_steps: [1, 10],
  relearning_steps: [10],
  graduating_interval: 1,
  easy_interval: 4,
  starting_ease: 2.5,
  easy_bonus: 1.3,
  interval_modifier: 1.0,
  maximum_interval: 36500,
  lapse_new_interval: 0,
}

// Helper to parse comma-separated numbers
function parseSteps(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
}

// Helper to format steps array as string
function formatSteps(steps: number[]): string {
  return steps.join(', ')
}

export function SettingsPage() {
  const { token } = useAuth()
  const { startLoading, stopLoading } = useLoading()
  const { toast } = useToast()

  const [debugData, setDebugData] = useState<QueueResponse | null>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)
  const [resettingReviews, setResettingReviews] = useState(false)
  const [clearingInsights, setClearingInsights] = useState(false)

  // SRS Settings state
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)

  // Form state for all settings
  const [newCardsPerDay, setNewCardsPerDay] = useState(DEFAULT_SETTINGS.new_cards_per_day)
  const [maxReviewsPerDay, setMaxReviewsPerDay] = useState<number | null>(DEFAULT_SETTINGS.max_reviews_per_day)
  const [maxReviewsEnabled, setMaxReviewsEnabled] = useState(false)
  const [learningStepsInput, setLearningStepsInput] = useState(formatSteps(DEFAULT_SETTINGS.learning_steps))
  const [relearningStepsInput, setRelearningStepsInput] = useState(formatSteps(DEFAULT_SETTINGS.relearning_steps))
  const [graduatingInterval, setGraduatingInterval] = useState(DEFAULT_SETTINGS.graduating_interval)
  const [easyInterval, setEasyInterval] = useState(DEFAULT_SETTINGS.easy_interval)
  const [startingEase, setStartingEase] = useState(DEFAULT_SETTINGS.starting_ease)
  const [easyBonus, setEasyBonus] = useState(DEFAULT_SETTINGS.easy_bonus)
  const [intervalModifier, setIntervalModifier] = useState(DEFAULT_SETTINGS.interval_modifier)
  const [maximumInterval, setMaximumInterval] = useState(DEFAULT_SETTINGS.maximum_interval)
  const [lapseNewInterval, setLapseNewInterval] = useState(DEFAULT_SETTINGS.lapse_new_interval)
  const [showUnreviewedInsights, setShowUnreviewedInsights] = useState(true)
  const [proficiencyLevel, setProficiencyLevel] = useState<ProficiencyLevel>('beginner')

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!token) return
      try {
        setLoadingSettings(true)
        const userSettings = await apiClient.getSettings(token)
        setSettings(userSettings)

        // Populate form state
        setNewCardsPerDay(userSettings.new_cards_per_day)
        setMaxReviewsPerDay(userSettings.max_reviews_per_day)
        setMaxReviewsEnabled(userSettings.max_reviews_per_day !== null)
        setLearningStepsInput(formatSteps(userSettings.learning_steps))
        setRelearningStepsInput(formatSteps(userSettings.relearning_steps))
        setGraduatingInterval(userSettings.graduating_interval)
        setEasyInterval(userSettings.easy_interval)
        setStartingEase(userSettings.starting_ease)
        setEasyBonus(userSettings.easy_bonus)
        setIntervalModifier(userSettings.interval_modifier)
        setMaximumInterval(userSettings.maximum_interval ?? DEFAULT_SETTINGS.maximum_interval)
        setLapseNewInterval(userSettings.lapse_new_interval ?? DEFAULT_SETTINGS.lapse_new_interval)
        setShowUnreviewedInsights(userSettings.show_unreviewed_insights ?? true)
        setProficiencyLevel(userSettings.proficiency_level ?? 'beginner')
      } catch (error) {
        console.error('Failed to load settings:', error)
        toast({
          title: 'Error',
          description: 'Failed to load settings',
          variant: 'destructive',
        })
      } finally {
        setLoadingSettings(false)
      }
    }
    loadSettings()
  }, [token, toast])

  const saveSettings = async () => {
    if (!token) return

    const learningSteps = parseSteps(learningStepsInput)
    const relearningSteps = parseSteps(relearningStepsInput)

    if (learningSteps.length === 0) {
      toast({
        title: 'Invalid learning steps',
        description: 'Please enter at least one learning step',
        variant: 'destructive',
      })
      return
    }

    if (relearningSteps.length === 0) {
      toast({
        title: 'Invalid relearning steps',
        description: 'Please enter at least one relearning step',
        variant: 'destructive',
      })
      return
    }

    try {
      setSavingSettings(true)
      const updated = await apiClient.updateSettings(token, {
        new_cards_per_day: newCardsPerDay,
        max_reviews_per_day: maxReviewsEnabled ? maxReviewsPerDay : null,
        learning_steps: learningSteps,
        relearning_steps: relearningSteps,
        graduating_interval: graduatingInterval,
        easy_interval: easyInterval,
        starting_ease: startingEase,
        easy_bonus: easyBonus,
        interval_modifier: intervalModifier,
        maximum_interval: maximumInterval,
        lapse_new_interval: lapseNewInterval,
        show_unreviewed_insights: showUnreviewedInsights,
        proficiency_level: proficiencyLevel,
      })
      setSettings(updated)
      // Normalize the input fields after save
      setLearningStepsInput(formatSteps(learningSteps))
      setRelearningStepsInput(formatSteps(relearningSteps))
      toast({
        title: 'Settings saved',
        description: 'Your SRS settings have been updated',
      })
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast({
        title: 'Error',
        description: 'Failed to save settings',
        variant: 'destructive',
      })
    } finally {
      setSavingSettings(false)
    }
  }

  const resetToDefaults = () => {
    setNewCardsPerDay(DEFAULT_SETTINGS.new_cards_per_day)
    setMaxReviewsPerDay(DEFAULT_SETTINGS.max_reviews_per_day)
    setMaxReviewsEnabled(false)
    setLearningStepsInput(formatSteps(DEFAULT_SETTINGS.learning_steps))
    setRelearningStepsInput(formatSteps(DEFAULT_SETTINGS.relearning_steps))
    setGraduatingInterval(DEFAULT_SETTINGS.graduating_interval)
    setEasyInterval(DEFAULT_SETTINGS.easy_interval)
    setStartingEase(DEFAULT_SETTINGS.starting_ease)
    setEasyBonus(DEFAULT_SETTINGS.easy_bonus)
    setIntervalModifier(DEFAULT_SETTINGS.interval_modifier)
    setMaximumInterval(DEFAULT_SETTINGS.maximum_interval)
    setLapseNewInterval(DEFAULT_SETTINGS.lapse_new_interval)
    setShowUnreviewedInsights(true)
    setProficiencyLevel('beginner')
  }

  const hasUnsavedChanges = settings && (
    newCardsPerDay !== settings.new_cards_per_day ||
    (maxReviewsEnabled ? maxReviewsPerDay : null) !== settings.max_reviews_per_day ||
    formatSteps(parseSteps(learningStepsInput)) !== formatSteps(settings.learning_steps) ||
    formatSteps(parseSteps(relearningStepsInput)) !== formatSteps(settings.relearning_steps) ||
    graduatingInterval !== settings.graduating_interval ||
    easyInterval !== settings.easy_interval ||
    startingEase !== settings.starting_ease ||
    easyBonus !== settings.easy_bonus ||
    intervalModifier !== settings.interval_modifier ||
    maximumInterval !== (settings.maximum_interval ?? DEFAULT_SETTINGS.maximum_interval) ||
    lapseNewInterval !== (settings.lapse_new_interval ?? DEFAULT_SETTINGS.lapse_new_interval) ||
    showUnreviewedInsights !== (settings.show_unreviewed_insights ?? true) ||
    proficiencyLevel !== (settings.proficiency_level ?? 'beginner')
  )

  const loadDebugData = async () => {
    if (!token) return
    try {
      setLoadingDebug(true)
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
      setLoadingDebug(false)
    }
  }

  const resetDailyReviews = async () => {
    if (!token) return
    try {
      setResettingReviews(true)
      startLoading()
      const response = await apiClient.resetDailyReviews(token)
      toast({
        title: 'Success',
        description: `Reset ${response.deleted_count} review(s) for today`,
      })
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await loadDebugData()
    } catch (error) {
      console.error('Failed to reset daily reviews:', error)
      toast({
        title: 'Error',
        description: 'Failed to reset daily reviews',
        variant: 'destructive',
      })
    } finally {
      setResettingReviews(false)
      stopLoading()
    }
  }

  const handleClearInsights = async () => {
    if (!token) return

    try {
      setClearingInsights(true)
      startLoading()
      const result = await apiClient.clearInsights(token)

      toast({
        title: 'Insights cleared',
        description: `Cleared insights from ${result.cleared_cards} cards and ${result.cleared_review_items} review items`,
      })
    } catch (error) {
      console.error('Failed to clear insights:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear insights',
        variant: 'destructive',
      })
    } finally {
      setClearingInsights(false)
      stopLoading()
    }
  }

  return (
    <PageLayout>
      <PageLayout.Header
        title="Settings"
        description="Configure your spaced repetition preferences"
        actions={
          !loadingSettings && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetToDefaults}
                disabled={savingSettings}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={saveSettings}
                disabled={savingSettings || !hasUnsavedChanges}
              >
                <Save className="h-4 w-4 mr-2" />
                {savingSettings ? 'Saving...' : 'Save'}
              </Button>
            </div>
          )
        }
      />

      <Tabs defaultValue="limits" className="flex flex-col flex-1 min-h-0">
        <PageLayout.TabsBar>
          <TabsList>
            <TabsTrigger value="limits">Limits</TabsTrigger>
            <TabsTrigger value="learning">Learning</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="lapses">Lapses</TabsTrigger>
            <TabsTrigger value="debug" className="text-destructive">Debug</TabsTrigger>
          </TabsList>
        </PageLayout.TabsBar>

        <PageLayout.Content className="mt-4">
          {/* Daily Limits Tab */}
          <TabsContent value="limits" className="space-y-6 mt-0">
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            ) : (
              <div className="max-w-md space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="new-cards-per-day">New cards per day</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="new-cards-per-day"
                      type="number"
                      min={0}
                      max={100}
                      value={newCardsPerDay}
                      onChange={(e) => setNewCardsPerDay(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">cards</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maximum new cards introduced each day (0-100)
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="max-reviews-enabled">Maximum reviews per day</Label>
                    <Switch
                      id="max-reviews-enabled"
                      checked={maxReviewsEnabled}
                      onCheckedChange={(checked) => {
                        setMaxReviewsEnabled(checked)
                        if (checked && maxReviewsPerDay === null) {
                          setMaxReviewsPerDay(200)
                        }
                      }}
                    />
                  </div>
                  {maxReviewsEnabled && (
                    <div className="flex items-center gap-4">
                      <Input
                        id="max-reviews-per-day"
                        type="number"
                        min={1}
                        max={9999}
                        value={maxReviewsPerDay ?? 200}
                        onChange={(e) => setMaxReviewsPerDay(Math.max(1, parseInt(e.target.value) || 200))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">reviews</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {maxReviewsEnabled
                      ? 'Limits total reviews per day (due cards may accumulate)'
                      : 'No limit on daily reviews (recommended)'}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Learning Tab */}
          <TabsContent value="learning" className="space-y-6 mt-0">
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            ) : (
              <div className="max-w-md space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="learning-steps">Learning steps (minutes)</Label>
                  <Input
                    id="learning-steps"
                    type="text"
                    value={learningStepsInput}
                    onChange={(e) => setLearningStepsInput(e.target.value)}
                    placeholder="1, 10"
                    className="w-48"
                  />
                  <p className="text-xs text-muted-foreground">
                    Intervals for learning cards (comma-separated minutes). Default: 1, 10
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="graduating-interval">Graduating interval</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="graduating-interval"
                      type="number"
                      min={1}
                      max={365}
                      value={graduatingInterval}
                      onChange={(e) => setGraduatingInterval(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    First interval after completing all learning steps
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="easy-interval">Easy interval</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="easy-interval"
                      type="number"
                      min={1}
                      max={365}
                      value={easyInterval}
                      onChange={(e) => setEasyInterval(Math.max(1, parseInt(e.target.value) || 4))}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    First interval when pressing Easy on a learning card
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-6 mt-0">
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            ) : (
              <div className="max-w-md space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="starting-ease">Starting ease</Label>
                    <span className="text-sm font-medium">{(startingEase * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="starting-ease"
                    min={130}
                    max={300}
                    step={5}
                    value={[startingEase * 100]}
                    onValueChange={(value) => setStartingEase(value[0] / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Initial ease factor for new cards (130% minimum, 250% default)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="easy-bonus">Easy bonus</Label>
                    <span className="text-sm font-medium">{(easyBonus * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="easy-bonus"
                    min={100}
                    max={200}
                    step={5}
                    value={[easyBonus * 100]}
                    onValueChange={(value) => setEasyBonus(value[0] / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Extra multiplier applied when pressing Easy (100% = no bonus)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="interval-modifier">Interval modifier</Label>
                    <span className="text-sm font-medium">{(intervalModifier * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="interval-modifier"
                    min={50}
                    max={200}
                    step={5}
                    value={[intervalModifier * 100]}
                    onValueChange={(value) => setIntervalModifier(value[0] / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Global multiplier for all intervals (100% = normal, lower = more reviews)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maximum-interval">Maximum interval</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="maximum-interval"
                      type="number"
                      min={1}
                      max={36500}
                      value={maximumInterval}
                      onChange={(e) => setMaximumInterval(Math.max(1, Math.min(36500, parseInt(e.target.value) || 365)))}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cards will never have an interval longer than this ({Math.round(maximumInterval / 365)} years)
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-4">AI Insights</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="show-unreviewed-insights">Show unreviewed insights</Label>
                        <p className="text-xs text-muted-foreground">
                          Display AI-approved insights during reviews before human review
                        </p>
                      </div>
                      <Switch
                        id="show-unreviewed-insights"
                        checked={showUnreviewedInsights}
                        onCheckedChange={setShowUnreviewedInsights}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proficiency-level">Dutch proficiency level</Label>
                      <Select
                        value={proficiencyLevel}
                        onValueChange={(value) => setProficiencyLevel(value as ProficiencyLevel)}
                      >
                        <SelectTrigger className="w-48" id="proficiency-level">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Adjusts the complexity and detail of AI-generated insights
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Lapses Tab */}
          <TabsContent value="lapses" className="space-y-6 mt-0">
            {loadingSettings ? (
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            ) : (
              <div className="max-w-md space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="relearning-steps">Relearning steps (minutes)</Label>
                  <Input
                    id="relearning-steps"
                    type="text"
                    value={relearningStepsInput}
                    onChange={(e) => setRelearningStepsInput(e.target.value)}
                    placeholder="10"
                    className="w-48"
                  />
                  <p className="text-xs text-muted-foreground">
                    Intervals when relearning a lapsed card (comma-separated minutes). Default: 10
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lapse-new-interval">New interval after lapse</Label>
                    <span className="text-sm font-medium">{lapseNewInterval}%</span>
                  </div>
                  <Slider
                    id="lapse-new-interval"
                    min={0}
                    max={100}
                    step={5}
                    value={[lapseNewInterval]}
                    onValueChange={(value) => setLapseNewInterval(value[0])}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of previous interval after lapse.
                    {lapseNewInterval === 0 && ' 0% resets to 1 day (Anki default).'}
                    {lapseNewInterval === 100 && ' 100% keeps the previous interval (lenient).'}
                    {lapseNewInterval > 0 && lapseNewInterval < 100 && ` A 30-day card becomes ${Math.max(1, Math.round(30 * lapseNewInterval / 100))} day(s).`}
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Debug Tab */}
          <TabsContent value="debug" className="space-y-6 mt-0">
            <div className="max-w-2xl rounded-lg border border-destructive/20 bg-destructive/5 p-4">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h3 className="font-semibold text-destructive">Developer Tools</h3>
              </div>

              {/* Review Queue Stats */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Review Queue Stats</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={loadDebugData}
                    disabled={loadingDebug}
                  >
                    {loadingDebug ? 'Loading...' : 'Refresh Stats'}
                  </Button>
                </div>
                {debugData && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-xs text-muted-foreground">Total in queue</div>
                      <div className="text-2xl font-bold">
                        {debugData.stats?.total_count || 0}
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-xs text-muted-foreground">NEW cards</div>
                      <div className="text-2xl font-bold">
                        {debugData.stats?.new_count || 0}
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-xs text-muted-foreground">Due reviews</div>
                      <div className="text-2xl font-bold">
                        {debugData.stats?.due_count || 0}
                      </div>
                    </div>
                    <div className="bg-muted p-3 rounded-md">
                      <div className="text-xs text-muted-foreground">NEW remaining</div>
                      <div className="text-2xl font-bold">
                        {debugData.stats?.new_remaining_today ?? '?'}
                      </div>
                    </div>
                  </div>
                )}
                {!debugData && (
                  <p className="text-sm text-muted-foreground">
                    Click "Refresh Stats" to load review queue statistics
                  </p>
                )}
              </div>

              {/* Reset Daily Reviews */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-1">Reset Today's Reviews</h4>
                    <p className="text-sm text-muted-foreground">
                      Clear today's review history. Useful for testing.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetDailyReviews}
                    disabled={resettingReviews}
                    className="ml-4"
                  >
                    {resettingReviews ? 'Resetting...' : 'Reset Reviews'}
                  </Button>
                </div>
              </div>

              {/* Clear Insights */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-1">Clear All Insights</h4>
                    <p className="text-sm text-muted-foreground">
                      Remove all AI-generated insights from cards and review items.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearInsights}
                    disabled={clearingInsights}
                    className="ml-4"
                  >
                    {clearingInsights ? 'Clearing...' : 'Clear Insights'}
                  </Button>
                </div>
              </div>

            </div>
          </TabsContent>
        </PageLayout.Content>
      </Tabs>
    </PageLayout>
  )
}
