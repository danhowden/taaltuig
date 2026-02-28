/**
 * AI Lab Session Storage
 * Manages localStorage for AI Lab test sessions
 */

export interface ModelResult {
  modelId: string
  modelName: string
  response: string
  rawResponse: unknown
  inputTokens: number
  outputTokens: number
  cost: number
  error?: string
  timestamp: number
}

export interface ComparisonResult {
  comparerModel: string
  comparerPrompt: string
  analysis: string
  timestamp: number
}

export interface AiLabSession {
  id: string
  name: string
  systemPrompt: string
  userPrompt: string
  config: {
    temperature: number
    maxTokens: number
    topP: number
    topK: number
  }
  selectedModels: string[]
  results: ModelResult[]
  comparison?: ComparisonResult
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'ai-lab-sessions'
const MAX_SESSIONS = 50

export function getSessions(): AiLabSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to load sessions:', error)
    return []
  }
}

export function saveSession(session: AiLabSession): void {
  try {
    const sessions = getSessions()
    const existingIndex = sessions.findIndex((s) => s.id === session.id)

    if (existingIndex >= 0) {
      sessions[existingIndex] = { ...session, updatedAt: Date.now() }
    } else {
      sessions.unshift({ ...session, updatedAt: Date.now() })
    }

    // Keep only MAX_SESSIONS most recent
    const trimmed = sessions.slice(0, MAX_SESSIONS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  } catch (error) {
    console.error('Failed to save session:', error)
  }
}

export function deleteSession(sessionId: string): void {
  try {
    const sessions = getSessions()
    const filtered = sessions.filter((s) => s.id !== sessionId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error('Failed to delete session:', error)
  }
}

export function generateSessionName(userPrompt: string): string {
  const truncated = userPrompt.slice(0, 50)
  const date = new Date().toLocaleDateString()
  return `${truncated}${userPrompt.length > 50 ? '...' : ''} - ${date}`
}
