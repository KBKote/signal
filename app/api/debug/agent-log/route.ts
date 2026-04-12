import { appendFile, mkdir } from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

const LOG_PATH = path.join(process.cwd(), '.cursor', 'debug-d9c924.log')

/** Dev-only: append one NDJSON line for debug sessions (no secrets). */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  try {
    const body: unknown = await req.json()
    await mkdir(path.dirname(LOG_PATH), { recursive: true })
    await appendFile(LOG_PATH, `${JSON.stringify(body)}\n`, 'utf8')
  } catch {
    // ignore
  }
  return NextResponse.json({ ok: true })
}
