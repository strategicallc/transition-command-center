# Build log

Times are Arizona time on Wednesday, 11/25/2026. Brief and data pack received that morning; Hannah Benson (Agilyti) asked for the build within 5 days.

| Time | What happened | Decision / why |
|---|---|---|
| 07:16 | Read the brief and profiled all 13 tabs of the data pack in Python. | Picked **Scenario A**. It's where operations, contracts and people collide, problems surface in front of residents and the owner on day one, and it fits my background (multi-site operations, vendor and contract management, renewal tracking). B had crisper dollar catches but is an accounting tool; C's honest answer is "our track record doesn't support this RFP." |
| 07:20 | Audited A1/A2/A3 and counted every problem independently (pandas). | This became the **answer key** the app is tested against. Learned: 3 different export formats in one rent roll; 129 of 237 occupied leases past their end date; 6 auto-renew windows already missed; tracker statuses that contradict the other tabs. Decided **not** to flag repeated resident names: the synthetic name generator repeats names, so it's not a real finding. |
| 07:24 | Chose the format: one web page, rules engine separate from UI, AI only for wording. | It needs no install, can be shared as a link, and is stable in a live demo. Deterministic rules mean every flag is explainable and testable. AI is limited to drafting emails, where it adds speed and nothing breaks if it's down. |
| 07:28 | Reviewed my own instruction file (priority mode, governance list, proposed skills). | Kept: configurable as-of date, traceability, AI fallback, human sends. Changed: Python → browser app (no install, hosted link); a 12-item governance list → 5 controls in the app + a "before production" table; **no new skills**, because 5 of 6 already existed and building them would displace the prototype. |
| 07:36 | Wrote `engine.js` (rules) and `selftest.js` (answer key). First run: 53/54. | The one failure was the test comparing object key order, not a real defect. Made comparisons order-insensitive. 54/54. |
| 07:39 | Tuned rules after reading every flagged item by hand. | The welcome-letter "dependency" conflicts are softer than ledger migration, so they're Medium, not High. Non-assignable contracts route to the vendor (new agreement), not the prior manager. |
| 07:41 | Built the interface: runway chart, action queue, detail with source rows, vendors, rent roll, properties, self-test, how-it-works. | "Act now" = every critical item plus high items due within 21 days, so Monday morning is 20 items, not 109. |
| 07:44 | Render-tested in headless Chrome (desktop and phone). | **Defects:** runway lane labels collided with the as-of marker → moved labels to a left gutter; dates wrapped in tables → no-wrap; vague vendor decision labels ("Terminate / re-sign") → explicit decisions. |
| 07:46 | Time-travel test: as-of 11/02/2026 → 16 overdue (the 18 tasks due 11/01/2026 minus 2 complete). As-of 12/01/2026 → 100 overdue. | Confirms the date drives every rule. |
| 07:48 | Published as a Claude artifact and turned on "Use Claude" for drafting. Library loads from cdnjs with a bundled offline copy as fallback. | |
| 07:49 | Tested AI drafting live in Claude. | **Defect found:** the AI morning brief listed Asset staff (M. Odom, S. Alvarez, L. Ford) under "Prior manager," because the data field was named "owner." Fix: renamed fields (`asset_living_staff_owner`, `party_that_must_act`) and added an explicit rule. Re-tested live: fixed. |
| 07:50 | **Defect found:** the detail panel's bottom (the draft box) was unreachable inside Claude's viewer, which sizes the frame to the page. Fix: removed the sticky panel and scroll it into view on selection. | |
| 07:51 | Tested the AI failure paths with a simulated model. (1) A draft containing an invented "$5,100" and "12/09/2026": the fact check flagged both. (2) No AI available: the template appears and everything else works. | |
| 07:53 | README, build log, test results, demo and panel prep. | |
| 08:10 | Created the public GitHub repo and turned on GitHub Pages for a no-login link. | Public because the data is synthetic and reviewers shouldn't need accounts over a holiday weekend. |
| 08:36 | **Usability test: "someone having a bad morning before coffee."** The honest answer was no. The first action wasn't the first thing on screen, 14 of the 20 urgent items were two tasks repeated, the loudest button (upload) was the wrong one, and the labels used jargon. | Decided to fix it before recording the video. |
| 08:40 | Pressure-tested my own fix before building it. **My first grouping idea (20 → 8 lines) would have hidden an unowned critical task and a blocked one inside a "not started" group.** | Rejected it. Group only same task + same main reason + same severity, which gives 20 → 10 lines. Kept IDs and the industry terms for traceability and credibility. Kept the as-of date visible. |
| 08:47 | Built the Monday view: Start here (3 cards), grouped list, one-click Draft email / Mark handled, action-first detail, 3-line brief, compact data bar, folded timeline, plain labels. Added 6 self-test checks (60/60). | |
| 08:50 | **Defects found:** severity tags stretched tall in rows; drafting from Start here switched the list to "Everything" (109 items), which is confusing for the exact user this is for. Both fixed and re-tested live in Claude. | |
| 09:05 | GitHub Pages failed to deploy three times with GitHub-side 500 errors (build fine, deploy step failed). Stopped retrying; the next push deployed normally. | Didn't send the public link until the new version was confirmed live. |
| 09:33 | Public page: the no-AI message said "opened from a file," which was wrong there. Reworded it, and hid the AI-only brief button outside Claude. | |
| 09:37 | Considered putting live AI on the public page. | **Didn't.** It would mean an API key behind a public endpoint, plus cost and abuse risk. Logged as a "with another week" item (pre-generated, labeled drafts) and as a production design (server-side, behind sign-in). |
| 09:41 | **Second AI defect found in a live test:** the AI brief said "Prior manager (8 items)"; the rules say 7. The fact check missed it because it didn't check counts. | Fix: the rules now compute the counts and hand them to the AI with "never count items yourself," and a new count check compares any "Prior manager (N)" against the rules. Re-tested live: "Prior manager 7, Owner 1, Vendor 0, Asset team 12," check passes. |
| 09:50 | Wrote `HANDOFF.md` for IT. | |
| 10:05 | Switched every date people read to MM/DD/YYYY (app, emails, AI prompts, CSV exports, documents). Checked first whether Yardi wants YYYY-MM-DD for imports: a Yardi import guide says it typically requires MM/DD/YYYY, and Asset Living's own import template controls the final format. | Added "confirm the date format against Asset Living's Yardi import template" to the IT handoff. Fixed the timeline so the longer labels don't overlap. |

## Where AI helped and where it got in the way

- **Helped:** writing the engine and the interface quickly; drafting emails that read like a person wrote them; turning a rules-based list into a readable morning brief.
- **Got in the way:** the AI brief confidently misattributed people (caught in testing, fixed with better field names). The fix was to treat the AI as a writer of words, never a source of facts, and to check its numbers automatically.
- **The pattern I'd take into the role:** deterministic rules decide; AI drafts; a fact check verifies; a person sends. And never ask the AI to count: give it the numbers.

## Time spent

About 40 minutes from first read to a tested, hosted build, plus about 35 minutes for GitHub and the Monday-morning redesign, and about 25 minutes for the public-page fix, the AI count fix and the IT handoff. [Add: time for the video, rehearsal and any changes you make.]
