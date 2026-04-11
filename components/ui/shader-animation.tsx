'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type ShaderAnimationProps = {
  className?: string
}

/**
 * Full-bleed WebGL monochrome shader background (black/white theme).
 * Lives under `components/ui/` for shadcn-style colocation with future primitives.
 */
export function ShaderAnimation({ className = '' }: ShaderAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const vertexShader = `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `

    const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;

      void main(void) {
        vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
        float t = time * 0.05;
        float lineWidth = 0.002;

        float lum = 0.0;
        for (int j = 0; j < 3; j++) {
          for (int i = 0; i < 5; i++) {
            lum += lineWidth * float(i * i) / abs(
              fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2)
            );
          }
        }

        float strokes = clamp(lum * 0.14, 0.0, 0.5);
        float base = 0.05;
        float g = base + strokes;
        gl_FragColor = vec4(vec3(g), 1.0);
      }
    `

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const scene = new THREE.Scene()
    const geometry = new THREE.PlaneGeometry(2, 2)

    const uniforms = {
      time: { value: 0 },
      resolution: { value: new THREE.Vector2(1, 1) },
    }

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    })

    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setClearColor(0x080808, 1)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const onWindowResize = () => {
      const width = container.clientWidth
      const height = Math.max(container.clientHeight, 1)
      renderer.setSize(width, height, false)
      uniforms.resolution.value.set(renderer.domElement.width, renderer.domElement.height)
    }

    onWindowResize()
    window.addEventListener('resize', onWindowResize, false)

    let rafId = 0
    const animate = () => {
      uniforms.time.value += 0.05
      renderer.render(scene, camera)
      rafId = window.requestAnimationFrame(animate)
    }
    rafId = window.requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', onWindowResize)
      window.cancelAnimationFrame(rafId)

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }

      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 h-full min-h-full w-full overflow-hidden bg-[#080808] ${className}`.trim()}
      aria-hidden
    />
  )
}
