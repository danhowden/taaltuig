import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface LoadingContextType {
  isLoading: boolean
  startLoading: () => void
  stopLoading: () => void
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined)

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [loadingCount, setLoadingCount] = useState(0)

  const startLoading = useCallback(() => {
    setLoadingCount((prev) => prev + 1)
  }, [])

  const stopLoading = useCallback(() => {
    setLoadingCount((prev) => Math.max(0, prev - 1))
  }, [])

  return (
    <LoadingContext.Provider
      value={{
        isLoading: loadingCount > 0,
        startLoading,
        stopLoading,
      }}
    >
      {children}
    </LoadingContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLoading(): LoadingContextType {
  const context = useContext(LoadingContext)
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider')
  }
  return context
}
