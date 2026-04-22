import OpenAI from 'openai'

const MODEL = 'text-embedding-3-small'
const DIMENSIONS = 1536
const CHUNK_SIZE = 500 // OpenAI batch limit per call

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set')
    _client = new OpenAI({ apiKey })
  }
  return _client
}

/**
 * Embed an array of strings. Returns one float[] per input in the same order.
 * Automatically chunks into batches of CHUNK_SIZE to stay within API limits.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const client = getClient()
  const results: number[][] = new Array(texts.length)

  for (let i = 0; i < texts.length; i += CHUNK_SIZE) {
    const chunk = texts.slice(i, i + CHUNK_SIZE)
    const response = await client.embeddings.create({
      model: MODEL,
      input: chunk,
      dimensions: DIMENSIONS,
    })
    for (const item of response.data) {
      results[i + item.index] = item.embedding
    }
  }

  return results
}

/**
 * Embed a single string. Returns a float[1536] vector.
 */
export async function embedText(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text])
  return vec
}
