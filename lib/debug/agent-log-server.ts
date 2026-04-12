import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

const LOG_PATH = path.join(process.cwd(), '.cursor', 'debug-d9c924.log')

/** Dev-only NDJSON append for debug sessions (no secrets). */
export async function appendAgentLog(payload: Record<string, unknown>): Promise<void> {
  if (process.env.NODE_ENV !== 'development') return
  try {
    await mkdir(path.dirname(LOG_PATH), { recursive: true })
    await appendFile(LOG_PATH, `${JSON.stringify({ ...payload, timestamp: Date.now() })}\n`, 'utf8')
  } catch {
    // ignore
  }
}
