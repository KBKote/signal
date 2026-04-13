'use client'

import { useEffect, useRef } from 'react'

export type DitheringShape = 'simplex' | 'ripple' | 'swirl' | 'warp'
export type DitheringType = '4x4' | '8x8'

type DitheringShaderProps = {
  shape?: DitheringShape
  type?: DitheringType
  colorBack?: string
  colorFront?: string
  pxSize?: number
  speed?: number
  className?: string
}

function hexToRgb01(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  if (full.length !== 6) return [0.008, 0.008, 0.008]
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return [0.008, 0.008, 0.008]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255) as [number, number, number]
}

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type)
  if (!sh) return null
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('[DitheringShader] shader compile error', gl.getShaderInfoLog(sh))
    gl.deleteShader(sh)
    return null
  }
  return sh
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const prog = gl.createProgram()
  if (!prog) return null
  gl.attachShader(prog, vs)
  gl.attachShader(prog, fs)
  gl.bindAttribLocation(prog, 0, 'a_position')
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[DitheringShader] program link error', gl.getProgramInfoLog(prog))
    gl.deleteProgram(prog)
    return null
  }
  return prog
}

const VERT = `#version 300 es
in vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_colorBack;
uniform vec3 u_colorFront;
uniform float u_pxSize;
uniform float u_speed;
uniform int u_shape;
uniform int u_ditherKind;

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 78.233);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

float bayer4(vec2 fc) {
  ivec2 i = ivec2(int(mod(fc.x, 4.0)), int(mod(fc.y, 4.0)));
  int idx = i.x + i.y * 4;
  float m;
  if (idx == 0) m = 0.0;
  else if (idx == 1) m = 8.0;
  else if (idx == 2) m = 2.0;
  else if (idx == 3) m = 10.0;
  else if (idx == 4) m = 12.0;
  else if (idx == 5) m = 4.0;
  else if (idx == 6) m = 14.0;
  else if (idx == 7) m = 6.0;
  else if (idx == 8) m = 3.0;
  else if (idx == 9) m = 11.0;
  else if (idx == 10) m = 1.0;
  else if (idx == 11) m = 9.0;
  else if (idx == 12) m = 15.0;
  else if (idx == 13) m = 7.0;
  else if (idx == 14) m = 13.0;
  else m = 5.0;
  return m / 16.0;
}

float bayer8(vec2 fc) {
  return fract(bayer4(fc * 0.5) * 0.62 + bayer4(fc * 0.25 + vec2(2.3, 5.1)) * 0.38);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 res = max(u_resolution, vec2(1.0));
  vec2 centered = (frag - 0.5 * res) / min(res.x, res.y);
  float t = u_time * u_speed;
  float px = max(u_pxSize, 1.0);
  vec2 cell = floor(frag / px);

  float field;
  if (u_shape == 1) {
    float r = length(centered);
    field = sin(r * 14.0 - t * 2.8) * 0.5 + 0.5;
    field = field * 0.55 + fbm(cell * 0.09 + vec2(t * 0.12, 0.0)) * 0.45;
  } else if (u_shape == 2) {
    float a = atan(centered.y, centered.x);
    float r = length(centered);
    field = sin(a * 4.0 + r * 10.0 - t * 2.2) * 0.5 + 0.5;
    field = field * 0.6 + vnoise(cell * 0.11 + t * vec2(0.07, 0.05)) * 0.4;
  } else if (u_shape == 3) {
    vec2 w = centered + 0.22 * vec2(sin(centered.y * 6.0 + t * 1.1), cos(centered.x * 6.0 + t * 1.1));
    field = sin(w.x * 7.0 + t) * sin(w.y * 7.0 - t * 0.9) * 0.5 + 0.5;
    field = field * 0.55 + fbm(cell * 0.1 + vec2(t * 0.08)) * 0.45;
  } else {
    vec2 p = cell * 0.07 + vec2(t * 0.05, t * 0.04);
    field = fbm(p) * 0.65 + vnoise(cell * 0.15 + t * 0.06) * 0.35;
  }

  field = clamp(field, 0.0, 1.0);
  float baseMix = 0.1 + 0.12 * field;
  float thr = u_ditherKind == 1 ? bayer8(frag) : bayer4(frag);
  float grain = (thr - 0.5) * 0.035 + (hash21(frag * 0.07 + t) - 0.5) * 0.012;
  float d = clamp(baseMix + grain, 0.0, 1.0);
  vec3 col = mix(u_colorBack, u_colorFront, d);
  fragColor = vec4(col, 1.0);
}
`

const SHAPE_UNIFORM: Record<DitheringShape, number> = {
  simplex: 0,
  ripple: 1,
  swirl: 2,
  warp: 3,
}

export function DitheringShader({
  shape = 'simplex',
  type = '4x4',
  colorBack = '#010101',
  colorFront = '#1a1a1a',
  pxSize = 6,
  speed = 0.2,
  className = '',
}: DitheringShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.pointerEvents = 'none'
    container.appendChild(canvas)

    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false })
    if (!gl) {
      console.warn('[DitheringShader] WebGL2 not available')
      container.removeChild(canvas)
      return
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    if (!vs || !fs) {
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      container.removeChild(canvas)
      return
    }

    const program = link(gl, vs, fs)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!program) {
      container.removeChild(canvas)
      return
    }

    const locResolution = gl.getUniformLocation(program, 'u_resolution')
    const locTime = gl.getUniformLocation(program, 'u_time')
    const locBack = gl.getUniformLocation(program, 'u_colorBack')
    const locFront = gl.getUniformLocation(program, 'u_colorFront')
    const locPx = gl.getUniformLocation(program, 'u_pxSize')
    const locSpeed = gl.getUniformLocation(program, 'u_speed')
    const locShape = gl.getUniformLocation(program, 'u_shape')
    const locDither = gl.getUniformLocation(program, 'u_ditherKind')

    const rgbBack = hexToRgb01(colorBack)
    const rgbFront = hexToRgb01(colorFront)
    const shapeId = SHAPE_UNIFORM[shape] ?? 0
    const ditherKind = type === '8x8' ? 1 : 0

    gl.useProgram(program)
    gl.uniform3f(locBack, rgbBack[0], rgbBack[1], rgbBack[2])
    gl.uniform3f(locFront, rgbFront[0], rgbFront[1], rgbFront[2])
    gl.uniform1f(locPx, Math.max(1, pxSize))
    gl.uniform1f(locSpeed, speed)
    gl.uniform1i(locShape, shapeId)
    gl.uniform1i(locDither, ditherKind)

    const vao = gl.createVertexArray()
    const vbo = gl.createBuffer()
    if (!vao || !vbo) {
      gl.deleteProgram(program)
      if (canvas.parentNode === container) container.removeChild(canvas)
      return
    }
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    const quad = new Float32Array([-1, -1, 3, -1, -1, 3])
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = Math.max(1, Math.floor(w * dpr))
      const ch = Math.max(1, Math.floor(h * dpr))
      canvas.width = cw
      canvas.height = ch
      gl.viewport(0, 0, cw, ch)
    }

    onResize()
    const ro = new ResizeObserver(onResize)
    ro.observe(container)

    let raf = 0
    const t0 = performance.now()
    const draw = () => {
      const w = canvas.width
      const h = canvas.height
      gl.uniform2f(locResolution, w, h)
      gl.uniform1f(locTime, (performance.now() - t0) * 0.001)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, w, h)
      gl.useProgram(program)
      gl.bindVertexArray(vao)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = window.requestAnimationFrame(draw)
    }
    raf = window.requestAnimationFrame(draw)

    return () => {
      ro.disconnect()
      window.cancelAnimationFrame(raf)
      gl.deleteBuffer(vbo)
      gl.deleteVertexArray(vao)
      gl.deleteProgram(program)
      if (canvas.parentNode === container) {
        container.removeChild(canvas)
      }
    }
  }, [shape, type, colorBack, colorFront, pxSize, speed])

  const mergedClass = ['pointer-events-none h-full w-full overflow-hidden', className].filter(Boolean).join(' ')

  return <div ref={containerRef} className={mergedClass} aria-hidden />
}
