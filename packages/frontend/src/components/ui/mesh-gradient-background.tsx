import { useEffect, useRef, useState } from 'react'
import { Gradient } from '@/lib/gradient.js'

function getMeshColors(): Record<string, string> {
  const style = getComputedStyle(document.documentElement)
  return {
    color1: style.getPropertyValue('--mesh-1').trim(),
    color2: style.getPropertyValue('--mesh-2').trim(),
    color3: style.getPropertyValue('--mesh-3').trim(),
    color4: style.getPropertyValue('--mesh-4').trim(),
  }
}

interface MeshGradientBackgroundProps {
  colors?: {
    color1?: string
    color2?: string
    color3?: string
    color4?: string
  }
}

export function MeshGradientBackground({
  colors,
}: MeshGradientBackgroundProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gradientRef = useRef<InstanceType<typeof Gradient> | null>(null)
  const [resolved] = useState(() => colors ?? getMeshColors())

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
          '--gradient-color-1': resolved.color1,
          '--gradient-color-2': resolved.color2,
          '--gradient-color-3': resolved.color3,
          '--gradient-color-4': resolved.color4,
        } as React.CSSProperties
      }
    />
  )
}
