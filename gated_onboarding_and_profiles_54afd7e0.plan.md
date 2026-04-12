---
name: Gated onboarding and profiles
overview: "Single canonical spec: verified email → BYOK → questionnaire → Sonnet-synthesized scoring_markdown → Haiku batch scoring; hardened session/API gates; BYOK-only user Anthropic; dedicated DB columns + buildScoringUserPrompt pivot; remove topic emphasis + user run-size; operator/env tuning only; CLAUDE.md guardrails; plan→lint/build→log→test until acceptance. Execution starts at gates, then phase2-scoring-markdown-data-path (buildScoringUserPrompt slice safe first)."
todos:
  - id: gates-email-key-profile
    content: Extend server + client setup state (email_confirmed_at, key, scoring_markdown); add /verify-email; harden proxy + all API routes; BYOK-only Anthropic on user routes + two-account regression test; clarify ANTHROPIC_API_KEY docs (no user fallback)
    status: completed
  - id: phase2-scoring-markdown-data-path
    content: "DB migration (scoring_markdown, questionnaire_answers, synthesized_at); loadUserProfileRow exposes columns; QuestionnaireAnswers (lib/questionnaire.ts); buildScoringUserPrompt prefers markdown else legacy USER_PROFILE; filter route wiring (no lib/filter.ts change). Optional first land: buildScoringUserPrompt + unit tests only."
    status: completed
  - id: phase2-synthesis-onboarding-settings
    content: lib/profile-synthesis-prompt.ts; POST /api/onboarding/synthesize-profile (guards, Sonnet via ANTHROPIC_PROFILE_MODEL + user BYOK, heading validation, api_usage); app/onboarding 3-step UI + markdown preview → /feed; settings GET + PATCH /api/settings/profile (cap ~4000, sanitize)
    status: completed
  - id: remove-topic-emphasis
    content: Remove scrape pack switch, buildPreferenceOverlay chain, topic/scope UI; reset key = profile hash; update agents/docs
    status: pending
  - id: remove-user-run-size
    content: Delete maxCandidates/batchSize from UI, POST bodies, parseFilterRequestPayload, RunFilterContext — operator/env defaults in lib/filter.ts only
    status: pending
  - id: collapse-store-threshold
    content: After scope UI removal, one fixed minScoreToStore (e.g. 5) or derive later from profile; remove minScoreToStoreForScope if unused
    status: pending
  - id: broaden-scrape-no-twitter
    content: Unified scrape + keyword/HN tuning; document Twitter as future spike only
    status: completed
  - id: update-claude-cost-sonnet-exception
    content: CLAUDE.md Cost Controls — Sonnet only for one-shot profile synthesis; Haiku-only batch filter
    status: completed
isProject: false
---

# Gated onboarding, per-user scoring MD, removing topic emphasis, no user run-size

**Canonical spec:** this file in the repo root is the **only** merged implementation plan (security + Phases 1–5 + full Phase 2 questionnaire / `scoring_markdown` / Sonnet / acceptance). Do not maintain a parallel outline elsewhere.

## Executive summary

- **Journey:** sign up → **verified email** → **BYOK** → **10-question onboarding** → **one Sonnet call (user key)** → persist **`scoring_markdown`** → **`/feed`**; Haiku reads synthesized markdown via [`buildScoringUserPrompt`](lib/user-profile-prompt.ts) on every batch.
- **Security:** no meaningful app/API use without session; **defense in depth** on [`proxy.ts`](proxy.ts) and **`app/api/*`**; **`getSupabaseAdmin()`** queries always scoped by **`session user.id`**.
- **BYOK:** **`POST /api/filter`**, **`POST /api/onboarding/synthesize-profile`**, and any user Anthropic path use **only** `getDecryptedAnthropicKey(user.id)` — **never** `process.env.ANTHROPIC_API_KEY` as fallback for users; document operator key as non-user flows only.
- **Storage:** **`user_profiles`** columns **`scoring_markdown`**, **`questionnaire_answers`**, **`synthesized_at`** (not buried in `profile` jsonb); **`loadUserProfileRow`** + filter/synthesis routes share one shape for the prompt builder.
- **Sonnet:** **`ANTHROPIC_PROFILE_MODEL`** env; default in [`.env.local.example`](.env.local.example) must match a **shipping** Sonnet id at ship time — **no** hardcoded unverified model strings in app code.
- **Incremental safety:** land **`buildScoringUserPrompt`** + **legacy fallback** + **unit tests** early so users without synthesis never break; then migration + loader, then API/UI.
- **Product cuts:** remove **topic emphasis** and **user run-size** entirely; operator **env + defaults** for batch/raw limits; reset-progress keys from **profile fingerprint** (`synthesized_at` or hash of markdown).
- **Quality bar:** `npm run lint` + `npm run build` each chunk; manual E2E + BYOK two-user check; update [`CLAUDE.md`](CLAUDE.md) learning log when discovering new pitfalls.

## How it works today (relevant gaps)

- **Post-auth routing** ([`lib/auth/post-auth-navigation.ts`](lib/auth/post-auth-navigation.ts), [`lib/auth/post-auth-redirect-server.ts`](lib/auth/post-auth-redirect-server.ts)) only checks **Anthropic key** → `/settings` else `/feed`. It **does not** require **email confirmation** or a **completed scoring profile**.
- **Scoring prompt** ([`lib/user-profile-prompt.ts`](lib/user-profile-prompt.ts) + [`lib/user-profile.ts`](lib/user-profile.ts)): every user always gets the **same long `USER_PROFILE` string** from the repo; onboarding JSON is only appended if present — not truly per-user.
- **Topic emphasis** ([`lib/scrape-sources.ts`](lib/scrape-sources.ts), [`lib/pipeline-preferences.ts`](lib/pipeline-preferences.ts), [`components/PipelinePreferences.tsx`](components/PipelinePreferences.tsx)) will be **removed** (see Phase 3).
- **User-chosen run size** (`maxCandidates`, `batchSize`, [`PipelineRunTuning`](lib/pipeline-preferences.ts), feed state) will be **removed entirely**. Volume is **not** a user control: **server-side defaults** and optional **env** (`FILTER_MAX_CANDIDATES`, `FILTER_BATCH_SIZE`, `RAW_FETCH_LIMIT`).

```mermaid
flowchart TD
  signup[SignUp] --> session[Session]
  session --> key{BYOK key?}
  key -->|no| settings[/settings]
  key -->|yes| feed[/feed]
  note1[Today: gaps vs target]
```

```mermaid
flowchart LR
  subgraph target [Target journey]
    s[SignUp] --> v[Verified email]
    v --> byok[BYOK in /settings]
    byok --> q[Questionnaire]
    q --> syn[Sonnet synthesis]
    syn --> md[scoring_markdown stored]
    md --> f[/feed + Haiku batches]
  end
```

## Full implementation sequence (dependency order)

Execute in this order unless noted “parallel OK”:

1. **Phase 1 — Gates** (`gates-email-key-profile` todo) — setup state, `/verify-email`, [`proxy.ts`](proxy.ts), API parity; blocks `/feed` and sensitive APIs until email + key + (after Phase 2) markdown.
2. **Phase 2a — Data + prompt path** (`phase2-scoring-markdown-data-path`) — migration → `loadUserProfileRow` → types → **`buildScoringUserPrompt`** (markdown first, legacy fallback) → [`app/api/filter/route.ts`](app/api/filter/route.ts) passes markdown into context (**incremental:** prompt-only slice can ship first inside this todo).
3. **Phase 2b — Synthesis + UI + settings** (`phase2-synthesis-onboarding-settings`) — [`lib/profile-synthesis-prompt.ts`](lib/profile-synthesis-prompt.ts) → `POST /api/onboarding/synthesize-profile` → onboarding UI → `PATCH /api/settings/profile`.
4. **Phase 3 — Topic** (`remove-topic-emphasis`) — single scrape pack, remove overlay from [`scoreBatch`](lib/filter.ts), UI cleanup, profile-hash reset key.
5. **Phase 3b — Run size** (`remove-user-run-size`) — strip tuning from payloads, [`RunFilterContext`](lib/filter.ts), UI.
6. **Phase 3c — Store threshold** (`collapse-store-threshold`) — single `minScoreToStore` default.
7. **Phase 4 — Scrape breadth** (`broaden-scrape-no-twitter`).
8. **Phase 5 — Existing users** — force questionnaire if key but no markdown (optional skip only if product wants soft launch).
9. **Docs** (`update-claude-cost-sonnet-exception`) — CLAUDE Sonnet carve-out + env vars.

## Target user journey (detail)

1. **Sign up** (Supabase Auth).
2. **Verify email** — block app until `user.email_confirmed_at` is set.
3. **No feed yet** — allow **`/settings`** (BYOK), then **questionnaire** (`/onboarding`).
4. **BYOK** before questionnaire so **Sonnet synthesis** uses the **user’s** key.
5. **Questionnaire** → **one Sonnet call** → **`scoring_markdown`** + **`questionnaire_answers`** + **`synthesized_at`** on **`user_profiles`**.
6. **`/feed`** only after profile exists; Haiku batch scoring uses that markdown as primary **`userPrompt`**.

## Guardrails from project knowledge ([`CLAUDE.md`](CLAUDE.md) learning log)

| Area | Do |
|------|-----|
| **Env + build** | No Supabase / web-push / SDK init at **module top level** if it throws without env — **lazy** or route-only (Bugs 2–3). |
| **Supabase client** | **No `Proxy`** (Bug 6). **`getSupabaseAdmin()`** for privileged paths; feed via **server API** + session (Bug 8). |
| **Upserts** | Never `onConflict` without matching **UNIQUE** (Bug 5). |
| **Auth** | **`window.location.assign`** after sign-in when cookies race (Bug 13); **`getPublicOrigin`** for tunnels (Bug 14). |
| **Root `/`** | Server auth + redirect (Bugs 10, 12). |
| **Haiku filter** | Batched stories, **min batch 10**, strip fences before `JSON.parse`. |
| **Sonnet** | **Only** profile synthesis route; **never** in [`lib/filter.ts`](lib/filter.ts) loop; log **`api_usage`**. |
| **Vercel cron** | Hobby = **daily** scrape only. |

## Delivery workflow (mandatory)

1. Plan → 2. Implement smallest vertical slice → 3. `npm run lint` + `npm run build` → 4. CLAUDE learning log → 5. Tests (§ below) until acceptance.

## Testing discipline

- **Lint + build** green before handoff.
- **E2E:** new user → verify → key → questionnaire → synthesis → feed; premature **`/api/stories`** / **`/api/filter`** → **401/403** as designed.
- **Prompt check:** logs show **`scoring_markdown`** sections for onboarded users, not static **`USER_PROFILE`** wall.
- **Anon vs service-role** if UI empty but DB has rows.
- **Tunnel:** Supabase redirect URLs + origin helpers (Bug 14).
- **BYOK isolation:** two browsers / two accounts — only the acting user’s Anthropic project shows usage.

## Security — unauthenticated access and BYOK

### Lock down without a valid session

- **[`proxy.ts`](proxy.ts):** matcher covers **`/verify-email`**, **`/onboarding`**, **`/settings/profile`** (or equivalent guards).
- **API:** `getSessionUser()` first; then email verified; then key + markdown gates; **401/403**; no partial leaks ([`docs/security-audit-backlog.md`](docs/security-audit-backlog.md)).

### Operator key concern

[`app/api/filter/route.ts`](app/api/filter/route.ts) uses **`getDecryptedAnthropicKey(user.id)`** only today; **`ANTHROPIC_API_KEY`** is not wired into user filter TypeScript. Still **enforce** rules so future edits cannot add operator fallback to user routes.

### Hard rules (never regress)

1. User Anthropic routes: **only** BYOK for that **`sessionUser.id`**; **`null`** → **400** “add your key”.
2. Operator Anthropic: **only** behind **`CRON_SECRET`** or server-only ops — never browser-callable.
3. [`app/api/settings/anthropic/route.ts`](app/api/settings/anthropic/route.ts): **`user_id`** === session id (re-verify each change).
4. Admin queries: always filter by **`user.id` from session**.

## Phase 1 — Access control

- Centralize **setup state**: `emailVerified`, `hasAnthropicKey`, `hasScoringProfile`.
- **`/verify-email`** + resend.
- **[`proxy.ts`](proxy.ts)** + server redirects: no **`/feed`** until gates pass; APIs mirror gates.

## Phase 2 — Questionnaire, `scoring_markdown`, Sonnet synthesis, implementation

Design is **backwards from Haiku**: [`scoreBatch`](lib/filter.ts) ← **`userPrompt`** ← [`buildScoringUserPrompt`](lib/user-profile-prompt.ts) ← **`scoring_markdown`** when present.

### 2.1 Questionnaire (10 questions)

**Principle:** each question maps to a markdown section; none decorative.

**Section A — Who you are**

- **Q1** Primary focus? **multi-select** — product/tool; trading/investing; research; learning/career; open source.
- **Q2** Crypto tenure? **single** — under 6 months; 6 months–1 year; 1–3 years; 3–5 years; 5+ years.
- **Q3** AI/ML tenure? **single** — none; under 6 months; 6 months–1 year; 1–3 years; 3+ years.

**Section B — What you’re doing**

- **Q4** Current build/work? **free text** 2–3 sentences (concrete beats vague).
- **Q5** Ecosystems / tech? **multi-select** — Ethereum; L2s; Solana; Bitcoin/Lightning; multi-chain; Claude APIs; OSS LLMs; agents; DeFi; Other text.

**Section C — “Opportunity” meaning**

- **Q6** Act within a week? **multi-select** — trade/DeFi; new build; job/outreach; deploy; testnet/gov/airdrop; public write.
- **Q7** Information stance? **single** — bleeding edge; early adopter; validated.

**Section D — Calibration**

- **Q8** Always score high? **free text**
- **Q9** Always low / filter? **free text**
- **Q10** Already know well? **free text**

### 2.2 `scoring_markdown` format (Sonnet → Haiku)

Under ~**700 tokens**; exact headings:

```markdown
# Signal Profile
## Who I Am
## What I'm Building Right Now
## Ecosystem Focus
## What "Opportunity" Means for Me
## Must Score High (7–10)
## Must Score Low (1–3)
## Knowledge Baseline
## Scoring Rubric
## Category Guide
```

(Fill rules per prior spec: third person “Who I Am”; Q4 anchor; Q5/Q6/Q7 in opportunity + rubric; Q8–Q10 in lists; category lines tie to Q4/Q5/Q6.)

### 2.3 Sonnet synthesis prompt (one-shot)

This template is implemented in [`lib/profile-synthesis-prompt.ts`](lib/profile-synthesis-prompt.ts) as `buildSynthesisPrompt(answers: QuestionnaireAnswers): string`. The interpolation variables (`{primaryFocus}` etc.) map 1:1 to the `QuestionnaireAnswers` type fields from §2.4.

```text
You are synthesizing a personalized scoring profile for a news-filtering app.
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
Primary focus (Q1): {primaryFocus}
Crypto experience (Q2): {cryptoExperience}
AI/ML experience (Q3): {aiExperience}
What they're building (Q4): {currentProject}
Ecosystem focus (Q5): {ecosystemFocus}
Can act on within a week (Q6): {canActOn}
Risk appetite (Q7): {riskAppetite}
Must score high (Q8): {mustScoreHigh}
Must score low (Q9): {mustScoreLow}
Knowledge baseline (Q10): {knowledgeBaseline}

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
```

### 2.4 Types

[`lib/questionnaire.ts`](lib/questionnaire.ts):

```ts
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
```

Validate on server: lengths, allowed enums for Q2/Q3/Q7, array bounds.

### 2.5 Storage (locked)

**Dedicated columns** on **`user_profiles`**: `scoring_markdown`, `questionnaire_answers`, `synthesized_at`. One loader pattern → [`buildScoringUserPrompt`](lib/user-profile-prompt.ts) + both routes.

### 2.6 `buildScoringUserPrompt` (pivot + safest first slice)

Prefer trimmed **`scoring_markdown`**; else existing **`USER_PROFILE`** + legacy onboarding assembly. Land with **unit tests** before UI.

### 2.7 DB migration

[`supabase/migrations/20260412100000_scoring_markdown.sql`](supabase/migrations/20260412100000_scoring_markdown.sql) (adjust timestamp if needed):

```sql
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS scoring_markdown   text,
  ADD COLUMN IF NOT EXISTS questionnaire_answers jsonb,
  ADD COLUMN IF NOT EXISTS synthesized_at     timestamptz;
```

### 2.8 Synthesis API

[`app/api/onboarding/synthesize-profile/route.ts`](app/api/onboarding/synthesize-profile/route.ts)

**Guards:** 401 session → 403 email → 400 BYOK → 400 body → Sonnet (`ANTHROPIC_PROFILE_MODEL`) → validate headings → upsert columns → **`api_usage`** → `{ scoring_markdown }`. **Heading validation:** after receiving Sonnet's response, check that the string contains both `## Who I Am` and `## Scoring Rubric`. If either is missing, retry the Sonnet call once with the same prompt. If still missing after the retry, return HTTP 500 with `{ error: "synthesis_failed" }` — do not persist a malformed profile. Safe errors to client (no stack traces).

### 2.9 Questionnaire UI

[`app/onboarding/page.tsx`](app/onboarding/page.tsx): 3 screens (Q1–3, Q4–5, Q6–10) → POST → loading copy → collapsible `<pre>` preview → “Looks good” → **`/feed`**.

### 2.10 Settings

GET markdown; **`PATCH /api/settings/profile`** — cap (~**4000** chars, document), strip HTML; textarea + counter on settings or [`app/settings/profile/page.tsx`](app/settings/profile/page.tsx).

### 2.11 Filter route

[`app/api/filter/route.ts`](app/api/filter/route.ts): pass **`scoring_markdown`** into **`buildScoringUserPrompt`**. No [`lib/filter.ts`](lib/filter.ts) change if **`userPrompt`** already plumbed.

### 2.12 Dependency order (recap)

- **Strict:** migration → types → loader + **`buildScoringUserPrompt`** → synthesis API → onboarding UI → settings PATCH → verify filter.
- **Incremental:** **`buildScoringUserPrompt`** + tests **first** (no DB yet if you inject `scoringMarkdown` in tests only; with DB, migration can precede or follow same PR as function).

### 2.13 Acceptance criteria

| Test | Pass |
|------|------|
| Full onboarding | Columns set: markdown, jsonb answers, `synthesized_at` |
| Filter after onboarding | `userPrompt` reflects markdown sections |
| Synthesize unverified | **403** |
| Synthesize no BYOK | **400** add key |
| `api_usage` | Sonnet model, non-zero tokens, `user_id` |
| Two users | Only actor’s Anthropic usage |
| Edit in settings | Next filter uses edited markdown |
| Legacy user | Fallback prompt, no crash |

### 2.14 Kickoff when executing

Start **`gates-email-key-profile`** in parallel with planning only if scope is split; otherwise **gates first**. For Phase 2, begin **`phase2-scoring-markdown-data-path`** with the **`buildScoringUserPrompt`** slice if you want the lowest-risk first commit, then migration + loader in the same or follow-up PR.

## Phase 3 — Remove topic emphasis

- Single [`getScrapePack`](lib/scrape-sources.ts); remove [`buildPreferenceOverlay`](lib/pipeline-preferences.ts) from [`scoreBatch`](lib/filter.ts); UI + **`stablePipelinePrefsKey`** cleanup; reset = **profile hash** / **`synthesized_at`**.

## Phase 3b — Remove user run-size

- Delete tuning from UI, **`parseFilterRequestPayload`**, **`RunFilterContext`**; env-only limits in [`lib/filter.ts`](lib/filter.ts).

## Phase 3c — Store threshold

- One default **`minScoreToStore`** (e.g. 5); remove **`minScoreToStoreForScope`** if dead.

## Phase 4 — Broader scrape; no Twitter promise

- Careful keyword/HN/Reddit tuning; Twitter = future spike only.

## Phase 5 — Existing users

- Key but no markdown → questionnaire (skip only if explicitly allowed).

## Clarifications

- **Synthesis:** Sonnet, **one shot**, **user BYOK**, **`ANTHROPIC_PROFILE_MODEL`**.
- **Batch filter:** **Haiku only** in [`lib/filter.ts`](lib/filter.ts).

## Deprecated duplicate plans

If a short **Phase 2 plan update** exists under **`~/.cursor/plans/`**, treat it as **superseded** by this file — edit that file to a one-line pointer here when cleaning up local Cursor state.
