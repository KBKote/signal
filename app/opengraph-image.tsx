import { ImageResponse } from 'next/og'

export const alt = 'Dev Signal — personal intelligence feed for developers'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      >
        <div
          style={{
            fontSize: 13,
            letterSpacing: '0.42em',
            color: '#71717a',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}
        >
          Personal intelligence
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            color: '#fafafa',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          Dev Signal
        </div>
        <div
          style={{
            fontSize: 22,
            color: '#a1a1aa',
            marginTop: 28,
            maxWidth: 900,
            textAlign: 'center',
            lineHeight: 1.45,
          }}
        >
          RSS, Reddit & HN → scored with your Claude profile (BYOK)
        </div>
      </div>
    ),
    { ...size }
  )
}
