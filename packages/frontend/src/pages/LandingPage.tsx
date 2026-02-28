import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { TaaltuigLogo } from '@/components/TaaltuigLogo'

export function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6">
      <TaaltuigLogo size={160} />
      <h1 className="text-5xl font-bold tracking-tight">Taaltuig</h1>
      <p className="text-black/50 text-lg">
        Master Dutch with spaced repetition
      </p>
      <Button asChild size="lg">
        <Link to="/login">Get Started</Link>
      </Button>
    </div>
  )
}
