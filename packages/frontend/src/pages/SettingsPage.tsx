import { useState, useEffect, useMemo } from 'react'
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
const DEFAULT_FORM: SettingsForm = {
  newCardsPerDay: 20,
  maxReviewsPerDay: null,
  maxReviewsEnabled: false,
  learningStepsInput: '1, 10',
  relearningStepsInput: '10',
  graduatingInterval: 1,
  easyInterval: 4,
  startingEase: 2.5,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  maximumInterval: 36500,
  lapseNewInterval: 0,
  showUnreviewedInsights: true,
  proficiencyLevel: 'beginner',
  writingExercisesPerDay: 10,
  writingSessionEnabled: true,
}

interface SettingsForm {
  newCardsPerDay: number
  maxReviewsPerDay: number | null
  maxReviewsEnabled: boolean
  learningStepsInput: string
  relearningStepsInput: string
  graduatingInterval: number
  easyInterval: number
  startingEase: number
  easyBonus: number
  intervalModifier: number
  maximumInterval: number
  lapseNewInterval: number
  showUnreviewedInsights: boolean
  proficiencyLevel: ProficiencyLevel
  writingExercisesPerDay: number
  writingSessionEnabled: boolean
}

function parseSteps(input: string): number[] {
  return input
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
}

function formatSteps(steps: number[]): string {
  return steps.join(', ')
}

function settingsToForm(s: UserSettings): SettingsForm {
  return {
    newCardsPerDay: s.new_cards_per_day,
    maxReviewsPerDay: s.max_reviews_per_day,
    maxReviewsEnabled: s.max_reviews_per_day !== null,
    learningStepsInput: formatSteps(s.learning_steps),
    relearningStepsInput: formatSteps(s.relearning_steps),
    graduatingInterval: s.graduating_interval,
    easyInterval: s.easy_interval,
    startingEase: s.starting_ease,
    easyBonus: s.easy_bonus,
    intervalModifier: s.interval_modifier,
    maximumInterval: s.maximum_interval ?? 36500,
    lapseNewInterval: s.lapse_new_interval ?? 0,
    showUnreviewedInsights: s.show_unreviewed_insights ?? true,
    proficiencyLevel: s.proficiency_level ?? 'beginner',
    writingExercisesPerDay: s.writing_exercises_per_day ?? 10,
    writingSessionEnabled: s.writing_session_enabled ?? true,
  }
}

export function SettingsPage() {
  const { token } = useAuth()
  const { startLoading, stopLoading } = useLoading()
  const { toast } = useToast()

  const [debugData, setDebugData] = useState<QueueResponse | null>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)
  const [resettingReviews, setResettingReviews] = useState(false)
  const [clearingInsights, setClearingInsights] = useState(false)
  const [clearingExercises, setClearingExercises] = useState(false)

  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM)

  const updateForm = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!token) return
      try {
        setLoadingSettings(true)
        const userSettings = await apiClient.getSettings(token)
        setSettings(userSettings)
        setForm(settingsToForm(userSettings))
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

    const learningSteps = parseSteps(form.learningStepsInput)
    const relearningSteps = parseSteps(form.relearningStepsInput)

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
        new_cards_per_day: form.newCardsPerDay,
        max_reviews_per_day: form.maxReviewsEnabled ? form.maxReviewsPerDay : null,
        learning_steps: learningSteps,
        relearning_steps: relearningSteps,
        graduating_interval: form.graduatingInterval,
        easy_interval: form.easyInterval,
        starting_ease: form.startingEase,
        easy_bonus: form.easyBonus,
        interval_modifier: form.intervalModifier,
        maximum_interval: form.maximumInterval,
        lapse_new_interval: form.lapseNewInterval,
        show_unreviewed_insights: form.showUnreviewedInsights,
        proficiency_level: form.proficiencyLevel,
        writing_exercises_per_day: form.writingExercisesPerDay,
        writing_session_enabled: form.writingSessionEnabled,
      })
      setSettings(updated)
      updateForm('learningStepsInput', formatSteps(learningSteps))
      updateForm('relearningStepsInput', formatSteps(relearningSteps))
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

  const resetToDefaults = () => setForm(DEFAULT_FORM)

  const hasUnsavedChanges = useMemo(() => {
    if (!settings) return false
    const saved = settingsToForm(settings)
    return (
      form.newCardsPerDay !== saved.newCardsPerDay ||
      (form.maxReviewsEnabled ? form.maxReviewsPerDay : null) !== saved.maxReviewsPerDay ||
      formatSteps(parseSteps(form.learningStepsInput)) !== saved.learningStepsInput ||
      formatSteps(parseSteps(form.relearningStepsInput)) !== saved.relearningStepsInput ||
      form.graduatingInterval !== saved.graduatingInterval ||
      form.easyInterval !== saved.easyInterval ||
      form.startingEase !== saved.startingEase ||
      form.easyBonus !== saved.easyBonus ||
      form.intervalModifier !== saved.intervalModifier ||
      form.maximumInterval !== saved.maximumInterval ||
      form.lapseNewInterval !== saved.lapseNewInterval ||
      form.showUnreviewedInsights !== saved.showUnreviewedInsights ||
      form.proficiencyLevel !== saved.proficiencyLevel ||
      form.writingExercisesPerDay !== saved.writingExercisesPerDay ||
      form.writingSessionEnabled !== saved.writingSessionEnabled
    )
  }, [form, settings])

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

  const handleClearExercises = async () => {
    if (!token) return

    try {
      setClearingExercises(true)
      startLoading()
      const result = await apiClient.clearIncompleteExercises(token)

      toast({
        title: 'Exercises cleared',
        description: `Deleted ${result.deleted} incomplete exercises`,
      })
    } catch (error) {
      console.error('Failed to clear exercises:', error)
      toast({
        title: 'Error',
        description: 'Failed to clear exercises',
        variant: 'destructive',
      })
    } finally {
      setClearingExercises(false)
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
                      value={form.newCardsPerDay}
                      onChange={(e) => updateForm('newCardsPerDay', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
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
                      checked={form.maxReviewsEnabled}
                      onCheckedChange={(checked) => {
                        updateForm('maxReviewsEnabled', checked)
                        if (checked && form.maxReviewsPerDay === null) {
                          updateForm('maxReviewsPerDay', 200)
                        }
                      }}
                    />
                  </div>
                  {form.maxReviewsEnabled && (
                    <div className="flex items-center gap-4">
                      <Input
                        id="max-reviews-per-day"
                        type="number"
                        min={1}
                        max={9999}
                        value={form.maxReviewsPerDay ?? 200}
                        onChange={(e) => updateForm('maxReviewsPerDay', Math.max(1, parseInt(e.target.value) || 200))}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">reviews</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {form.maxReviewsEnabled
                      ? 'Limits total reviews per day (due cards may accumulate)'
                      : 'No limit on daily reviews (recommended)'}
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium text-sm mb-4">Writing Practice</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="writing-session-enabled">Enable writing exercises</Label>
                        <p className="text-xs text-muted-foreground">
                          Practice writing Dutch after completing flashcard reviews
                        </p>
                      </div>
                      <Switch
                        id="writing-session-enabled"
                        checked={form.writingSessionEnabled}
                        onCheckedChange={(v) => updateForm('writingSessionEnabled', v)}
                      />
                    </div>

                    {form.writingSessionEnabled && (
                      <div className="space-y-2">
                        <Label htmlFor="writing-exercises-per-day">Writing exercises per day</Label>
                        <div className="flex items-center gap-4">
                          <Input
                            id="writing-exercises-per-day"
                            type="number"
                            min={1}
                            max={50}
                            value={form.writingExercisesPerDay}
                            onChange={(e) => updateForm('writingExercisesPerDay', Math.max(1, Math.min(50, parseInt(e.target.value) || 10)))}
                            className="w-24"
                          />
                          <span className="text-sm text-muted-foreground">exercises</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Maximum writing exercises generated from reviewed cards (1-50)
                        </p>
                      </div>
                    )}
                  </div>
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
                    value={form.learningStepsInput}
                    onChange={(e) => updateForm('learningStepsInput', e.target.value)}
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
                      value={form.graduatingInterval}
                      onChange={(e) => updateForm('graduatingInterval', Math.max(1, parseInt(e.target.value) || 1))}
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
                      value={form.easyInterval}
                      onChange={(e) => updateForm('easyInterval', Math.max(1, parseInt(e.target.value) || 4))}
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
                    <span className="text-sm font-medium">{(form.startingEase * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="starting-ease"
                    min={130}
                    max={300}
                    step={5}
                    value={[form.startingEase * 100]}
                    onValueChange={(value) => updateForm('startingEase', value[0] / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Initial ease factor for new cards (130% minimum, 250% default)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="easy-bonus">Easy bonus</Label>
                    <span className="text-sm font-medium">{(form.easyBonus * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="easy-bonus"
                    min={100}
                    max={200}
                    step={5}
                    value={[form.easyBonus * 100]}
                    onValueChange={(value) => updateForm('easyBonus', value[0] / 100)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Extra multiplier applied when pressing Easy (100% = no bonus)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="interval-modifier">Interval modifier</Label>
                    <span className="text-sm font-medium">{(form.intervalModifier * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    id="interval-modifier"
                    min={50}
                    max={200}
                    step={5}
                    value={[form.intervalModifier * 100]}
                    onValueChange={(value) => updateForm('intervalModifier', value[0] / 100)}
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
                      value={form.maximumInterval}
                      onChange={(e) => updateForm('maximumInterval', Math.max(1, Math.min(36500, parseInt(e.target.value) || 365)))}
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">days</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cards will never have an interval longer than this ({Math.round(form.maximumInterval / 365)} years)
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
                        checked={form.showUnreviewedInsights}
                        onCheckedChange={(v) => updateForm('showUnreviewedInsights', v)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="proficiency-level">Dutch proficiency level</Label>
                      <Select
                        value={form.proficiencyLevel}
                        onValueChange={(value) => updateForm('proficiencyLevel', value as ProficiencyLevel)}
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
                    value={form.relearningStepsInput}
                    onChange={(e) => updateForm('relearningStepsInput', e.target.value)}
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
                    <span className="text-sm font-medium">{form.lapseNewInterval}%</span>
                  </div>
                  <Slider
                    id="lapse-new-interval"
                    min={0}
                    max={100}
                    step={5}
                    value={[form.lapseNewInterval]}
                    onValueChange={(value) => updateForm('lapseNewInterval', value[0])}
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of previous interval after lapse.
                    {form.lapseNewInterval === 0 && ' 0% resets to 1 day (Anki default).'}
                    {form.lapseNewInterval === 100 && ' 100% keeps the previous interval (lenient).'}
                    {form.lapseNewInterval > 0 && form.lapseNewInterval < 100 && ` A 30-day card becomes ${Math.max(1, Math.round(30 * form.lapseNewInterval / 100))} day(s).`}
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

              {/* Clear Incomplete Exercises */}
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 mb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm mb-1">Clear Incomplete Exercises</h4>
                    <p className="text-sm text-muted-foreground">
                      Delete all pending, served, and expired writing exercises. Completed exercises are kept.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearExercises}
                    disabled={clearingExercises}
                    className="ml-4"
                  >
                    {clearingExercises ? 'Clearing...' : 'Clear Exercises'}
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
