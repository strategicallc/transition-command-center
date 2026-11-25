/* Self-Test: the same checks run in the browser (Self-Test tab) and in Node (tests/run_tests.js).
 * "Expected" values for the data pack were counted independently in Python/pandas from the
 * original workbook, not copied from this app's output. */
(function (root) {
  'use strict';
  function canon(v) { if (v && typeof v === 'object' && !Array.isArray(v)) { var o = {}; Object.keys(v).sort().forEach(function (k) { o[k] = canon(v[k]); }); return o; } return Array.isArray(v) ? v.map(canon) : v; }
  function eq(a, b) { return JSON.stringify(canon(a)) === JSON.stringify(canon(b)); }

  function unitTests(E) {
    var t = [];
    function check(name, actual, expected) { t.push({ group: 'Parsing & date math', name: name, expected: expected, actual: actual, pass: eq(actual, expected) }); }
    check('Reads MM/DD/YYYY text ("03/14/2025")', E.iso(E.parseDate('03/14/2025').day), '2025-03-14');
    check('Reads YYYY-MM-DD text ("2026-04-06")', E.iso(E.parseDate('2026-04-06').day), '2026-04-06');
    check('Reads "2026-04-19 00:00:00"', E.iso(E.parseDate('2026-04-19 00:00:00').day), '2026-04-19');
    check('Reads a real Excel date (serial 46113)', E.iso(E.parseDate(46113).day), '2026-04-01');
    check('Rejects an impossible date ("13/45/2026")', E.parseDate('13/45/2026').fmt, 'unparsed');
    check('Blank date stays blank, not zero', E.parseDate('').day, null);
    check('Reads "$1,334.00" as 1334', E.parseMoney('$1,334.00').val, 1334);
    check('Reads "(12.50)" as -12.50', E.parseMoney('(12.50)').val, -12.5);
    check('Rejects "abc" as money', E.parseMoney('abc').fmt, 'unparsed');
    check('Maps "Occ" to Occupied', E.normStatus('Occ'), 'Occupied');
    check('Maps "Vacant - Not Ready" to Vacant – Not Ready', E.normStatus('Vacant - Not Ready'), 'Vacant – Not Ready');
    check('Unknown status is not guessed ("XYZ")', E.normStatus('XYZ'), null);
    check('Matches "Apt 3203" and "#3203" to one unit key', [E.unitKey('Apt 3203'), E.unitKey('#3203')], ['3203', '3203']);
    var m = E.analyze({ 'A3 Vendor Contracts': [{ 'Contract ID': 'X', 'Property': 'P', 'Vendor': 'V', 'Service': 'S', 'Monthly Cost ($)': 1, 'Current Term End': '2026-11-05', 'Auto-Renew (Y/N)': 'Y', 'Termination Notice (days)': 90 }],
      'A1 Rent Roll': [{ Property: 'P', Unit: '1', 'Unit Status': 'O', 'Market Rent': 1, 'Lease Rent': 1, 'Lease Start': '2026-01-01', 'Lease End': '2026-12-31' }],
      'A2 Transition Checklist': [{ Property: 'P', Task: 't', 'Due Date': '2026-11-01', Status: 'Not Started' }] }, { asOf: '2026-10-16', takeover: '2026-12-01' });
    check('Cancel-by date = term end minus notice days (11/5/2026 - 90 = 8/7/2026)', E.iso(m.contracts[0].noticeBy), '2026-08-07');
    check('As-of date drives the math, not the computer clock', m.meta.daysToTakeover, 46);
    var bad = E.analyze({ 'A1 Rent Roll': [{ Property: 'P' }], 'A2 Transition Checklist': [], 'A3 Vendor Contracts': [] }, { asOf: '2026-10-16', takeover: '2026-12-01' });
    check('A missing column produces a clear error, not a blank screen', bad.meta.errors.length > 0, true);
    var none = E.analyze({ 'Sheet1': [] }, { asOf: '2026-10-16', takeover: '2026-12-01' });
    check('A file without the A1/A2/A3 tabs is refused with a message', none.meta.errors.length, 3);
    return t;
  }

  var EXPECT = [
    ['A1 Rent Roll', 'Rows loaded', function (s) { return s.units; }, 255],
    ['A1 Rent Roll', 'Rows per property', function (s) { return s.unitsByProperty; }, { 'Willow Bend Flats': 96, 'Cedar Crossing': 85, 'The Reserve at Pinehurst': 74 }],
    ['A1 Rent Roll', 'Different raw status spellings', function (s) { return s.rawStatusCount; }, 8],
    ['A1 Rent Roll', 'Status after cleanup', function (s) { return s.status; }, { 'Occupied': 237, 'Notice': 5, 'Vacant – Not Ready': 8, 'Vacant – Ready': 5 }],
    ['A1 Rent Roll', 'Duplicate units', function (s) { return s.dupUnits; }, 3],
    ['A1 Rent Roll', 'Occupied with lease end before 10/16/2026', function (s) { return s.LEASE_ENDED; }, 129],
    ['A1 Rent Roll', 'Lease start after lease end', function (s) { return s.START_AFTER_END; }, 4],
    ['A1 Rent Roll', 'Notice units with no resident / lease / rent', function (s) { return s.NOTICE_NO_DATA; }, 5],
    ['A1 Rent Roll', 'Occupied with no resident name', function (s) { return s.OCC_NO_NAME; }, 5],
    ['A1 Rent Roll', 'Occupied rent below 60% of market', function (s) { return s.LOW_RENT; }, 6],
    ['A1 Rent Roll', 'Size does not match floorplan (0 sq ft)', function (s) { return s.SIZE_MISMATCH; }, 2],
    ['A1 Rent Roll', 'Residents owing more than one month', function (s) { return s.HIGH_BALANCE; }, 9],
    ['A1 Rent Roll', 'Residents with a balance', function (s) { return s.balanceCount; }, 61],
    ['A1 Rent Roll', 'Total balances owed', function (s) { return s.balanceTotal; }, 73206.78],
    ['A1 Rent Roll', 'Security deposits to transfer', function (s) { return s.deposits; }, 171410],
    ['A1 Rent Roll', 'Properties missing a rent roll', function (s) { return s.missingRentRolls; }, 6],
    ['A2 Checklist', 'Tasks loaded', function (s) { return s.tasks; }, 126],
    ['A2 Checklist', 'Status counts', function (s) { return s.taskStatus; }, { 'Not Started': 70, 'In Progress': 26, 'Complete': 26, 'Blocked': 4 }],
    ['A2 Checklist', 'Critical-path tasks', function (s) { return s.critical; }, 90],
    ['A2 Checklist', 'Critical-path tasks not started', function (s) { return s.critNotStarted; }, 53],
    ['A2 Checklist', 'Overdue as of 10/16/2026', function (s) { return s.OVERDUE; }, 0],
    ['A2 Checklist', 'Blocked', function (s) { return s.BLOCKED; }, 4],
    ['A2 Checklist', 'Open tasks with no owner', function (s) { return s.NO_OWNER; }, 4],
    ['A2 Checklist', 'Critical, not started, due within 21 days', function (s) { return s.NOT_STARTED_SOON; }, 11],
    ['A2 Checklist', 'Open tasks not updated in 7+ days', function (s) { return s.STALE; }, 24],
    ['A2 Checklist', 'Status contradicts another tab (Elm Street contracts, Lakeline COIs)', function (s) { return s.statusConflicts; }, 2],
    ['A3 Vendors', 'Contracts loaded', function (s) { return s.contracts; }, 49],
    ['A3 Vendors', 'Monthly spend', function (s) { return s.monthly; }, 92905],
    ['A3 Vendors', 'Auto-renewed, cancel window already closed', function (s) { return s.CANCEL_WINDOW_MISSED; }, 6],
    ['A3 Vendors', 'Monthly cost of those locked-in contracts', function (s) { return s.lockedMonthly; }, 10178],
    ['A3 Vendors', 'Contracts that end before takeover with no auto-renew', function (s) { return s.LAPSES_BEFORE_TAKEOVER; }, 6],
    ['A3 Vendors', 'Of those, life-safety (fire, elevator)', function (s) { return s.lifeSafetyLapses; }, 3],
    ['A3 Vendors', 'Not assignable (and still running at takeover)', function (s) { return s.NOT_ASSIGNABLE; }, 21],
    ['A3 Vendors', 'COI already expired', function (s) { return s.COI_EXPIRED; }, 3],
    ['A3 Vendors', 'Contracts in a duplicate-service pair', function (s) { return s.DUPLICATE_SERVICE; }, 4],
    ['A3 Vendors', 'Monthly cost of the duplicate pairs', function (s) { return s.dupMonthly; }, 12000],
    ['A3 Vendors', 'Cost more than 2× the service median', function (s) { return s.COST_OUTLIER; }, 2]
  ];

  function packTests(model) {
    var s = model.stats;
    return EXPECT.map(function (e) { var a = e[2](s); return { group: e[0], name: e[1], expected: e[3], actual: a, pass: eq(a, e[3]) }; });
  }

  function runSelfTest(E, model) {
    var out = unitTests(E), packApplies = model && model.meta && model.meta.isDataPack && E.iso(model.meta.asOf) === '2026-10-16' && E.iso(model.meta.takeover) === '2026-12-01';
    if (packApplies) out = out.concat(packTests(model));
    return { results: out, packApplies: !!packApplies };
  }

  var S = { runSelfTest: runSelfTest, packTests: packTests, unitTests: unitTests };
  if (typeof module !== 'undefined' && module.exports) module.exports = S; else root.SelfTest = S;
})(this);
