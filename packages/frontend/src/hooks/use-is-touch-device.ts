import { useEffect, useState } from 'react'

/**
 * Detects if the user is on a touch-based mobile device (iOS/Android)
 * Returns true for iOS and Android devices, false for desktop
 */
export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  useEffect(() => {
    const checkTouchDevice = () => {
      // Check for iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

      // Check for Android
      const isAndroid = /Android/.test(navigator.userAgent)

      // Alternative: Check for touch capability
      const hasTouchScreen =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0

      // Consider it a touch device if it's iOS, Android, or has touch capability
      // and is likely mobile (not a desktop with touchscreen)
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/.test(navigator.userAgent)

      setIsTouchDevice((isIOS || isAndroid) || (hasTouchScreen && isMobile))
    }

    checkTouchDevice()
  }, [])

  return isTouchDevice
}
