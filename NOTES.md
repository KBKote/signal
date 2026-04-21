# Signal — Notes, Ideas & Updates

A running log of thoughts, discoveries, and feature ideas. No structure required — just don't lose anything.

---

## 2026-04-15

### Architecture clarity (from session)

- Scraper and pipeline are already fully separate. `/api/scrape` fills `raw_stories`, `/api/filter` reads from it. "Run Pipeline" never scrapes.
- The dedicated scrape worker (roadmap item #7 in CLAUDE.md) just moves where the scraper lives — same DB, same pipeline, more frequent refreshes possible.
- `/api/filter` already has `maxDuration = 300` — no timeout concern there.
- `/api/scrape` has `maxDuration = 60` — but real-world runs are ~20s, leaving 40s of headroom. Not a problem with current sources.
- Adding more RSS feeds/subreddits won't meaningfully increase scrape time since they run in parallel. Only adding many more Nitter accounts would push it.

### Pre-launch checklist (before posting publicly)

| Item | Cost | Time | Priority |
|---|---|---|---|
| **Resend SMTP in Supabase Auth settings** | Free | 10 min | Must do first — fixes 3 emails/hour limit that blocks sign-ups |
| Verify error pages show no stack traces | Free | 30 min | Do before posting |
| Default pipeline budget to Standard | Free | 5 min | Prevents edge-case timeouts for new users |
| UptimeRobot keep-alive ping | Free | 5 min | Nice to have |

### Platform decisions

- Vercel Pro — not needed yet. Daily cron is fine, filter has no timeout issue.
- Supabase Pro — not needed yet. 500MB is enormous for text; DB stays alive via daily cron.
- Replacing either platform — not worth the rewrite at this stage. Supabase is not just Postgres — it's Auth + RLS + email + real-time all wired together.
- The only real pre-launch blocker is the email verification limit. Fix with Resend (free, 3k emails/month) and the stack is ready to go public.

---

## Ideas backlog

### Bug report button (every page)
A floating "Report a Bug" button on every page that lets users:
- Type a short description of the issue
- Optionally attach a screenshot (use the browser `html2canvas` or the native Screen Capture API)
- Submit → sends an email to karim.sf09@gmail.com with the description, screenshot attachment, current page URL, and timestamp

Implementation notes:
- Could use Resend (already being set up for SMTP) to send the email — keeps it in one place
- Button should be unobtrusive — bottom corner, low opacity until hovered
- Screenshot capture: `html2canvas` is the simplest option (no browser permissions needed, captures the DOM); native `getDisplayMedia` requires user to pick a screen which is clunky
- Store reports in a `bug_reports` Supabase table too (user_id, page, description, screenshot_url, created_at) so there's a searchable history, not just emails
- Don't require the user to be logged in to submit — capture what you can (page URL, timestamp) and make description + submit the only required action

