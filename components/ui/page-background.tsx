'use client'

import { DitheringShader, type DitheringShape, type DitheringType } from './dithering-shader'

interface PageBackgroundProps {
  shape?: DitheringShape
  type?: DitheringType
  colorBack?: string
  colorFront?: string
  pxSize?: number
  speed?: number
}

export function PageBackground({
  shape = 'simplex',
  type = '4x4',
  colorBack = '#010101',
  colorFront = '#1a1a1a',
  pxSize = 6,
  speed = 0.2,
}: PageBackgroundProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[-1] h-full w-full overflow-hidden"
    >
      <DitheringShader
        shape={shape}
        type={type}
        colorBack={colorBack}
        colorFront={colorFront}
        pxSize={pxSize}
        speed={speed}
        className="h-full w-full"
      />
    </div>
  )
}
