# Handing the Transition Command Center to IT

This is a prototype built on the synthetic data pack. It is not a production system. This note says what IT is receiving, what to keep, what to rebuild, who owns what, and how we'll know it's working.

## 1. What you're receiving

| Piece | File | What it is | Status |
|---|---|---|---|
| Rules engine | `app/engine.js` | Every flag, severity, deadline and routing decision. Pure functions, no UI, no AI. | **The spec.** Keep the logic; port it as-is. |
| Tests | `app/selftest.js`, `tests/run_tests.js` | 60 checks: parsing, every headline count, the Monday-view grouping. | **Keep.** Run on every change. |
| Data intake | `mapRows` in `app/engine.js` | Finds tabs by name and columns by header; reads three date formats and currency text; flags anything it can't read. | Keep the logic. Rebuild the source (section 2). |
| Interface | `index.html`, `app/app.js` | Start here, action queue, vendors, rent roll, properties, self-test. | Rebuild in the company's standard UI stack; use this as the working reference. |
| AI drafting | `aiDraft`, `factsFor`, `showCheck`, `checkCounts` in `app/app.js` | Prompt rules, the facts sent, the fact check on amounts/dates/IDs, and the count check. | Keep the prompt rules and both checks. Move the AI call server-side. |

## 2. What changes for production

| Today (prototype) | Production |
|---|---|
| Spreadsheet upload, read in the browser | **Read-only connections** to Yardi (units, residents, ledgers, deposits), the transition tracker the team actually uses, and the vendor contract repository. **Keep an upload path for the prior manager's exports**: they always arrive as files from another company's system, and the intake checks are built for exactly that. |
| Review status and notes saved in one browser | A shared database with an audit trail: who marked what, when, and why. |
| AI through Claude's in-page connection | A **server-side** call through the company's approved AI provider, under an enterprise agreement (no training on company data, agreed retention). Keys live in the secrets manager and never reach the browser. Prompts, outputs and fact-check results are logged. Templates stay as the fallback. |
| Anyone with the file can open it | **SSO and roles:** the Director of Transitions sees everything; regional managers see their properties; Procurement sees vendor items; Accounting sees bank, deposit and ledger items. |
| Public demo page | Internal hosting behind SSO. No public page. |

## 3. Who owns what

| Role | Owns |
|---|---|
| **Director of Transitions** (business owner) | The rules and thresholds (21-day "act now" window, 60%-of-market rent, 2× cost median, what counts as critical), and whether the tool is working. |
| **IT product owner** | Hosting, connectors, security, releases, uptime. |
| **Data owners** | Property Accounting (ledgers, deposits), Procurement (vendor contracts), Systems (Yardi setup). |
| **Legal** | A one-time review of the contract rules (assignment, notice, auto-renewal), then any change to them. |

## 4. How a rule changes

1. Someone asks for a change. Example: "act now should be 14 days, not 21."
2. The Director of Transitions approves it.
3. A developer changes the rule in the engine and adds or updates a test.
4. All tests pass in the build pipeline before release.
5. Release notes say what changed; the Director confirms it on the next live transition.

## 5. Rollout, with a go/no-go at each step

1. **Pilot (weeks 1–2):** this Texas takeover, read-only data, the Director and one regional manager using it daily alongside today's spreadsheet process. Go/no-go: did it catch something the spreadsheet missed, and do they keep opening it?
2. **Connect (weeks 3–4):** read-only tracker and Yardi connections, shared review status, SSO.
3. **AI in production (weeks 5–6):** server-side drafting under the approved agreement, with logging. Tune thresholds using the dismiss rate per rule.
4. **Standard:** every new transition starts in the command center.

## 6. How we'll know it's used and working

| Type | Measure |
|---|---|
| Adoption | Weekly active users on the transitions team; % of critical items reviewed within 24 hours; % of AI drafts actually used |
| Quality | Dismiss rate per rule (false alarms); fact-check failures on AI drafts; how often AI falls back to templates |
| Outcome | Day-one issues reported by residents or the owner, compared with past transitions; auto-renewal windows missed (target zero); contracts lapsing without a replacement (target zero); days to close a critical item |

Baseline the current process before the pilot, so any time-savings claim is measured, not estimated.

## 7. Known limits being handed over

- Only 3 of 9 rent rolls were in the data pack, so resident-level checks are blind for six properties.
- Renewal term lengths aren't in the vendor data, so the cost of a missed cancel window can't be sized.
- The thresholds are judgment calls that haven't been tuned with users.
- The fact check covers dollar amounts, dates, contract IDs, row numbers and the waiting-on counts. It does not check names or free-text claims.
- No contact names or emails are in the data, so every draft leaves a [CONFIRM] for the recipient.

## 8. Before go-live

- [ ] Data classification approved for resident, vendor and financial data
- [ ] Enterprise AI agreement in place; keys in the secrets manager
- [ ] SSO and roles configured; server-side audit log on
- [ ] Legal review of the contract rules
- [ ] Acceptance tests pass on two real past transitions
- [ ] Monitoring live (section 6) and a rollback plan written
- [ ] Support owner named, and a one-page runbook for the transitions team
