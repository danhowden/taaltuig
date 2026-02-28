import { useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLoading } from '@/contexts/LoadingContext'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileUp, CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react'
import { MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB } from '@/constants/cards'

interface AnkiImportProps {
  onImportComplete?: () => void
}

type ImportStatus = 'idle' | 'uploading' | 'downloading' | 'parsing' | 'found' | 'importing' | 'success' | 'error'

interface ProgressUpdate {
  stage: 'downloading' | 'parsing' | 'found' | 'importing' | 'complete' | 'error'
  message: string
  count?: number
  current?: number
  total?: number
  imported?: number
  skipped?: number
}

export function AnkiImport({ onImportComplete }: AnkiImportProps) {
  const { token } = useAuth()
  const { toast } = useToast()
  const { startLoading, stopLoading } = useLoading()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [isOpen, setIsOpen] = useState(false)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [collectionName, setCollectionName] = useState('')
  const [result, setResult] = useState<{
    imported: number
    skipped: number
    total: number
  } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [cardCount, setCardCount] = useState<{ current: number; total: number } | null>(null)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const wsRef = useRef<WebSocket | null>(null)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.apkg')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an .apkg file',
        variant: 'destructive',
      })
      return
    }

    // Validate file size
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${MAX_UPLOAD_SIZE_MB}MB`,
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    // Auto-populate collection name from filename (without .apkg extension)
    const defaultName = file.name.replace(/\.apkg$/i, '')
    setCollectionName(defaultName)
    setStatus('idle')
    setResult(null)
    setErrorMessage('')
  }

  const handleImport = async () => {
    if (!selectedFile || !token) return

    try {
      startLoading()
      setStatus('uploading')

      // Step 1: Get presigned URL
      const uploadResponse = await apiClient.getUploadUrl(token, {
        filename: selectedFile.name,
      })

      // Step 2: Upload file directly to S3
      const uploadUrl = uploadResponse.upload_url || uploadResponse.uploadUrl
      if (!uploadUrl) {
        throw new Error('No upload URL received from server')
      }

      const uploadResult = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
      })

      if (!uploadResult.ok) {
        throw new Error('Failed to upload file to S3')
      }

      setCompletedTasks(new Set(['uploading']))

      // Step 3: Connect to WebSocket and start import
      const wsUrl = import.meta.env.VITE_WS_API_URL
      if (!wsUrl) {
        throw new Error('WebSocket URL not configured')
      }

      // Add token as query parameter for WebSocket auth
      const wsUrlWithAuth = `${wsUrl}?token=${encodeURIComponent(token)}`
      const ws = new WebSocket(wsUrlWithAuth)
      wsRef.current = ws

      ws.onopen = () => {
        // Send import request
        const s3Bucket = uploadResponse.s3_bucket || uploadResponse.s3Bucket
        const s3Key = uploadResponse.s3_key || uploadResponse.s3Key
        ws.send(
          JSON.stringify({
            action: 'importAnki',
            s3Bucket,
            s3_bucket: s3Bucket,
            s3Key,
            s3_key: s3Key,
            collectionName: collectionName.trim() || undefined,
          })
        )
      }

      ws.onmessage = (event) => {
        const update: ProgressUpdate = JSON.parse(event.data)

        switch (update.stage) {
          case 'downloading':
            setStatus('downloading')
            break

          case 'parsing':
            setStatus('parsing')
            setCompletedTasks(prev => new Set([...prev, 'downloading']))
            break

          case 'found':
            setStatus('found')
            setCompletedTasks(prev => new Set([...prev, 'parsing']))
            if (update.count) {
              setCardCount({ current: 0, total: update.count })
            }
            break

          case 'importing':
            setStatus('importing')
            setCompletedTasks(prev => new Set([...prev, 'found']))
            if (update.current && update.total) {
              setCardCount({ current: update.current, total: update.total })
            }
            break

          case 'complete':
            setStatus('success')
            setCompletedTasks(prev => new Set([...prev, 'importing']))
            setResult({
              imported: update.imported || 0,
              skipped: update.skipped || 0,
              total: (update.imported || 0) + (update.skipped || 0),
            })
            toast({
              title: 'Import successful',
              description: `Imported ${update.imported} cards from Anki deck`,
            })
            // Invalidate cards query to refresh sidebar count
            queryClient.invalidateQueries({ queryKey: ['cards'] })
            onImportComplete?.()
            ws.close()
            break

          case 'error':
            setStatus('error')
            setErrorMessage(update.message)
            toast({
              title: 'Import failed',
              description: update.message,
              variant: 'destructive',
            })
            ws.close()
            break
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setStatus('error')
        setErrorMessage('Connection error occurred')
        toast({
          title: 'Connection error',
          description: 'Failed to connect to import service',
          variant: 'destructive',
        })
      }

      ws.onclose = () => {
        wsRef.current = null
        stopLoading()
      }
    } catch (error) {
      console.error('Import failed:', error)
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'Unknown error occurred'
      )
      toast({
        title: 'Import failed',
        description: 'Failed to import Anki deck. Please try again.',
        variant: 'destructive',
      })
      stopLoading()
    }
  }

  const handleClose = () => {
    // Close WebSocket if open
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsOpen(false)
    setStatus('idle')
    setSelectedFile(null)
    setCollectionName('')
    setResult(null)
    setErrorMessage('')
    setCardCount(null)
    setCompletedTasks(new Set())
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
      >
        <Upload className="h-3.5 w-3.5" />
        Import
      </Button>

      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Import Anki Deck</DialogTitle>
            <DialogDescription>
              Upload an .apkg file to import flashcards into Taaltuig. All
              cards will start as NEW items in your review queue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* File selector */}
            {status === 'idle' && !selectedFile && (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center hover:border-muted-foreground/50 transition-colors">
                <FileUp className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Select an Anki deck file (.apkg)
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="secondary"
                  size="sm"
                >
                  Choose File
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apkg"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            )}

            {/* Selected file */}
            {selectedFile && status === 'idle' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center gap-3">
                    <FileUp className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedFile(null)
                      setCollectionName('')
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    variant="ghost"
                    size="icon"
                  >
                    <XCircle className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collectionName">
                    Collection Name
                    <span className="text-xs text-muted-foreground ml-2">
                      (used to organize categories)
                    </span>
                  </Label>
                  <Input
                    id="collectionName"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    placeholder="e.g., Dutch Basics 2024"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cards will be organized as "{collectionName || 'Collection'}/Category Name"
                  </p>
                </div>
              </div>
            )}

            {/* Progress */}
            {status !== 'idle' && status !== 'success' && status !== 'error' && (
              <div className="space-y-4">
                {/* File being imported */}
                {selectedFile && (
                  <div className="flex items-center gap-3 pb-3 border-b">
                    <FileUp className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                )}

                {/* Task list */}
                <div className="space-y-2">
                  {[
                    { id: 'uploading', label: 'Uploading deck to S3' },
                    { id: 'downloading', label: 'Downloading from S3' },
                    { id: 'parsing', label: 'Parsing Anki deck' },
                    {
                      id: 'found',
                      label: cardCount && cardCount.total > 0
                        ? `Found ${cardCount.total} cards`
                        : 'Analyzing cards'
                    },
                    {
                      id: 'importing',
                      label: cardCount && cardCount.current > 0
                        ? `Importing cards (${cardCount.current}/${cardCount.total})`
                        : 'Importing cards'
                    },
                  ].map((task) => {
                    const isComplete = completedTasks.has(task.id)
                    const isActive = !isComplete && (
                      (task.id === 'uploading' && status === 'uploading') ||
                      (task.id === 'downloading' && status === 'downloading') ||
                      (task.id === 'parsing' && status === 'parsing') ||
                      (task.id === 'found' && status === 'found') ||
                      (task.id === 'importing' && status === 'importing')
                    )

                    return (
                      <div key={task.id} className="space-y-1">
                        <div className="flex items-center gap-3">
                          {isComplete ? (
                            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                          ) : isActive ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary flex-shrink-0" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/30 flex-shrink-0" />
                          )}
                          <span
                            className={`text-sm ${
                              isComplete
                                ? 'text-muted-foreground'
                                : isActive
                                ? 'text-foreground font-medium'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {task.label}
                          </span>
                        </div>
                        {/* Progress bar for importing task */}
                        {task.id === 'importing' && isActive && cardCount && cardCount.total > 0 && (
                          <div className="ml-8 mr-2">
                            <Progress
                              value={(cardCount.current / cardCount.total) * 100}
                              className="h-1.5"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Success */}
            {status === 'success' && result && (
              <div className="flex flex-col items-center justify-center rounded-lg bg-green-500/10 p-6 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                <p className="font-semibold text-lg mb-2">Import Successful!</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Imported: {result.imported} cards</p>
                  {result.skipped > 0 && <p>Skipped: {result.skipped} cards</p>}
                  <p>Total: {result.total} notes</p>
                </div>
              </div>
            )}

            {/* Error */}
            {status === 'error' && (
              <div className="flex flex-col items-center justify-center rounded-lg bg-destructive/10 p-6 text-center">
                <XCircle className="h-12 w-12 text-destructive mb-4" />
                <p className="font-semibold text-lg mb-2">Import Failed</p>
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            {status === 'success' || status === 'error' ? (
              <Button onClick={handleClose}>Close</Button>
            ) : (
              <>
                <Button onClick={handleClose} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || status !== 'idle'}
                >
                  Import
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
