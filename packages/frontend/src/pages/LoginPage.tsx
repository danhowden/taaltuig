import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { GoogleLogin, CredentialResponse } from '@react-oauth/google'
import { TaaltuigLogo } from '@/components/TaaltuigLogo'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/review')
    }
  }, [isAuthenticated, navigate])

  const handleGoogleSuccess = (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      // The credential is the JWT ID token from Google
      login(credentialResponse.credential)
    }
  }

  const handleGoogleError = () => {
    console.error('Google Sign-In failed')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      {/* Logo - larger on mobile for visual impact */}
      <div className="mb-8">
        <TaaltuigLogo size={80} animate={true} showWordmark={true} />
      </div>

      <Card className="w-full max-w-sm border-white/40 bg-white/70 backdrop-blur-xl">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-2xl md:text-3xl">Welcome</CardTitle>
          <CardDescription>Sign in to start learning Dutch</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              useOneTap
              theme="outline"
              size="large"
              text="signin_with"
              shape="rectangular"
              width={280}
            />
          </div>
          <p className="text-center text-xs text-muted-foreground px-4">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
