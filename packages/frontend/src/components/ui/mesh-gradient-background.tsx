import { useEffect, useRef } from 'react'
import { Gradient } from '@/lib/gradient.js'

interface MeshGradientBackgroundProps {
  colors?: {
    color1?: string
    color2?: string
    color3?: string
    color4?: string
  }
}

export function MeshGradientBackground({
  colors = {
    color1: '#E85D68', // Soft coral red
    color2: '#6BA3D6', // Soft sky blue
    color3: '#FFFFFF', // White
    color4: '#F5E6E8', // Soft blush (buffers red/blue blend)
  },
}: MeshGradientBackgroundProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gradientRef = useRef<InstanceType<typeof Gradient> | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const gradient = new Gradient()
    gradientRef.current = gradient
    gradient.initGradient('#mesh-gradient-canvas')

    return () => {
      if (gradientRef.current) {
        gradientRef.current.disconnect()
      }
    }
  }, [])

  return (
    <canvas
      id="mesh-gradient-canvas"
      ref={canvasRef}
      className="fixed inset-0 -z-10 w-full h-full"
      data-js-darken-top=""
      style={
        {
          '--gradient-color-1': colors.color1,
          '--gradient-color-2': colors.color2,
          '--gradient-color-3': colors.color3,
          '--gradient-color-4': colors.color4,
        } as React.CSSProperties
      }
    />
  )
}
