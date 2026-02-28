// Language-specific theme configuration
export interface LanguageTheme {
  language: string
  accentColor: string
  flag: string
  name: string
}

export const languageThemes: Record<string, LanguageTheme> = {
  dutch: {
    language: 'nl',
    accentColor: 'rgb(255, 94, 0)', // Dutch orange
    flag: '🇳🇱',
    name: 'Dutch',
  },
  // Add more languages as needed
  spanish: {
    language: 'es',
    accentColor: 'rgb(255, 196, 0)',
    flag: '🇪🇸',
    name: 'Spanish',
  },
  french: {
    language: 'fr',
    accentColor: 'rgb(0, 85, 164)',
    flag: '🇫🇷',
    name: 'French',
  },
}

// For now, default to Dutch
export const currentLanguageTheme = languageThemes.dutch
