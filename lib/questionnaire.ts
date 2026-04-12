/** Stored JSON from the 3-step onboarding questionnaire (POST /api/onboarding/synthesize-profile). */

export type QuestionnaireAnswers = {
  primaryFocus: string[]
  cryptoExperience: string
  aiExperience: string
  currentProject: string
  ecosystemFocus: string[]
  canActOn: string[]
  riskAppetite: string
  mustScoreHigh: string
  mustScoreLow: string
  knowledgeBaseline: string
}

const CRYPTO_EXPERIENCE = new Set([
  'under_6mo',
  '6mo_1yr',
  '1_3yr',
  '3_5yr',
  '5yr_plus',
])

const AI_EXPERIENCE = new Set(['none', 'under_6mo', '6mo_1yr', '1_3yr', '3yr_plus'])

const RISK_APPETITE = new Set(['bleeding_edge', 'early_adopter', 'validated'])

const MAX_ARRAY_LEN = 24
const MAX_ITEM_LEN = 120
const MAX_FREE_TEXT = 1000

function assertNonEmptyStringArray(raw: unknown, field: string): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${field} must be a non-empty array`)
  }
  if (raw.length > MAX_ARRAY_LEN) {
    throw new Error(`${field} has too many entries (max ${MAX_ARRAY_LEN})`)
  }
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new Error(`${field} must contain only strings`)
    }
    const s = item.trim()
    if (!s) {
      throw new Error(`${field} entries must be non-empty strings`)
    }
    if (s.length > MAX_ITEM_LEN) {
      throw new Error(`${field} entry exceeds ${MAX_ITEM_LEN} characters`)
    }
    out.push(s)
  }
  return [...new Set(out)]
}

function assertEnum(field: string, value: string, allowed: Set<string>): void {
  if (!allowed.has(value)) {
    throw new Error(`Invalid ${field}: "${value}"`)
  }
}

function assertFreeText(field: string, raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new Error(`${field} must be a non-empty string`)
  }
  const s = raw.trim()
  if (!s) {
    throw new Error(`${field} must be non-empty`)
  }
  if (s.length > MAX_FREE_TEXT) {
    throw new Error(`${field} must be at most ${MAX_FREE_TEXT} characters`)
  }
  return s
}

/**
 * Validates POST body shape for synthesis. Throws Error with a descriptive message on failure.
 */
export function parseQuestionnaireAnswers(raw: unknown): QuestionnaireAnswers {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Expected a JSON object')
  }
  const o = raw as Record<string, unknown>

  const primaryFocus = assertNonEmptyStringArray(o.primaryFocus, 'primaryFocus')
  const ecosystemFocus = assertNonEmptyStringArray(o.ecosystemFocus, 'ecosystemFocus')
  const canActOn = assertNonEmptyStringArray(o.canActOn, 'canActOn')

  const cryptoExperience =
    typeof o.cryptoExperience === 'string' ? o.cryptoExperience.trim() : ''
  assertEnum('cryptoExperience', cryptoExperience, CRYPTO_EXPERIENCE)

  const aiExperience = typeof o.aiExperience === 'string' ? o.aiExperience.trim() : ''
  assertEnum('aiExperience', aiExperience, AI_EXPERIENCE)

  const riskAppetite = typeof o.riskAppetite === 'string' ? o.riskAppetite.trim() : ''
  assertEnum('riskAppetite', riskAppetite, RISK_APPETITE)

  const currentProject = assertFreeText('currentProject', o.currentProject)
  const mustScoreHigh = assertFreeText('mustScoreHigh', o.mustScoreHigh)
  const mustScoreLow = assertFreeText('mustScoreLow', o.mustScoreLow)
  const knowledgeBaseline = assertFreeText('knowledgeBaseline', o.knowledgeBaseline)

  return {
    primaryFocus,
    cryptoExperience,
    aiExperience,
    currentProject,
    ecosystemFocus,
    canActOn,
    riskAppetite,
    mustScoreHigh,
    mustScoreLow,
    knowledgeBaseline,
  }
}
