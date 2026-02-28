import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { PageLayout } from '@/components/PageLayout'
import { Loader2, Play, Sparkles, Save, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { calculateCost } from '@/lib/bedrock-pricing'
import { convertUsdToEur, formatEur } from '@/lib/currency-converter'
import {
  getSessions,
  saveSession,
  deleteSession,
  generateSessionName,
  type AiLabSession,
  type ModelResult,
} from '@/lib/ai-lab-storage'
import ReactMarkdown from 'react-markdown'

const MODELS = [
  { id: 'global.anthropic.claude-opus-4-5-20251101-v1:0', name: 'Claude Opus 4.5', group: 'Claude' },
  { id: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0', name: 'Claude Sonnet 4.5', group: 'Claude' },
  { id: 'global.anthropic.claude-sonnet-4-20250514-v1:0', name: 'Claude Sonnet 4', group: 'Claude' },
  { id: 'global.anthropic.claude-haiku-4-5-20251001-v1:0', name: 'Claude Haiku 4.5', group: 'Claude' },
  { id: 'us.anthropic.claude-3-7-sonnet-20250219-v1:0', name: 'Claude 3.7 Sonnet', group: 'Claude' },
  { id: 'us.anthropic.claude-3-5-haiku-20241022-v1:0', name: 'Claude 3.5 Haiku', group: 'Claude' },
  { id: 'us.anthropic.claude-3-haiku-20240307-v1:0', name: 'Claude 3 Haiku', group: 'Claude' },
  { id: 'us.amazon.nova-premier-v1:0', name: 'Amazon Nova Premier', group: 'Nova' },
  { id: 'us.amazon.nova-pro-v1:0', name: 'Amazon Nova Pro', group: 'Nova' },
  { id: 'us.amazon.nova-lite-v1:0', name: 'Amazon Nova Lite', group: 'Nova' },
  { id: 'us.amazon.nova-micro-v1:0', name: 'Amazon Nova Micro', group: 'Nova' },
]

export function AiLabPage() {
  const { token } = useAuth()
  const { toast } = useToast()

  // Session management
  const [sessions, setSessions] = useState<AiLabSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  // Configuration
  const [systemPrompt, setSystemPrompt] = useState(
    'You are a Dutch/English translator. Translate English to natural, idiomatic Dutch.\n\nReturn ONLY the translation. No explanations, no additional text.\n\nThe input is ALWAYS in English.\n\nProvide natural Dutch translations, NOT literal word-for-word translations. Use Dutch idioms and expressions that native speakers would use.\n\nUse appropriate Dutch linguistic features like diminutives (-je, -tje, -pje) where they would sound natural in Dutch, even if the English source doesn\'t use them. Dutch speakers use diminutives much more frequently than English speakers.\n\nALWAYS return only a single translation, the most natural one.\n\nNEVER return an explanation about a word.'
  )
  const [userPrompt, setUserPrompt] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([MODELS[1].id])
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [topP, setTopP] = useState(0.9)
  const [topK, setTopK] = useState(250)

  // Results
  const [results, setResults] = useState<ModelResult[]>([])
  const [loading, setLoading] = useState(false)
  const [totalCostEur, setTotalCostEur] = useState<number>(0)
  const [resultsTab, setResultsTab] = useState<'results' | 'compare'>('results')
  const [resultsSortField, setResultsSortField] = useState<'model' | 'response' | 'cost' | 'tokens'>('model')
  const [resultsSortOrder, setResultsSortOrder] = useState<'asc' | 'desc'>('asc')

  // Comparison
  const [comparerModel, setComparerModel] = useState<string>('')
  const [comparerPrompt, setComparerPrompt] = useState(
    'Analyze each response for translation accuracy, naturalness, and appropriateness. Focus on differences in MEANING and word choice. Ignore superficial differences like capitalization and punctuation. Identify which translation is best and explain why, highlighting only meaningful semantic differences.'
  )
  const [comparisonResult, setComparisonResult] = useState<string | null>(null)
  const [_comparisonCostEur, setComparisonCostEur] = useState<number>(0)
  const [comparingLoading, setComparingLoading] = useState(false)

  const toggleResultsSort = (field: 'model' | 'response' | 'cost' | 'tokens') => {
    if (resultsSortField === field) {
      setResultsSortOrder(resultsSortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setResultsSortField(field)
      setResultsSortOrder('asc')
    }
  }

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      let aVal: string | number
      let bVal: string | number

      switch (resultsSortField) {
        case 'model':
          aVal = a.modelName
          bVal = b.modelName
          break
        case 'response':
          aVal = a.response
          bVal = b.response
          break
        case 'cost':
          aVal = a.cost
          bVal = b.cost
          break
        case 'tokens':
          aVal = a.inputTokens + a.outputTokens
          bVal = b.inputTokens + b.outputTokens
          break
        default:
          return 0
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return resultsSortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return resultsSortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [results, resultsSortField, resultsSortOrder])

  useEffect(() => {
    setSessions(getSessions())
  }, [])

  const handleModelToggle = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    )
  }

  const handleRunTests = async () => {
    if (!userPrompt.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a user prompt',
        variant: 'destructive',
      })
      return
    }

    if (selectedModels.length === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one model',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResults([])
    setComparisonResult(null)

    const newResults: ModelResult[] = []

    // Run all models in parallel
    await Promise.all(
      selectedModels.map(async (modelId) => {
        const model = MODELS.find((m) => m.id === modelId)
        if (!model) return

        try {
          const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bedrock/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              model: modelId,
              prompt: `${systemPrompt}\n\nUser: ${userPrompt}`,
              temperature,
              maxTokens,
              topP,
              topK,
            }),
          })

          const data = await res.json()

          if (!res.ok) {
            throw new Error(data.error || 'Request failed')
          }

          // Extract response text based on model type
          let responseText = ''
          if (data.response?.content) {
            // Claude format
            responseText = data.response.content[0]?.text || JSON.stringify(data.response)
          } else if (data.response?.output?.message?.content) {
            // Nova format
            responseText = data.response.output.message.content[0]?.text || JSON.stringify(data.response)
          } else {
            responseText = JSON.stringify(data.response)
          }

          const usage = data.response?.usage || data.response?.usage || {}
          const inputTokens = usage.input_tokens || usage.inputTokens || 0
          const outputTokens = usage.output_tokens || usage.outputTokens || 0

          const costData = calculateCost(modelId, inputTokens, outputTokens)

          newResults.push({
            modelId,
            modelName: model.name,
            response: responseText,
            rawResponse: data.response,
            inputTokens,
            outputTokens,
            cost: costData?.totalCost || 0,
            timestamp: Date.now(),
          })
        } catch (error) {
          console.error(`Error with ${model.name}:`, error)
          newResults.push({
            modelId,
            modelName: model.name,
            response: '',
            rawResponse: null,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          })
        }
      })
    )

    setResults(newResults)
    setLoading(false)

    // Calculate total cost in EUR
    const totalUsd = newResults.reduce((sum, r) => sum + r.cost, 0)
    const totalEur = await convertUsdToEur(totalUsd)
    setTotalCostEur(totalEur)

    // Auto-save session
    const sessionId = currentSessionId || `session-${Date.now()}`
    const session: AiLabSession = {
      id: sessionId,
      name: generateSessionName(userPrompt),
      systemPrompt,
      userPrompt,
      config: { temperature, maxTokens, topP, topK },
      selectedModels,
      results: newResults,
      createdAt: currentSessionId ? sessions.find((s) => s.id === sessionId)?.createdAt || Date.now() : Date.now(),
      updatedAt: Date.now(),
    }

    saveSession(session)
    setSessions(getSessions())
    setCurrentSessionId(sessionId)

    toast({
      title: 'Success',
      description: `Tested ${newResults.length} models`,
    })
  }

  const handleCompare = async () => {
    if (!comparerModel) {
      toast({
        title: 'Error',
        description: 'Please select a comparer model',
        variant: 'destructive',
      })
      return
    }

    if (results.length === 0) {
      toast({
        title: 'Error',
        description: 'No results to compare',
        variant: 'destructive',
      })
      return
    }

    setComparingLoading(true)

    try {
      const responsesText = results
        .map((r, i) => `Model ${i + 1} (${r.modelName}):\n${r.response}\n`)
        .join('\n---\n\n')

      const comparePrompt = `${systemPrompt}\n\nORIGINAL USER PROMPT: "${userPrompt}"\n\nRESPONSES FROM MODELS:\n${responsesText}\n\nUser: ${comparerPrompt}`

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/bedrock/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: comparerModel,
          prompt: comparePrompt,
          temperature,
          maxTokens,
          topP,
          topK,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Comparison failed')
      }

      let analysisText = ''
      if (data.response?.content) {
        analysisText = data.response.content[0]?.text || JSON.stringify(data.response)
      } else if (data.response?.output?.message?.content) {
        analysisText = data.response.output.message.content[0]?.text || JSON.stringify(data.response)
      } else {
        analysisText = JSON.stringify(data.response)
      }

      setComparisonResult(analysisText)

      // Calculate comparison cost
      const usage = data.response?.usage || data.response?.usage || {}
      const inputTokens = usage.input_tokens || usage.inputTokens || 0
      const outputTokens = usage.output_tokens || usage.outputTokens || 0
      const costData = calculateCost(comparerModel, inputTokens, outputTokens)

      if (costData) {
        const comparisonCostUsd = costData.totalCost
        const comparisonEur = await convertUsdToEur(comparisonCostUsd)
        setComparisonCostEur(comparisonEur)

        // Add to total session cost
        setTotalCostEur((prev) => prev + comparisonEur)
      }

      // Update session with comparison
      if (currentSessionId) {
        const session = sessions.find((s) => s.id === currentSessionId)
        if (session) {
          session.comparison = {
            comparerModel,
            comparerPrompt,
            analysis: analysisText,
            timestamp: Date.now(),
          }
          saveSession(session)
          setSessions(getSessions())
        }
      }

      toast({
        title: 'Success',
        description: 'Comparison complete',
      })
    } catch (error) {
      console.error('Comparison error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Comparison failed',
        variant: 'destructive',
      })
    } finally {
      setComparingLoading(false)
    }
  }

  const handleLoadSession = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!session) return

    setCurrentSessionId(session.id)
    setSystemPrompt(session.systemPrompt)
    setUserPrompt(session.userPrompt)
    setTemperature(session.config.temperature)
    setMaxTokens(session.config.maxTokens)
    setTopP(session.config.topP)
    setTopK(session.config.topK)
    setSelectedModels(session.selectedModels)
    setResults(session.results)

    // Calculate total cost in EUR
    const totalUsd = session.results.reduce((sum, r) => sum + r.cost, 0)
    const totalEur = await convertUsdToEur(totalUsd)
    setTotalCostEur(totalEur)

    if (session.comparison) {
      setComparerModel(session.comparison.comparerModel)
      setComparerPrompt(session.comparison.comparerPrompt)
      setComparisonResult(session.comparison.analysis)
    } else {
      setComparisonResult(null)
    }
  }

  const handleNewSession = () => {
    setCurrentSessionId(null)
    setSystemPrompt(
      'You are a Dutch/English translator. Translate between Dutch and English.\n\nReturn ONLY the translation in the target language. No explanations, no additional text.\n\nThe input is ALWAYS in English.\n\nALWAYS return only a single translation, the best you have.\n\nNEVER return an explanation about a word.'
    )
    setUserPrompt('')
    setResults([])
    setComparisonResult(null)
    setComparisonCostEur(0)
    setTotalCostEur(0)
    setSelectedModels([MODELS[1].id])
  }

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId)
    if (!confirm(`Delete session "${session?.name}"?`)) {
      return
    }

    deleteSession(sessionId)
    setSessions(getSessions())
    if (currentSessionId === sessionId) {
      handleNewSession()
    }
    toast({
      title: 'Deleted',
      description: 'Session deleted',
    })
  }

  const claudeModels = MODELS.filter((m) => m.group === 'Claude')
  const novaModels = MODELS.filter((m) => m.group === 'Nova')

  // Check if Claude 4.5 models are selected
  const hasClaude45 = selectedModels.some(
    (id) => id.includes('opus-4-5') || id.includes('sonnet-4-5') || id.includes('haiku-4-5')
  )
  const hasNova = selectedModels.some((id) => id.includes('nova'))

  return (
    <PageLayout>
      <PageLayout.Header
        title="AI Lab"
        description="Compare models side-by-side with custom prompts"
        actions={
          <div className="flex gap-3 items-center">
            {totalCostEur > 0 && (
              <span className="text-xs text-black/50">{formatEur(totalCostEur)}</span>
            )}
            <Select value={currentSessionId || ''} onValueChange={handleLoadSession}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Load session..." />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((session) => (
                  <SelectItem key={session.id} value={session.id}>
                    {session.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleNewSession} variant="outline" size="sm">
              <Save className="mr-2 h-4 w-4" />
              New
            </Button>
            {currentSessionId && (
              <Button
                onClick={() => handleDeleteSession(currentSessionId)}
                variant="outline"
                size="sm"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Configuration Panel */}
          <Card className="lg:w-80 flex-shrink-0 bg-white/30 overflow-auto">
            <CardHeader className="p-4 pb-2">
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              {/* System Prompt */}
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="System instructions..."
                  rows={3}
                  className="text-sm"
                />
              </div>

              {/* User Prompt */}
              <div className="space-y-2">
                <Label>User Prompt</Label>
                <Textarea
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="Your question or prompt..."
                  rows={4}
                  className="text-sm"
                />
              </div>

              {/* Model Selection */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Select Models</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedModels(MODELS.map((m) => m.id))}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setSelectedModels([])}
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                      Claude Models
                    </div>
                    <div className="space-y-2">
                      {claudeModels.map((model) => (
                        <div key={model.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={model.id}
                            checked={selectedModels.includes(model.id)}
                            onCheckedChange={() => handleModelToggle(model.id)}
                          />
                          <label
                            htmlFor={model.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {model.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                      Nova Models
                    </div>
                    <div className="space-y-2">
                      {novaModels.map((model) => (
                        <div key={model.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={model.id}
                            checked={selectedModels.includes(model.id)}
                            onCheckedChange={() => handleModelToggle(model.id)}
                          />
                          <label
                            htmlFor={model.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {model.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Parameters */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Temperature ({temperature})</Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(parseFloat(e.target.value))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Max Tokens ({maxTokens})</Label>
                    <Input
                      type="number"
                      min="1"
                      max="4096"
                      value={maxTokens}
                      onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Top P ({topP}){hasClaude45 && ' (ignored)'}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={topP}
                      onChange={(e) => setTopP(parseFloat(e.target.value))}
                      className={`text-sm ${hasClaude45 ? 'opacity-50' : ''}`}
                      disabled={hasClaude45}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">
                      Top K ({topK}){hasNova && topK > 128 && ' → 128'}
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max={hasNova ? 128 : 500}
                      value={topK}
                      onChange={(e) => setTopK(parseInt(e.target.value))}
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleRunTests} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Tests
                  </>
                )}
              </Button>

              {(hasClaude45 || (hasNova && topK > 128)) && (
                <div className="text-xs text-black/40 space-y-1">
                  {hasClaude45 && <p>Claude 4.5: Top P ignored</p>}
                  {hasNova && topK > 128 && <p>Nova: Top K capped at 128</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="flex-1 space-y-4 overflow-auto min-h-0">
            {results.length === 0 && !loading && (
              <Card className="bg-white/30">
                <CardContent className="py-12 text-center text-black/40">
                  <Sparkles className="h-12 w-12 mx-auto mb-4" />
                  <p>Select models and run tests to see results</p>
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card className="bg-white/30">
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-muted-foreground">Running tests...</p>
                </CardContent>
              </Card>
            )}

            {results.length > 0 && (
              <Tabs value={resultsTab} onValueChange={(v) => setResultsTab(v as 'results' | 'compare')} className="flex flex-col h-full">
                <TabsList className="w-fit">
                  <TabsTrigger value="results">Results</TabsTrigger>
                  <TabsTrigger value="compare">Compare</TabsTrigger>
                </TabsList>

                <TabsContent value="results" className="flex-1 overflow-auto mt-4">
                  <div className="rounded-[10px] bg-white/30">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[180px]">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-7"
                              onClick={() => toggleResultsSort('model')}
                            >
                              Model
                              {resultsSortField === 'model' ? (
                                resultsSortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-ml-3 h-7"
                              onClick={() => toggleResultsSort('response')}
                            >
                              Response
                              {resultsSortField === 'response' ? (
                                resultsSortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[80px] text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-mr-3 h-7"
                              onClick={() => toggleResultsSort('tokens')}
                            >
                              Tokens
                              {resultsSortField === 'tokens' ? (
                                resultsSortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              )}
                            </Button>
                          </TableHead>
                          <TableHead className="w-[70px] text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="-mr-3 h-7"
                              onClick={() => toggleResultsSort('cost')}
                            >
                              Cost
                              {resultsSortField === 'cost' ? (
                                resultsSortOrder === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
                              ) : (
                                <ArrowUpDown className="ml-1 h-3 w-3" />
                              )}
                            </Button>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedResults.map((result, index) => (
                          <TableRow key={`${result.modelId}-${index}`}>
                            <TableCell className="font-medium text-sm align-top py-3">
                              {result.modelName}
                            </TableCell>
                            <TableCell className="align-top py-3">
                              {result.error ? (
                                <span className="text-destructive text-sm">Error: {result.error}</span>
                              ) : (
                                <pre className="whitespace-pre-wrap text-sm">{result.response}</pre>
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs text-black/50 align-top py-3">
                              {result.inputTokens + result.outputTokens}
                            </TableCell>
                            <TableCell className="text-right text-xs text-black/50 align-top py-3">
                              ${result.cost.toFixed(4)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="compare" className="flex-1 overflow-auto mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Comparer Model</Label>
                      <Select value={comparerModel} onValueChange={setComparerModel}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select model..." />
                        </SelectTrigger>
                        <SelectContent>
                          {MODELS.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Comparison Prompt</Label>
                      <Textarea
                        value={comparerPrompt}
                        onChange={(e) => setComparerPrompt(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleCompare}
                    disabled={comparingLoading || !comparerModel}
                    className="w-full"
                  >
                    {comparingLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Compare Results
                      </>
                    )}
                  </Button>

                  {comparisonResult && (
                    <Card className="bg-white/30">
                      <CardContent className="p-4">
                        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-li:my-1 prose-ul:my-2 prose-ol:my-2">
                          <ReactMarkdown>{comparisonResult}</ReactMarkdown>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
      </div>
    </PageLayout>
  )
}
