# Transition Command Center

A working prototype for **Scenario A, Property Transitions ("Day one without drama")** of the Asset Living build exercise.

**Who it's for:** the Director of Transitions and the incoming regional manager taking over the nine-property Texas portfolio on December 1, 2026.

**What it does:** you load the prior manager's rent roll, the transition checklist and the vendor contracts (the data pack is built in), set the date, and it shows:

1. **Today:** one ranked action queue. It covers what needs attention, why, who has to act, the deadline, and the exact source rows behind each flag. Each item has a review status and notes, plus an escalation email you can draft with AI or from a template.
2. **Vendors:** a decision for all 49 contracts (keep, replace or re-sign, locked in, new agreement, hold for COI, cancel duplicate) with the calculated cancel-by date.
3. **Rent roll:** intake checks on the prior manager's export. The status codes, dates, money formats and unit IDs are standardized beside the originals. The output is a "needs a human" queue and a clean CSV.
4. **Properties:** a red, amber or green readiness light per property, who carries the critical path, and a list of what the data can't show yet.
5. **Self-test:** 54 checks that run in the page. They cover the parsing rules and every headline count, compared against an answer key counted separately in Python.

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
- If AI is unavailable, templates replace it and nothing else changes.

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
