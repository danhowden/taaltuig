import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface CardsSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  showHint?: boolean
}

export function CardsSearchBar({
  searchQuery,
  onSearchChange,
}: CardsSearchBarProps) {
  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
      <Input
        placeholder="Search..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-8 text-xs pl-8 w-full"
      />
    </div>
  )
}
