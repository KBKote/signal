import type { QuestionnaireAnswers } from '@/lib/questionnaire'

function joinList(xs: string[]): string {
  return xs.join(', ')
}

/** One-shot Sonnet user message: questionnaire answers interpolated into the fixed template. */
export function buildSynthesisPrompt(answers: QuestionnaireAnswers): string {
  const primaryFocus = joinList(answers.primaryFocus)
  const ecosystemFocus = joinList(answers.ecosystemFocus)
  const canActOn = joinList(answers.canActOn)

  return `You are synthesizing a personalized scoring profile for a news-filtering app.
Claude Haiku will use your output to score hundreds of stories per week for this user.

CRITICAL CONSTRAINTS:
- Total output must be under 700 tokens
- Use the exact section headers listed below — no additions, no omissions
- Write the Scoring Rubric and Category Guide in terms of THIS user's Q4 project and Q6 actions specifically — not
  abstract quality criteria
- Must Score High / Must Score Low: named protocols and topics, never generic categories
- If an answer is vague, infer from their other answers and proceed — never leave a section empty
- Output only the markdown. Do not echo these instructions.

USER'S QUESTIONNAIRE ANSWERS:
Primary focus (Q1): ${primaryFocus}
Crypto experience (Q2): ${answers.cryptoExperience}
AI/ML experience (Q3): ${answers.aiExperience}
What they're building (Q4): ${answers.currentProject}
Ecosystem focus (Q5): ${ecosystemFocus}
Can act on within a week (Q6): ${canActOn}
Risk appetite (Q7): ${answers.riskAppetite}
Must score high (Q8): ${answers.mustScoreHigh}
Must score low (Q9): ${answers.mustScoreLow}
Knowledge baseline (Q10): ${answers.knowledgeBaseline}

OUTPUT (fill every section):

# Signal Profile

## Who I Am
[2–3 sentences, third person, role + experience + current project, specific]

## What I'm Building Right Now
[1–2 sentences, concrete restatement of Q4]

## Ecosystem Focus
[Bullet list of specific chains, protocols, tools from Q5]

## What "Opportunity" Means for Me
- I can act on: [from Q6]
- My time horizon: [inferred from Q6 + Q7]
- My risk appetite: [from Q7, stated plainly]

## Must Score High (7–10)
[Bullet list, 5–10 named items from Q8 + inferences from Q4/Q5]

## Must Score Low (1–3)
[Bullet list, 4–8 named items from Q9]

## Knowledge Baseline
[Bullet list from Q10 — introductory content on these topics is noise]

## Scoring Rubric
- **8–10:** [Complete for THIS user — what does a top score look like given their Q4 project and Q6 actions]
- **5–7:** [For this user — relevant but not immediately actionable]
- **1–4:** [For this user — off-topic, already known, or pure speculation]

## Category Guide
- **opportunity:** A story this user can act on within a week via [restate Q6 actions]
- **idea:** A technical pattern or gap relevant to [restate Q4 project]
- **intel:** Ecosystem context about [restate Q5 focus areas]
- **noise:** Scores 1–4. Off-topic or on the Must Score Low list.
`
}

const REQUIRED_HEADINGS = ['## Who I Am', '## Scoring Rubric'] as const

export function synthesisOutputHasRequiredHeadings(text: string): boolean {
  return REQUIRED_HEADINGS.every((h) => text.includes(h))
}
