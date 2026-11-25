# Transition Command Center

A working prototype for **Scenario A, Property Transitions ("Day one without drama")** of the Asset Living build exercise.

**Who it's for:** the Director of Transitions and the incoming regional manager taking over the nine-property Texas portfolio on December 1, 2026.

**What it does:** you load the prior manager's rent roll, the transition checklist and the vendor contracts (the data pack is built in), set the date, and it shows:

1. **Start here:** the three open critical items with the earliest deadlines. Each card says what the problem is, who has to act and by when, with one-click **Draft email** and **Mark handled** buttons.
2. **Today:** one ranked action queue. "Act now" shows 20 items as 10 lines, because items with the same task, the same main reason and the same severity fold into one line. An unowned or blocked task never hides inside a "not started" group. Every item still opens on its own with why it was flagged, the exact source rows, an escalation email (drafted with AI or from a template) and a review note.
3. **Vendors:** a decision for all 49 contracts (keep, replace or re-sign, locked in, new agreement, hold for COI, cancel duplicate) with the calculated last day to cancel.
4. **Rent roll:** intake checks on the prior manager's export. The status codes, dates, money formats and unit IDs are standardized beside the originals. The output is a "needs a human" queue and a clean CSV.
5. **Properties:** a red, amber or green readiness light per property, who carries the critical path, and a list of what the data can't show yet.
6. **Self-test:** 60 checks that run in the page. They cover the parsing rules, every headline count, and the Monday-view grouping, each compared against an answer key worked out separately.

## Run it

- **Public link, no login:** https://strategicallc.github.io/transition-command-center/. Everything works; AI drafts fall back to templates here.
- **Hosted with AI drafting:** the Claude artifact version, shown live in the demo.
- **Code:** https://github.com/strategicallc/transition-command-center
- **Locally, no install:** unzip and open `index.html` in Chrome, Edge or Safari. Everything works offline except AI drafting, which falls back to templates. That fallback is deliberate.
- **Tests:** `npm install` then `npm test`, which runs `tests/run_tests.js` against `data/Asset_Living_Build_Exercise_Data_Pack.xlsx` and writes `TEST_RESULTS.md`.

## How it's put together

```
index.html            page layout and styles
app/engine.js         the rules engine: pure functions, no UI, no AI (same code in browser and Node)
app/app.js            the interface: queue, tabs, runway chart, drafting, fact check
app/selftest.js       parsing tests and the data-pack answer key (shared by the page and Node)
data/datapack.js      the supplied synthetic workbook, embedded so the page needs no upload
vendor/xlsx.full.min.js  SheetJS 0.18.5 (Apache-2.0), offline fallback for the CDN copy
tests/run_tests.js    Node test runner
```

**Design rule: rules find the problems, and AI only writes the words.**
- Every flag comes from a plain, deterministic rule in `engine.js`. Each flag carries the tab, row and field values it came from. The same file and date always give the same answer.
- Claude is used for two things only: drafting an escalation email and drafting the morning brief, from the facts of the flagged items.
- Every draft passes a **fact check**: each dollar amount, date, contract ID and row number in the text must exist in the source rows, and anything that doesn't is shown in red. In testing, it caught an invented "$5,100" and "Dec 9".
- **The AI never counts.** Counts such as "waiting on the prior manager: 7" are worked out by the rules and handed to the AI, and a count check compares any count in the text against them. This came from a live test where the AI said 8 instead of 7.
- If AI is unavailable, templates replace it and nothing else changes.

**Built for a tired Monday.** The first screen answers "what do I do first?" Dates and upload sit in a small bar, the timeline folds away, the brief is three lines, and the labels are plain words with the industry term kept beside them ("Last day to cancel," "Vendor insurance (COI)"). IDs stay visible for traceability.

**The date is a setting, not the clock.** The data is dated October 16, 2026. Every deadline is measured from the "As of" date at the top. Move it to 11/2/2026 and the 16 open tasks due 11/1 turn overdue.

## What it found in the data pack (as of 10/16/2026)

- **6 vendor contracts have already auto-renewed.** Their cancellation windows closed between Aug 7 and Oct 11, and they cost $10,178/month together. The data doesn't say for how long they renewed.
- **6 contracts end before takeover and don't auto-renew. 3 are life-safety:** Cedar Crossing elevator and Elm Street fire/life safety end Oct 31, and the Mission Trails elevator ends Nov 30.
- **Two properties pay two vendors for the same service:** landscaping at Elm Street ($2,900 + $3,100) and pool at Lakeline Vista ($2,900 + $3,100, about 3× the portfolio median). That's $12,000/month across the two pairs.
- **24 of 49 contracts can't be assigned to a new manager** (21 of them still run past takeover). **3 vendor COIs have already expired.**
- **The tracker contradicts the other tabs:**
  - Elm Street's vendor review is "Blocked: prior manager hasn't sent contracts," but the vendor tab already lists 7 Elm Street contracts.
  - Lakeline's insurance and COI task is "Complete," but a Lakeline vendor COI expired June 21.
  - Stonegate's ledger migration is "Complete" before its final rent roll was received or its deposit account opened.
- **53 of 90 critical-path tasks haven't started** six weeks out. 4 tasks are blocked (3 waiting on the prior manager), 4 have no owner, and 24 haven't been updated in over a week. K. Brooks owns 14 open critical tasks, the most of anyone.
- **Rent rolls arrived for only 3 of 9 properties, and each was exported in a different format.** In those three:
  - 129 of 237 occupied units show lease end dates that have already passed. Month-to-month, or a stale export?
  - Other problems: 3 duplicate units, 4 leases that start after they end, 5 "Notice" units with no resident or rent, and 5 occupied units with no name.
  - $73,206.78 is owed and $171,410 in deposits must transfer.

## Assumptions

- "Termination Notice (days)" is counted back from the current term end. For an auto-renewing contract, that gives the last day to cancel.
- Before takeover, the prior manager or the owner is the contracting party, so any notice goes through them.
- Notice units count as occupied.
- Resident names repeat across units in this synthetic data, so repeated names are not flagged.
- The brief mentions about 50 contracts and 120+ tasks. The file has 49 and 126.

## Controls in the prototype vs. before production

| In the prototype | Needed before real company data |
|---|---|
| The workbook is read in the browser. Only one item's facts (or the top act-now items for the brief) are sent to Claude. | Data classification sign-off; an enterprise AI agreement (no training on company data, agreed retention) |
| The prompt treats spreadsheet text as data, not instructions, and all values are escaped before display | SSO, role-based access, and a server-side audit log (review notes currently live in one browser) |
| Fact check on every AI draft; AI text is labeled and editable | Read-only connections to Yardi and the transition tracker instead of uploads, with an IT owner and change control |
| Nothing is sent, changed or deleted; a person copies and sends | Legal review of the contract rules; acceptance tests against two real past transitions |
| Every flag traces to tab, row and fields; the self-test runs in the page | Usage and accuracy monitoring (dismiss rate, flags resolved before deadline), plus a rollback plan |

## With another week

1. **AI on the public page, done safely.** Pre-generate and label real AI drafts for the public demo, so reviewers can read AI output without an API key on a public page. In production, the AI call moves server-side behind sign-in (see `HANDOFF.md`).
2. **Read the contracts themselves** to pull real renewal terms and notice clauses instead of relying on one spreadsheet column.
3. **Shared review status** in a database, plus a read-only connection to the real transition tracker.
4. **An owner-facing day-one readiness report** built from the same rules.
5. **Tune the thresholds with the transitions team**, using how often each rule's flags get dismissed.

## Handing it to IT

`HANDOFF.md` covers what IT receives, what to keep and what to rebuild, who owns what, how a rule changes, a phased rollout with go/no-go gates, how we'd measure use and value, and the go-live checklist. The short version: `engine.js` is the spec and the tests prove it; the interface gets rebuilt in the company's stack; the AI call moves server-side under an enterprise agreement; uploads become read-only connections, except for the prior manager's exports.

## Deliberately not built

- Yardi or tracker integration
- Sending email
- Logins or a database
- Editing source data
- Reading contract PDFs
- A chatbot

Each would add risk or time without changing what the director does on Monday morning.

## Tools used

Claude (Anthropic) wrote the code under my direction. I chose the scenario, set the scope and the rules, and reviewed and tested every stage. Python and pandas built the independent answer key. SheetJS reads the workbook, and Playwright with headless Chrome was used for render and failure-path tests. See `BUILD_LOG.md`.
