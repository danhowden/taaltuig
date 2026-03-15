import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useApiMutation } from '@/hooks/useApiMutation'
import { apiClient } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PencilLine, Plus, Loader2, Check, X, Circle } from 'lucide-react'
import type { CardExerciseLink, GenerateExercisesResponse, ExerciseType } from '@/types'

interface CardExercisesPopoverProps {
  cardId: string
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Check className="h-3 w-3 text-green-600" />
    case 'rejected':
    case 'expired':
      return <X className="h-3 w-3 text-red-400" />
    default:
      return <Circle className="h-3 w-3 text-muted-foreground" />
  }
}

function exerciseTypeLabel(type: string): string {
  switch (type) {
    case 'translation': return 'Translation'
    case 'fill_blank': return 'Fill-blank'
    case 'word_reorder': return 'Reorder'
    case 'guided_write': return 'Guided'
    case 'paragraph_write': return 'Paragraph'
    default: return type
  }
}

export function CardExercisesPopover({ cardId }: CardExercisesPopoverProps) {
  const { token } = useAuth()
  const [open, setOpen] = useState(false)

  const { data: exercises, refetch } = useApiQuery<CardExerciseLink[]>({
    queryKey: ['card-exercises', cardId],
    queryFn: async () => {
      if (!token) throw new Error('No token')
      return apiClient.getExercisesForCard(token, cardId)
    },
    enabled: !!token && open,
    staleTime: 30_000,
  })

  const generateMutation = useApiMutation<GenerateExercisesResponse, { exercise_type?: ExerciseType }>({
    mutationFn: async (data) => {
      if (!token) throw new Error('No token')
      return apiClient.generateWritingExercises(token, {
        card_id: cardId,
        ...data,
      })
    },
    onSuccess: () => {
      refetch()
    },
    showLoader: false,
  })

  const count = exercises?.length ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
          <PencilLine className="h-3 w-3" />
          {count > 0 ? count : '-'}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Exercises</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  Generate
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => generateMutation.mutate({})}>
                  All types
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateMutation.mutate({ exercise_type: 'translation' })}>
                  Translation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateMutation.mutate({ exercise_type: 'fill_blank' })}>
                  Fill-in-blank
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateMutation.mutate({ exercise_type: 'word_reorder' })}>
                  Word reorder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {exercises && exercises.length > 0 ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {exercises.map((ex) => (
                <div
                  key={ex.exercise_id}
                  className="flex items-start gap-2 text-xs py-1"
                >
                  <StatusIcon status={ex.exercise_status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {exerciseTypeLabel(ex.exercise_type)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground truncate mt-0.5" title={ex.prompt}>
                      {ex.prompt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-2">
              No exercises yet. Generate some to practice this word in context.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
