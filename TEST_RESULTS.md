# Test results

Run: 2026-11-25T14:53:27.833Z · Node v22.23.5 · workbook: Asset_Living_Build_Exercise_Data_Pack.xlsx
As-of 2026-10-16, takeover 2026-12-01

**54 of 54 passed.**

| Group | Check | Expected | Actual | Result |
|---|---|---|---|---|
| Parsing & date math | Reads MM/DD/YYYY text ("03/14/2025") | "2025-03-14" | "2025-03-14" | PASS |
| Parsing & date math | Reads YYYY-MM-DD text ("2026-04-06") | "2026-04-06" | "2026-04-06" | PASS |
| Parsing & date math | Reads "2026-04-19 00:00:00" | "2026-04-19" | "2026-04-19" | PASS |
| Parsing & date math | Reads a real Excel date (serial 46113) | "2026-04-01" | "2026-04-01" | PASS |
| Parsing & date math | Rejects an impossible date ("13/45/2026") | "unparsed" | "unparsed" | PASS |
| Parsing & date math | Blank date stays blank, not zero | null | null | PASS |
| Parsing & date math | Reads "$1,334.00" as 1334 | 1334 | 1334 | PASS |
| Parsing & date math | Reads "(12.50)" as -12.50 | -12.5 | -12.5 | PASS |
| Parsing & date math | Rejects "abc" as money | "unparsed" | "unparsed" | PASS |
| Parsing & date math | Maps "Occ" to Occupied | "Occupied" | "Occupied" | PASS |
| Parsing & date math | Maps "Vacant - Not Ready" to Vacant – Not Ready | "Vacant – Not Ready" | "Vacant – Not Ready" | PASS |
| Parsing & date math | Unknown status is not guessed ("XYZ") | null | null | PASS |
| Parsing & date math | Matches "Apt 3203" and "#3203" to one unit key | ["3203","3203"] | ["3203","3203"] | PASS |
| Parsing & date math | Cancel-by date = term end minus notice days (11/5/2026 - 90 = 8/7/2026) | "2026-08-07" | "2026-08-07" | PASS |
| Parsing & date math | As-of date drives the math, not the computer clock | 46 | 46 | PASS |
| Parsing & date math | A missing column produces a clear error, not a blank screen | true | true | PASS |
| Parsing & date math | A file without the A1/A2/A3 tabs is refused with a message | 3 | 3 | PASS |
| A1 Rent Roll | Rows loaded | 255 | 255 | PASS |
| A1 Rent Roll | Rows per property | {"Willow Bend Flats":96,"Cedar Crossing":85,"The Reserve at Pinehurst":74} | {"Willow Bend Flats":96,"Cedar Crossing":85,"The Reserve at Pinehurst":74} | PASS |
| A1 Rent Roll | Different raw status spellings | 8 | 8 | PASS |
| A1 Rent Roll | Status after cleanup | {"Occupied":237,"Notice":5,"Vacant – Not Ready":8,"Vacant – Ready":5} | {"Occupied":237,"Vacant – Ready":5,"Notice":5,"Vacant – Not Ready":8} | PASS |
| A1 Rent Roll | Duplicate units | 3 | 3 | PASS |
| A1 Rent Roll | Occupied with lease end before 10/16/2026 | 129 | 129 | PASS |
| A1 Rent Roll | Lease start after lease end | 4 | 4 | PASS |
| A1 Rent Roll | Notice units with no resident / lease / rent | 5 | 5 | PASS |
| A1 Rent Roll | Occupied with no resident name | 5 | 5 | PASS |
| A1 Rent Roll | Occupied rent below 60% of market | 6 | 6 | PASS |
| A1 Rent Roll | Size does not match floorplan (0 sq ft) | 2 | 2 | PASS |
| A1 Rent Roll | Residents owing more than one month | 9 | 9 | PASS |
| A1 Rent Roll | Residents with a balance | 61 | 61 | PASS |
| A1 Rent Roll | Total balances owed | 73206.78 | 73206.78 | PASS |
| A1 Rent Roll | Security deposits to transfer | 171410 | 171410 | PASS |
| A1 Rent Roll | Properties missing a rent roll | 6 | 6 | PASS |
| A2 Checklist | Tasks loaded | 126 | 126 | PASS |
| A2 Checklist | Status counts | {"Not Started":70,"In Progress":26,"Complete":26,"Blocked":4} | {"Not Started":70,"In Progress":26,"Complete":26,"Blocked":4} | PASS |
| A2 Checklist | Critical-path tasks | 90 | 90 | PASS |
| A2 Checklist | Critical-path tasks not started | 53 | 53 | PASS |
| A2 Checklist | Overdue as of 10/16/2026 | 0 | 0 | PASS |
| A2 Checklist | Blocked | 4 | 4 | PASS |
| A2 Checklist | Open tasks with no owner | 4 | 4 | PASS |
| A2 Checklist | Critical, not started, due within 21 days | 11 | 11 | PASS |
| A2 Checklist | Open tasks not updated in 7+ days | 24 | 24 | PASS |
| A2 Checklist | Status contradicts another tab (Elm Street contracts, Lakeline COIs) | 2 | 2 | PASS |
| A3 Vendors | Contracts loaded | 49 | 49 | PASS |
| A3 Vendors | Monthly spend | 92905 | 92905 | PASS |
| A3 Vendors | Auto-renewed, cancel window already closed | 6 | 6 | PASS |
| A3 Vendors | Monthly cost of those locked-in contracts | 10178 | 10178 | PASS |
| A3 Vendors | Contracts that end before takeover with no auto-renew | 6 | 6 | PASS |
| A3 Vendors | Of those, life-safety (fire, elevator) | 3 | 3 | PASS |
| A3 Vendors | Not assignable (and still running at takeover) | 21 | 21 | PASS |
| A3 Vendors | COI already expired | 3 | 3 | PASS |
| A3 Vendors | Contracts in a duplicate-service pair | 4 | 4 | PASS |
| A3 Vendors | Monthly cost of the duplicate pairs | 12000 | 12000 | PASS |
| A3 Vendors | Cost more than 2× the service median | 2 | 2 | PASS |

Action queue at the README dates: 109 items (Critical 8, High 61, Medium 40).

## AI path tests (headless Chrome with a simulated model, tools/ai_mock_test.py)

```
mock | FLAG: AI draft. Claude wrote the wording from the facts shown on this page only. Check it against the source rows, fill every 
mock | CHECK: Fact check: 2 of 5 amounts, dates or IDs in this draft are not in the source rows: $5,100, Dec 9. Fix or remove them before sending.
prompt has staff-owner rule: True | prompt length 2214
brief note: AI-written from the queue’s facts. Fact check: not in the data: $4,746, $5,100, Dec 9.
mock errors: none
none | FLAG: AI drafting isn’t available in this view (for example, when the app is opened from a file). Here is the template draft i
none | CHECK: Fact check: all 8 amounts, dates and IDs in this draft match the source rows. Fill in each [CONFIRM] before sending.
none errors: none
```

Live check in Claude (Nov 25, 2026): AI morning brief and VC-5002 email draft generated; staff-name misattribution found and fixed (see BUILD_LOG.md).
