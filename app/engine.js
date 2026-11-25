/* Transition Command Center — rules engine
 * Pure functions, no DOM. Runs in the browser and in Node (tests).
 * Every rule is deterministic and every flag carries the source tab + row it came from.
 * AI is never used here. */
(function (root) {
  'use strict';
  var DAY = 86400000;

  // ---------- dates (integer UTC day numbers; no time zones, no computer clock) ----------
  function ymd(y, m, d) {
    var t = Date.UTC(y, m - 1, d), dt = new Date(t);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return Math.round(t / DAY);
  }
  function iso(n) { return n == null ? '' : new Date(n * DAY).toISOString().slice(0, 10); }
  var MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function nice(n) {
    if (n == null) return '';
    var d = new Date(n * DAY);
    var mm = d.getUTCMonth() + 1, dd = d.getUTCDate();
    return (mm < 10 ? '0' : '') + mm + '/' + (dd < 10 ? '0' : '') + dd + '/' + d.getUTCFullYear(); // MM/DD/YYYY everywhere people read dates
  }
  function parseISOInput(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? ymd(+m[1], +m[2], +m[3]) : null; }

  /* Accepts: Excel date serials, JS Dates, 'MM/DD/YYYY', 'YYYY-MM-DD', 'YYYY-MM-DD 00:00:00'. */
  function parseDate(v) {
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return { day: null, fmt: 'blank' };
    if (typeof v === 'number' && isFinite(v)) return { day: Math.round(v) - 25569, fmt: 'excel-date' };
    if (v instanceof Date && !isNaN(v)) return { day: ymd(v.getFullYear(), v.getMonth() + 1, v.getDate()), fmt: 'excel-date' };
    var s = String(v).trim(), m;
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) { var a = ymd(+m[3], +m[1], +m[2]); return a == null ? { day: null, fmt: 'unparsed', raw: s } : { day: a, fmt: 'MM/DD/YYYY text' }; }
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]00:00(?::00)?)?$/.exec(s))) { var b = ymd(+m[1], +m[2], +m[3]); return b == null ? { day: null, fmt: 'unparsed', raw: s } : { day: b, fmt: 'YYYY-MM-DD text' }; }
    return { day: null, fmt: 'unparsed', raw: s };
  }

  /* Accepts numbers, '$1,334.00', '(12.50)' for negatives. */
  function parseMoney(v) {
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return { val: null, fmt: 'blank' };
    if (typeof v === 'number' && isFinite(v)) return { val: v, fmt: 'number' };
    var s = String(v).trim(), neg = /^\(.*\)$/.test(s);
    var t = s.replace(/[()$,\s]/g, '');
    if (t.charAt(0) === '-') { neg = !neg; t = t.slice(1); }
    if (!/^\d+(\.\d+)?$/.test(t)) return { val: null, fmt: 'unparsed', raw: s };
    return { val: (neg ? -1 : 1) * parseFloat(t), fmt: 'currency text' };
  }

  var STATUS_MAP = {
    'o': 'Occupied', 'occ': 'Occupied', 'occupied': 'Occupied',
    'vnr': 'Vacant – Not Ready', 'vacant - not ready': 'Vacant – Not Ready', 'vacant-not ready': 'Vacant – Not Ready', 'vacant not ready': 'Vacant – Not Ready',
    'vr': 'Vacant – Ready', 'vacant-ready': 'Vacant – Ready', 'vacant - ready': 'Vacant – Ready', 'vacant ready': 'Vacant – Ready',
    'notice': 'Notice', 'ntv': 'Notice', 'notice to vacate': 'Notice'
  };
  function normStatus(v) { if (v == null) return null; return STATUS_MAP[String(v).trim().toLowerCase().replace(/\s+/g, ' ')] || null; }
  function unitKey(u) { return String(u == null ? '' : u).replace(/^\s*(apt\.?|unit|#)\s*/i, '').trim(); }
  function yn(v) { var s = String(v == null ? '' : v).trim().toUpperCase(); return s === 'Y' || s === 'YES' ? 'Y' : s === 'N' || s === 'NO' ? 'N' : null; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function money$(n) { return n == null ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
  function normKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // ---------- source mapping (find tabs by name, columns by header text) ----------
  var SPEC = {
    A1: { find: /^a1\b|rent ?roll/i, label: 'A1 Rent Roll', cols: {
      code: ['Prior Mgr Property Code'], property: ['Property'], unit: ['Unit'], floorplan: ['Floorplan'], beds: ['Beds'], sqft: ['Sq Ft'],
      status: ['Unit Status'], resident: ['Resident Name'], market: ['Market Rent'], rent: ['Lease Rent'], start: ['Lease Start'], end: ['Lease End'],
      deposit: ['Security Deposit'], balance: ['Current Balance'], notes: ['Notes'] }, required: ['property', 'unit', 'status', 'market', 'rent', 'start', 'end'] },
    A2: { find: /^a2\b|checklist/i, label: 'A2 Transition Checklist', cols: {
      property: ['Property'], market: ['Market'], task: ['Task'], func: ['Function'], owner: ['Owner'], critical: ['Critical Path (Y/N)', 'Critical Path'],
      due: ['Due Date'], status: ['Status'], updated: ['Last Updated'], notes: ['Notes'] }, required: ['property', 'task', 'due', 'status'] },
    A3: { find: /^a3\b|vendor/i, label: 'A3 Vendor Contracts', cols: {
      id: ['Contract ID'], property: ['Property'], vendor: ['Vendor'], service: ['Service'], monthly: ['Monthly Cost ($)', 'Monthly Cost'], start: ['Start Date'],
      termEnd: ['Current Term End'], autoRenew: ['Auto-Renew (Y/N)', 'Auto-Renew'], noticeDays: ['Termination Notice (days)', 'Termination Notice'],
      coi: ['COI Expiration'], assignable: ['Assignable to New Manager (Y/N)', 'Assignable to New Manager'], notes: ['Notes'] }, required: ['id', 'property', 'service', 'termEnd', 'autoRenew', 'noticeDays'] }
  };

  function mapRows(sheets, key, errors) {
    var spec = SPEC[key], names = Object.keys(sheets), tab = null;
    for (var i = 0; i < names.length; i++) if (spec.find.test(names[i])) { tab = names[i]; break; }
    if (!tab) { errors.push('Missing tab: ' + spec.label + '. Tabs found: ' + names.join(', ')); return { tab: null, rows: [] }; }
    var rows = sheets[tab] || [], headers = {};
    rows.forEach(function (r) { Object.keys(r).forEach(function (h) { headers[normKey(h)] = h; }); });
    var colOf = {}, missing = [];
    Object.keys(spec.cols).forEach(function (f) {
      var hit = null; spec.cols[f].some(function (c) { if (headers[normKey(c)]) { hit = headers[normKey(c)]; return true; } return false; });
      colOf[f] = hit; if (!hit && spec.required.indexOf(f) >= 0) missing.push(spec.cols[f][0]);
    });
    if (missing.length) errors.push(spec.label + ' (tab "' + tab + '") is missing required column(s): ' + missing.join(', '));
    var out = [];
    rows.forEach(function (r, i) {
      var o = { _row: i + 2 }, any = false;
      Object.keys(colOf).forEach(function (f) { o[f] = colOf[f] ? r[colOf[f]] : null; if (o[f] !== null && o[f] !== undefined && o[f] !== '') any = true; });
      if (any) out.push(o);
    });
    return { tab: tab, rows: missing.length ? [] : out };
  }

  var SEV = { Critical: 3, High: 2, Medium: 1 };
  function maxSev(reasons) { var b = 'Medium'; reasons.forEach(function (r) { if (SEV[r.sev] > SEV[b]) b = r.sev; }); return b; }

  // ---------- main ----------
  function analyze(sheets, opts) {
    opts = opts || {};
    var A = parseISOInput(opts.asOf), T = parseISOInput(opts.takeover);
    var errors = [], warnings = [];
    if (A == null) errors.push('As-of date is not a valid date.');
    if (T == null) errors.push('Takeover date is not a valid date.');
    var m1 = mapRows(sheets, 'A1', errors), m2 = mapRows(sheets, 'A2', errors), m3 = mapRows(sheets, 'A3', errors);
    var model = { meta: { asOf: A, takeover: T, daysToTakeover: (A != null && T != null) ? T - A : null, tabs: { A1: m1.tab, A2: m2.tab, A3: m3.tab }, errors: errors, warnings: warnings, parse: {} },
      units: [], tasks: [], contracts: [], properties: [], items: [], stats: {} };
    if (errors.length) return model;
    var parse = model.meta.parse, unparsed = [];
    function tally(k, f) { parse[k] = parse[k] || {}; parse[k][f] = (parse[k][f] || 0) + 1; }
    function src(tab, row, id) { return { tab: tab, row: row, id: id }; }

    // ---- A1 units ----
    var rawStatus = {};
    var units = m1.rows.map(function (r) {
      var s = parseDate(r.start), e = parseDate(r.end), mk = parseMoney(r.market), rt = parseMoney(r.rent), dp = parseMoney(r.deposit), bl = parseMoney(r.balance);
      tally('A1 Lease Start', s.fmt); tally('A1 Lease End', e.fmt); tally('A1 Lease Rent', rt.fmt);
      [['Lease Start', s], ['Lease End', e]].forEach(function (p) { if (p[1].fmt === 'unparsed') unparsed.push({ tab: m1.tab, row: r._row, field: p[0], value: p[1].raw }); });
      [['Market Rent', mk], ['Lease Rent', rt], ['Security Deposit', dp], ['Current Balance', bl]].forEach(function (p) { if (p[1].fmt === 'unparsed') unparsed.push({ tab: m1.tab, row: r._row, field: p[0], value: p[1].raw }); });
      var st = str(r.status); rawStatus[st] = (rawStatus[st] || 0) + 1;
      return { row: r._row, code: str(r.code), property: str(r.property), unit: str(r.unit), key: unitKey(r.unit), floorplan: str(r.floorplan),
        beds: r.beds == null ? null : +r.beds, sqft: r.sqft == null ? null : +r.sqft, statusRaw: st, status: normStatus(st), resident: str(r.resident),
        market: mk.val, rent: rt.val, start: s.day, end: e.day, deposit: dp.val, balance: bl.val, notes: str(r.notes), fmtDate: s.fmt !== 'blank' ? s.fmt : e.fmt, fmtMoney: rt.fmt, flags: [], badParse: s.fmt === 'unparsed' || e.fmt === 'unparsed' || rt.fmt === 'unparsed' || mk.fmt === 'unparsed' };
    });
    model.meta.rawStatus = rawStatus;

    // ---- A2 tasks ----
    var tasks = m2.rows.map(function (r) {
      var d = parseDate(r.due), u = parseDate(r.updated);
      tally('A2 Due Date', d.fmt);
      if (d.fmt === 'unparsed') unparsed.push({ tab: m2.tab, row: r._row, field: 'Due Date', value: d.raw });
      var stt = str(r.status), sl = stt.toLowerCase();
      var status = /complete|done/.test(sl) ? 'Complete' : /block/.test(sl) ? 'Blocked' : /progress/.test(sl) ? 'In Progress' : /not started|^$/.test(sl) ? 'Not Started' : stt;
      return { row: r._row, property: str(r.property), market: str(r.market), task: str(r.task), func: str(r.func), owner: str(r.owner), critical: yn(r.critical) === 'Y',
        due: d.day, status: status, updated: u.day, notes: str(r.notes), flags: [] };
    });

    // ---- A3 contracts ----
    var contracts = m3.rows.map(function (r) {
      var te = parseDate(r.termEnd), sd = parseDate(r.start), coi = parseDate(r.coi), mo = parseMoney(r.monthly), nd = parseMoney(r.noticeDays);
      tally('A3 Current Term End', te.fmt);
      [['Current Term End', te], ['COI Expiration', coi]].forEach(function (p) { if (p[1].fmt === 'unparsed') unparsed.push({ tab: m3.tab, row: r._row, field: p[0], value: p[1].raw }); });
      var c = { row: r._row, id: str(r.id), property: str(r.property), vendor: str(r.vendor), service: str(r.service), monthly: mo.val, start: sd.day, termEnd: te.day,
        autoRenew: yn(r.autoRenew), noticeDays: nd.val, coi: coi.day, assignable: yn(r.assignable), notes: str(r.notes), flags: [] };
      c.noticeBy = (c.termEnd != null && c.noticeDays != null) ? c.termEnd - c.noticeDays : null;
      return c;
    });
    model.meta.unparsed = unparsed;

    var allProps = [];
    [tasks, contracts, units].forEach(function (L) { L.forEach(function (x) { if (x.property && allProps.indexOf(x.property) < 0) allProps.push(x.property); }); });
    var taskOrder = []; tasks.forEach(function (t) { if (taskOrder.indexOf(t.property) < 0) taskOrder.push(t.property); });
    allProps.sort(function (a, b) { var ia = taskOrder.indexOf(a), ib = taskOrder.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b); });

    var items = [];
    function addItem(it) { it.severity = maxSev(it.reasons); items.push(it); return it; }
    function taskOf(prop, re) { for (var i = 0; i < tasks.length; i++) if (tasks[i].property === prop && re.test(tasks[i].task)) return tasks[i]; return null; }

    // ================= VENDOR RULES =================
    var lifeSafety = /fire|life ?safety|elevator/i;
    var byService = {};
    contracts.forEach(function (c) { if (c.monthly > 0) (byService[c.service] = byService[c.service] || []).push(c.monthly); });
    var groups = {};
    contracts.forEach(function (c) { var k = c.property + '|' + c.service.toLowerCase(); (groups[k] = groups[k] || []).push(c); });
    contracts.forEach(function (c) {
      var f = c.flags;
      if (c.autoRenew === 'N' && c.termEnd != null && c.termEnd < T) {
        f.push({ code: 'LAPSES_BEFORE_TAKEOVER', sev: lifeSafety.test(c.service) ? 'Critical' : 'High',
          text: (c.termEnd < A ? 'Ended ' + nice(c.termEnd) : 'Ends ' + nice(c.termEnd)) + ', before takeover, and does not auto-renew. ' + (lifeSafety.test(c.service) ? 'Life-safety service: no coverage on file for day one.' : 'Service gap on day one unless re-signed.') });
      }
      if (c.autoRenew === 'Y' && c.noticeBy != null && c.noticeBy < A) {
        f.push({ code: 'CANCEL_WINDOW_MISSED', sev: 'High',
          text: 'Auto-renews. Cancellation notice was due ' + nice(c.noticeBy) + ' (' + c.noticeDays + ' days before the ' + nice(c.termEnd) + ' term end). That window has closed, so it renews unless the vendor agrees otherwise. The renewal term length is not in the data.' });
      }
      if (c.autoRenew === 'Y' && c.noticeBy != null && c.noticeBy >= A && c.noticeBy - A <= 60) {
        var dn = c.noticeBy - A;
        f.push({ code: 'NOTICE_DUE_SOON', sev: dn <= 30 ? 'High' : 'Medium', text: 'Keep-or-cancel decision due by ' + nice(c.noticeBy) + ' (' + dn + ' days). After that it auto-renews.' });
      }
      if (c.autoRenew === 'N' && c.termEnd != null && c.termEnd >= T && c.termEnd - T <= 90) {
        f.push({ code: 'ENDS_SOON_AFTER_TAKEOVER', sev: 'Medium', text: 'Expires ' + nice(c.termEnd) + ', within 90 days after takeover. Plan renewal or replacement.' });
      }
      if (c.assignable === 'N' && !(c.autoRenew === 'N' && c.termEnd < T)) {
        f.push({ code: 'NOT_ASSIGNABLE', sev: 'High', text: 'Cannot be assigned to a new manager. Needs a new agreement in Asset’s or the owner’s name, or termination, before ' + nice(T) + '.' });
      }
      if (c.coi != null && c.coi < A) f.push({ code: 'COI_EXPIRED', sev: 'High', text: 'Certificate of insurance expired ' + nice(c.coi) + '. Vendor may be working on site uninsured.' });
      else if (c.coi != null && c.coi <= T + 30) f.push({ code: 'COI_EXPIRES_SOON', sev: 'Medium', text: 'Certificate of insurance expires ' + nice(c.coi) + ', within 30 days of takeover.' });
      var g = groups[c.property + '|' + c.service.toLowerCase()];
      if (g.length > 1) {
        var tot = g.reduce(function (s, x) { return s + (x.monthly || 0); }, 0);
        f.push({ code: 'DUPLICATE_SERVICE', sev: 'High', related: g.map(function (x) { return x.id; }),
          text: g.length + ' contracts for ' + c.service + ' at this property (' + g.map(function (x) { return x.id; }).join(', ') + '), ' + money$(tot) + '/month together. Possible double payment.' });
      }
      var med = byService[c.service] && byService[c.service].length >= 3 ? median(byService[c.service]) : null;
      if (med && c.monthly > 2 * med) f.push({ code: 'COST_OUTLIER', sev: 'Medium', text: money$(c.monthly) + '/month is ' + (c.monthly / med).toFixed(1) + '× the portfolio median of ' + money$(med) + ' for ' + c.service + '.' });

      var codes = f.map(function (x) { return x.code; });
      var rec = codes.indexOf('LAPSES_BEFORE_TAKEOVER') >= 0 ? 'Replace or re-sign before takeover'
        : codes.indexOf('DUPLICATE_SERVICE') >= 0 ? 'Confirm which contract is real; cancel the other'
        : codes.indexOf('CANCEL_WINDOW_MISSED') >= 0 ? 'Treat as renewed: confirm renewal term and exit terms'
        : codes.indexOf('NOT_ASSIGNABLE') >= 0 ? 'New agreement needed, or terminate at takeover'
        : codes.indexOf('NOTICE_DUE_SOON') >= 0 ? 'Decide keep or cancel by ' + nice(c.noticeBy)
        : codes.indexOf('COI_EXPIRED') >= 0 ? 'Hold: get a current COI before day one'
        : codes.indexOf('ENDS_SOON_AFTER_TAKEOVER') >= 0 ? 'Plan renewal or replacement'
        : codes.indexOf('COST_OUTLIER') >= 0 ? 'Review pricing'
        : codes.indexOf('COI_EXPIRES_SOON') >= 0 ? 'Keep; request renewed COI'
        : 'Keep: assign to Asset at takeover';
      c.recommendation = rec;
      c.decision = codes.indexOf('LAPSES_BEFORE_TAKEOVER') >= 0 ? 'Replace / re-sign' : codes.indexOf('DUPLICATE_SERVICE') >= 0 ? 'Cancel duplicate'
        : codes.indexOf('CANCEL_WINDOW_MISSED') >= 0 ? 'Locked in' : codes.indexOf('NOT_ASSIGNABLE') >= 0 ? 'New agreement' : codes.indexOf('NOTICE_DUE_SOON') >= 0 ? 'Decide by date'
        : codes.indexOf('COI_EXPIRED') >= 0 ? 'Hold for COI' : codes.indexOf('ENDS_SOON_AFTER_TAKEOVER') >= 0 ? 'Plan renewal' : codes.indexOf('COST_OUTLIER') >= 0 ? 'Review price' : 'Keep';
      if (f.length) {
        var reviewer = taskOf(c.property, /vendor contract/i);
        var primary = f.slice().sort(function (a, b) { return SEV[b.sev] - SEV[a.sev]; })[0].code;
        var to = /LAPSES|CANCEL|NOTICE|DUPLICATE|ENDS_SOON/.test(primary) ? 'Prior manager' : /COI|NOT_ASSIGNABLE/.test(primary) ? 'Vendor' : 'Asset team';
        var dl = codes.indexOf('LAPSES_BEFORE_TAKEOVER') >= 0 ? Math.max(c.termEnd, A)
          : codes.indexOf('CANCEL_WINDOW_MISSED') >= 0 ? c.termEnd
          : codes.indexOf('NOTICE_DUE_SOON') >= 0 ? c.noticeBy : T;
        addItem({ id: 'C-' + c.id, kind: 'Vendor contract', property: c.property, title: c.vendor + ' — ' + c.service + ' (' + c.id + ')',
          reasons: f, action: rec, emailTo: to, assignee: reviewer ? reviewer.owner : '', deadline: dl,
          evidence: [{ tab: m3.tab, row: c.row, id: c.id, fields: { Vendor: c.vendor, Service: c.service, 'Monthly Cost': money$(c.monthly), 'Current Term End': nice(c.termEnd), 'Auto-Renew': c.autoRenew, 'Notice (days)': c.noticeDays, 'Last day to cancel (calculated)': nice(c.noticeBy), 'COI Expiration': nice(c.coi), 'Assignable': c.assignable } }] });
      }
    });

    // coverage gaps for services every community normally needs
    var COVER = [{ name: 'Pest Control', re: /pest/i }, { name: 'Trash / Valet Trash', re: /trash|waste/i }, { name: 'Fire/Life Safety', re: /fire|life ?safety/i }];
    var contractProps = allProps.filter(function (p) { return tasks.some(function (t) { return t.property === p; }) || contracts.some(function (c) { return c.property === p; }); });
    COVER.forEach(function (s) {
      var have = contractProps.filter(function (p) { return contracts.some(function (c) { return c.property === p && s.re.test(c.service); }); });
      var miss = contractProps.filter(function (p) { return have.indexOf(p) < 0; });
      if (miss.length && have.length) addItem({ id: 'GAP-' + normKey(s.name), kind: 'Coverage gap', property: 'Portfolio', title: 'No ' + s.name + ' contract on file at ' + miss.length + ' of ' + contractProps.length + ' properties',
        reasons: [{ code: 'COVERAGE_GAP', sev: 'Medium', text: 'Missing at: ' + miss.join(', ') + '. Owner-direct, left out of the export, or truly uncovered? Ask before day one.' }],
        action: 'Ask the prior manager for the contracts, or confirm owner-direct', emailTo: 'Prior manager', assignee: '', deadline: T,
        evidence: have.map(function (p) { var c = contracts.filter(function (x) { return x.property === p && s.re.test(x.service); })[0]; return { tab: m3.tab, row: c.row, id: c.id, fields: { Property: p, Service: c.service } }; }) });
    });

    // ================= TASK RULES =================
    var DEPENDS = [
      { task: /migrate resident ledgers/i, sev: 'High', why: 'ledgers and deposits cannot be migrated before the final rent roll, the deposit account and the Yardi setup exist', needs: [/final rent roll/i, /deposit bank accounts/i, /set up property in yardi/i] },
      { task: /welcome letter|portal invite/i, sev: 'Medium', why: 'the portal invite needs the property set up in Yardi', needs: [/set up property in yardi/i] }
    ];
    tasks.forEach(function (t) {
      var f = t.flags, open = t.status !== 'Complete', dt = t.due != null ? t.due - A : null;
      if (open && t.due != null && t.due < A) f.push({ code: 'OVERDUE', sev: t.critical ? 'Critical' : 'High', text: 'Due ' + nice(t.due) + ' (' + (A - t.due) + ' days ago); status ' + t.status + '.' });
      if (t.status === 'Blocked') f.push({ code: 'BLOCKED', sev: t.critical ? 'Critical' : 'High', text: 'Blocked' + (t.notes ? ': “' + t.notes + '”' : ' (no reason given).') });
      if (open && !t.owner) f.push({ code: 'NO_OWNER', sev: t.critical ? (dt != null && dt <= 21 ? 'Critical' : 'High') : 'Medium', text: 'No owner assigned' + (t.critical ? ' on a critical-path task.' : '.') });
      if (t.critical && t.status === 'Not Started' && dt != null && dt >= 0 && dt <= 21) f.push({ code: 'NOT_STARTED_SOON', sev: 'High', text: 'Critical path, not started, due in ' + dt + ' days (' + nice(t.due) + ').' });
      if (open && t.updated != null && A - t.updated > 7) f.push({ code: 'STALE', sev: (t.critical && dt != null && dt <= 21) ? 'High' : 'Medium', text: 'No update in ' + (A - t.updated) + ' days (last ' + nice(t.updated) + ').' });
      // cross-checks against the other tabs
      var here = contracts.filter(function (c) { return c.property === t.property; });
      if (/vendor contract/i.test(t.task) && t.status === 'Blocked' && /n[o’']?t sent|hasn.?t sent|not received|no contracts/i.test(t.notes) && here.length)
        f.push({ code: 'STATUS_CONFLICT', sev: 'High', text: 'Says contracts were not sent, but the vendor tab already lists ' + here.length + ' contracts for this property (' + here.map(function (c) { return c.id; }).join(', ') + '). The task status or the vendor tab is out of date.' });
      if (t.status === 'Complete') DEPENDS.forEach(function (d) {
        if (!d.task.test(t.task)) return;
        d.needs.forEach(function (re) { var p = taskOf(t.property, re); if (p && p.status !== 'Complete') f.push({ code: 'DEPENDENCY_CONFLICT', sev: d.sev, related: [p.row], text: 'Marked Complete, but it depends on “' + p.task + '”, which is ' + p.status + ' (row ' + p.row + '); ' + d.why + '. Check whether this is really done.' }); });
      });
      if (/insurance.*coi/i.test(t.task) && t.status === 'Complete') {
        var bad = here.filter(function (c) { return c.coi != null && c.coi < A; });
        if (bad.length) f.push({ code: 'STATUS_CONFLICT', sev: 'High', text: 'Marked Complete, but ' + bad.map(function (c) { return c.id + ' (' + c.vendor + ') COI expired ' + nice(c.coi); }).join('; ') + '.' });
      }
      if (/vendor contract/i.test(t.task) && t.status === 'Complete') {
        var still = here.filter(function (c) { return c.flags.some(function (x) { return SEV[x.sev] >= 2; }); });
        if (still.length) f.push({ code: 'STATUS_CONFLICT', sev: 'Medium', text: 'Vendor review marked Complete, but ' + still.length + ' contract(s) here still have open issues (' + still.map(function (c) { return c.id; }).join(', ') + ').' });
      }
      if (f.length) {
        var to = /prior manager/i.test(t.notes) ? 'Prior manager' : /owner/i.test(t.notes) ? 'Owner' : 'Asset team';
        addItem({ id: 'T-' + t.row, kind: 'Transition task', property: t.property, title: t.task, reasons: f,
          action: t.status === 'Blocked' ? 'Escalate the blocker' : !t.owner ? 'Assign an owner today' : f.some(function (x) { return x.code === 'DEPENDENCY_CONFLICT' || x.code === 'STATUS_CONFLICT'; }) ? 'Verify the status with the owner' : 'Get a start date and a status update',
          emailTo: to, assignee: t.owner, deadline: t.due,
          evidence: [{ tab: m2.tab, row: t.row, id: 'Row ' + t.row, fields: { Task: t.task, Function: t.func, Owner: t.owner || '(none)', 'Critical Path': t.critical ? 'Y' : 'N', 'Due Date': nice(t.due), Status: t.status, 'Last Updated': nice(t.updated), Notes: t.notes } }] });
      }
    });

    // owner capacity (single point of failure)
    var load = {};
    tasks.forEach(function (t) { if (t.status !== 'Complete' && t.owner) { var o = load[t.owner] = load[t.owner] || { owner: t.owner, open: 0, critical: 0, props: {}, funcs: {} }; o.open++; if (t.critical) o.critical++; o.props[t.property] = 1; o.funcs[t.func] = 1; } });
    var loads = Object.keys(load).map(function (k) { var o = load[k]; return { owner: o.owner, open: o.open, critical: o.critical, properties: Object.keys(o.props).length, functions: Object.keys(o.funcs).join(', ') }; })
      .sort(function (a, b) { return b.critical - a.critical || b.open - a.open; });
    var medCrit = median(loads.map(function (l) { return l.critical; }));
    loads.forEach(function (l) {
      if (medCrit != null && l.critical >= Math.max(10, 1.5 * medCrit)) addItem({ id: 'CAP-' + normKey(l.owner), kind: 'Capacity', property: 'Portfolio', title: l.owner + ' owns ' + l.critical + ' open critical-path tasks',
        reasons: [{ code: 'CAPACITY', sev: 'Medium', text: 'The most of anyone (team median is ' + medCrit + '), across ' + l.properties + ' properties (' + l.functions + '). If this person is out, the critical path stalls.' }],
        action: 'Confirm capacity or rebalance', emailTo: 'Asset team', assignee: l.owner, deadline: null,
        evidence: tasks.filter(function (t) { return t.owner === l.owner && t.status !== 'Complete' && t.critical; }).map(function (t) { return { tab: m2.tab, row: t.row, id: 'Row ' + t.row, fields: { Property: t.property, Task: t.task, 'Due Date': nice(t.due), Status: t.status } }; }) });
    });

    // ================= RENT ROLL RULES =================
    var byUnit = {};
    units.forEach(function (u) { var k = u.property + '|' + u.key; (byUnit[k] = byUnit[k] || []).push(u); });
    var fpMode = {};
    units.forEach(function (u) { var k = u.property + '|' + u.floorplan; var m = fpMode[k] = fpMode[k] || { sqft: {}, beds: {} }; if (u.sqft > 0) m.sqft[u.sqft] = (m.sqft[u.sqft] || 0) + 1; if (u.beds != null) m.beds[u.beds] = (m.beds[u.beds] || 0) + 1; });
    function mode(o) { var b = null, n = 0; Object.keys(o).forEach(function (k) { if (o[k] > n) { n = o[k]; b = +k; } }); return b; }
    units.forEach(function (u) {
      var f = u.flags, occ = u.status === 'Occupied' || u.status === 'Notice';
      if (!u.status) f.push({ code: 'UNMAPPED_STATUS', sev: 'High', text: 'Unit status “' + u.statusRaw + '” is not a known code.' });
      if (u.badParse) f.push({ code: 'UNPARSED_VALUE', sev: 'High', text: 'A date or money value could not be read.' });
      var dup = byUnit[u.property + '|' + u.key];
      if (dup.length > 1) f.push({ code: 'DUPLICATE_UNIT', sev: 'High', text: 'Unit appears ' + dup.length + ' times (rows ' + dup.map(function (x) { return x.row; }).join(', ') + '): ' + dup.map(function (x) { return (x.resident || '(no name)') + ', ' + money$(x.rent) + ' rent, ' + money$(x.balance) + ' balance'; }).join(' / ') + '. Roommates on one lease, or a double entry?' });
      if (u.start != null && u.end != null && u.start > u.end) f.push({ code: 'START_AFTER_END', sev: 'High', text: 'Lease start ' + nice(u.start) + ' is after lease end ' + nice(u.end) + '.' });
      if (u.status === 'Notice' && (!u.resident || u.end == null || !u.rent)) f.push({ code: 'NOTICE_NO_DATA', sev: 'High', text: 'On notice, but ' + [!u.resident && 'no resident', u.end == null && 'no lease dates', !u.rent && money$(u.rent || 0) + ' rent'].filter(Boolean).join(', ') + '. Is it actually vacant?' });
      if (u.status === 'Occupied' && !u.resident) f.push({ code: 'OCC_NO_NAME', sev: 'High', text: 'Occupied, but no resident name.' });
      if (u.status === 'Occupied' && (u.start == null || u.end == null)) f.push({ code: 'OCC_NO_LEASE', sev: 'High', text: 'Occupied, but lease dates are missing.' });
      if (u.status === 'Occupied' && u.rent === 0) f.push({ code: 'ZERO_RENT', sev: 'High', text: 'Occupied at $0 rent.' });
      if (occ && u.end != null && u.end < A) f.push({ code: 'LEASE_ENDED', sev: 'Medium', text: 'Lease ended ' + nice(u.end) + '. Month-to-month, renewed but not updated, or a stale export?' });
      if (u.status === 'Occupied' && u.rent > 0 && u.market > 0 && u.rent < 0.6 * u.market) f.push({ code: 'LOW_RENT', sev: 'Medium', text: 'Rent ' + money$(u.rent) + ' is ' + Math.round(100 * u.rent / u.market) + '% of market (' + money$(u.market) + ')' + (u.notes ? '. Note: “' + u.notes + '”' : '') + '. Staff unit, concession, or roommate split?' });
      var m = fpMode[u.property + '|' + u.floorplan], ms = mode(m.sqft), mb = mode(m.beds);
      if ((ms != null && u.sqft !== ms) || (mb != null && u.beds !== mb)) f.push({ code: 'SIZE_MISMATCH', sev: 'Medium', text: 'Sq ft ' + u.sqft + ', beds ' + u.beds + '; other ' + u.floorplan + ' units here are ' + ms + ' sq ft, ' + mb + ' beds.' });
      if (u.balance > 0 && u.rent > 0 && u.balance > u.rent) f.push({ code: 'HIGH_BALANCE', sev: 'Medium', text: 'Owes ' + money$(u.balance) + ', more than one month’s rent (' + money$(u.rent) + ').' });
      if (u.status === 'Occupied' && u.deposit === 0) f.push({ code: 'NO_DEPOSIT', sev: 'Medium', text: 'Occupied with a $0 security deposit.' });
      u.needsHuman = f.some(function (x) { return SEV[x.sev] >= 2; });
    });
    // queue: High unit issues one item per unit (duplicates grouped); Medium issues grouped per property
    var doneDup = {};
    units.forEach(function (u) {
      var hi = u.flags.filter(function (x) { return SEV[x.sev] >= 2; });
      if (!hi.length) return;
      var dup = byUnit[u.property + '|' + u.key];
      if (dup.length > 1) { var k = u.property + '|' + u.key; if (doneDup[k]) return; doneDup[k] = 1; }
      var rows = dup.length > 1 ? dup : [u];
      var reasons = [];
      rows.forEach(function (x) { x.flags.forEach(function (fl) { if (SEV[fl.sev] >= 2 && !reasons.some(function (r) { return r.text === fl.text; })) reasons.push(fl); }); });
      addItem({ id: 'U-' + normKey(u.property) + '-' + normKey(u.key), kind: 'Rent roll', property: u.property, title: 'Unit ' + u.unit + (u.resident ? ' — ' + u.resident : ''),
        reasons: reasons, action: 'Confirm with the prior manager before loading into Yardi', emailTo: 'Prior manager', assignee: (taskOf(u.property, /final rent roll/i) || {}).owner || '',
        deadline: (taskOf(u.property, /final rent roll/i) || {}).due || T,
        evidence: rows.map(function (x) { return { tab: m1.tab, row: x.row, id: x.unit, fields: { Unit: x.unit, Status: x.statusRaw + ' → ' + (x.status || '?'), Resident: x.resident || '(blank)', 'Market Rent': money$(x.market), 'Lease Rent': money$(x.rent), 'Lease Start': nice(x.start), 'Lease End': nice(x.end), Deposit: money$(x.deposit), Balance: money$(x.balance) } }; }) });
    });
    var GROUPED = { LEASE_ENDED: 'occupied units show a lease end date before the as-of date', LOW_RENT: 'occupied units rent below 60% of market', HIGH_BALANCE: 'residents owe more than a month’s rent', SIZE_MISMATCH: 'units have a size that doesn’t match their floorplan', NO_DEPOSIT: 'occupied units have no deposit' };
    Object.keys(GROUPED).forEach(function (code) {
      var props = {};
      units.forEach(function (u) { if (u.flags.some(function (x) { return x.code === code; })) (props[u.property] = props[u.property] || []).push(u); });
      Object.keys(props).forEach(function (p) {
        var L = props[p], extra = code === 'HIGH_BALANCE' ? ' (' + money$(Math.round(100 * L.reduce(function (s, u) { return s + u.balance; }, 0)) / 100) + ' total)' : '';
        addItem({ id: 'G-' + code + '-' + normKey(p), kind: 'Rent roll', property: p, title: L.length + ' ' + GROUPED[code] + extra,
          reasons: [{ code: code, sev: 'Medium', text: code === 'LEASE_ENDED' ? 'That is ' + Math.round(100 * L.length / units.filter(function (u) { return u.property === p && u.status === 'Occupied'; }).length) + '% of occupied units. Ask the prior manager whether these are month-to-month, and at what rent and fee. This changes revenue and the renewal workload from day one.' : L[0].flags.filter(function (x) { return x.code === code; })[0].text + (L.length > 1 ? ' (first of ' + L.length + ')' : '') }],
          action: code === 'LEASE_ENDED' ? 'Ask for lease status and month-to-month terms' : code === 'HIGH_BALANCE' ? 'Get the aged delinquency report before cutover' : 'Confirm with the prior manager',
          emailTo: 'Prior manager', assignee: (taskOf(p, /final rent roll/i) || {}).owner || '', deadline: (taskOf(p, /final rent roll/i) || {}).due || T,
          evidence: L.map(function (u) { return { tab: m1.tab, row: u.row, id: u.unit, fields: { Unit: u.unit, Resident: u.resident || '(blank)', 'Lease End': nice(u.end), 'Lease Rent': money$(u.rent), 'Market Rent': money$(u.market), Balance: money$(u.balance), 'Sq Ft': u.sqft } }; }) });
      });
    });
    // properties with no rent roll
    var rrProps = {}; units.forEach(function (u) { rrProps[u.property] = 1; });
    var noRR = contractProps.filter(function (p) { return !rrProps[p]; });
    if (noRR.length) {
      var rrTask = taskOf(noRR[0], /final rent roll/i);
      addItem({ id: 'RR-MISSING', kind: 'Missing data', property: 'Portfolio', title: 'Rent rolls received for ' + (contractProps.length - noRR.length) + ' of ' + contractProps.length + ' properties',
        reasons: [{ code: 'MISSING_RENT_ROLL', sev: 'High', text: 'Nothing yet for: ' + noRR.join(', ') + '. Every check on this page is blind for those properties until the export arrives.' }],
        action: 'Request the remaining rent roll exports', emailTo: 'Prior manager', assignee: rrTask ? rrTask.owner : '', deadline: rrTask ? rrTask.due : T,
        evidence: noRR.map(function (p) { var t = taskOf(p, /final rent roll/i); return t ? { tab: m2.tab, row: t.row, id: 'Row ' + t.row, fields: { Property: p, Task: t.task, Status: t.status, 'Due Date': nice(t.due) } } : { tab: m2.tab, row: null, id: p, fields: { Property: p } }; }) });
    }

    // ================= PROPERTIES =================
    model.properties = contractProps.map(function (p) {
      var T2 = tasks.filter(function (t) { return t.property === p; }), C2 = contracts.filter(function (c) { return c.property === p; }), U2 = units.filter(function (u) { return u.property === p; });
      var I2 = items.filter(function (i) { return i.property === p; });
      var crit = T2.filter(function (t) { return t.critical; });
      var sev = { Critical: 0, High: 0, Medium: 0 }; I2.forEach(function (i) { sev[i.severity]++; });
      return { property: p, market: (T2[0] || {}).market || '', tasks: T2.length, done: T2.filter(function (t) { return t.status === 'Complete'; }).length,
        critTotal: crit.length, critDone: crit.filter(function (t) { return t.status === 'Complete'; }).length,
        blocked: T2.filter(function (t) { return t.status === 'Blocked'; }).length, contracts: C2.length, monthly: C2.reduce(function (s, c) { return s + (c.monthly || 0); }, 0),
        rentRoll: U2.length > 0, units: U2.length, occupied: U2.filter(function (u) { return u.status === 'Occupied' || u.status === 'Notice'; }).length,
        sev: sev, light: sev.Critical ? 'red' : sev.High ? 'amber' : 'green' };
    });

    items.sort(function (a, b) { return SEV[b.severity] - SEV[a.severity] || (a.deadline == null) - (b.deadline == null) || (a.deadline || 0) - (b.deadline || 0) || a.property.localeCompare(b.property) || a.id.localeCompare(b.id); });
    model.units = units; model.tasks = tasks; model.contracts = contracts; model.items = items; model.loads = loads; model.allProperties = contractProps;

    // ================= STATS (used by tiles and the Self-Test) =================
    function cnt(L, code) { return L.filter(function (x) { return x.flags.some(function (f) { return f.code === code; }); }).length; }
    var st = model.stats;
    st.units = units.length; st.unitsByProperty = {}; units.forEach(function (u) { st.unitsByProperty[u.property] = (st.unitsByProperty[u.property] || 0) + 1; });
    st.rawStatusCount = Object.keys(rawStatus).length; st.status = {}; units.forEach(function (u) { st.status[u.status || 'Unmapped'] = (st.status[u.status || 'Unmapped'] || 0) + 1; });
    st.dupUnits = Object.keys(byUnit).filter(function (k) { return byUnit[k].length > 1; }).length;
    ['LEASE_ENDED', 'START_AFTER_END', 'NOTICE_NO_DATA', 'OCC_NO_NAME', 'LOW_RENT', 'SIZE_MISMATCH', 'HIGH_BALANCE', 'ZERO_RENT'].forEach(function (c) { st[c] = cnt(units, c); });
    st.balanceCount = units.filter(function (u) { return u.balance > 0; }).length;
    st.balanceTotal = Math.round(100 * units.reduce(function (s, u) { return s + (u.balance > 0 ? u.balance : 0); }, 0)) / 100;
    st.deposits = units.reduce(function (s, u) { return s + (u.deposit || 0); }, 0);
    st.unitsNeedingHuman = units.filter(function (u) { return u.needsHuman; }).length;
    st.occupancy = units.length ? units.filter(function (u) { return u.status === 'Occupied' || u.status === 'Notice'; }).length / units.length : null;
    st.rentRollProperties = Object.keys(rrProps).length; st.missingRentRolls = noRR.length;
    st.tasks = tasks.length; st.taskStatus = {}; tasks.forEach(function (t) { st.taskStatus[t.status] = (st.taskStatus[t.status] || 0) + 1; });
    st.critical = tasks.filter(function (t) { return t.critical; }).length;
    st.critNotStarted = tasks.filter(function (t) { return t.critical && t.status === 'Not Started'; }).length;
    ['OVERDUE', 'BLOCKED', 'NO_OWNER', 'NOT_STARTED_SOON', 'STALE', 'DEPENDENCY_CONFLICT'].forEach(function (c) { st[c] = cnt(tasks, c); });
    st.statusConflicts = tasks.filter(function (t) { return t.flags.some(function (f) { return f.code === 'STATUS_CONFLICT' && f.sev === 'High'; }); }).length;
    st.contracts = contracts.length; st.monthly = contracts.reduce(function (s, c) { return s + (c.monthly || 0); }, 0);
    ['LAPSES_BEFORE_TAKEOVER', 'CANCEL_WINDOW_MISSED', 'NOT_ASSIGNABLE', 'COI_EXPIRED', 'DUPLICATE_SERVICE', 'COST_OUTLIER', 'NOTICE_DUE_SOON'].forEach(function (c) { st[c] = cnt(contracts, c); });
    st.lifeSafetyLapses = contracts.filter(function (c) { return c.flags.some(function (f) { return f.code === 'LAPSES_BEFORE_TAKEOVER' && f.sev === 'Critical'; }); }).length;
    st.lockedMonthly = contracts.filter(function (c) { return c.flags.some(function (f) { return f.code === 'CANCEL_WINDOW_MISSED'; }); }).reduce(function (s, c) { return s + (c.monthly || 0); }, 0);
    st.dupMonthly = contracts.filter(function (c) { return c.flags.some(function (f) { return f.code === 'DUPLICATE_SERVICE'; }); }).reduce(function (s, c) { return s + (c.monthly || 0); }, 0);
    st.items = { total: items.length, Critical: 0, High: 0, Medium: 0 }; items.forEach(function (i) { st.items[i.severity]++; });
    return model;
  }

  // ---------- Monday-morning view helpers (display only; they never change a finding) ----------
  function primaryReason(it) { return it.reasons.slice().sort(function (a, b) { return SEV[b.sev] - SEV[a.sev]; })[0]; }
  /* "Act now" = every critical item, plus high items whose deadline is within 21 days of the as-of date. */
  function actNow(it, asOf) { return it.severity === 'Critical' || (it.severity === 'High' && it.deadline != null && it.deadline - asOf <= 21); }
  /* Group only items that share the same kind, the same task (for checklist items), the same main reason AND the same severity.
     An unowned or blocked task never hides inside a "not started" group. */
  function groupItems(items) {
    var out = [], idx = {};
    items.forEach(function (it) {
      var p = primaryReason(it);
      var groupable = it.kind === 'Transition task' || it.kind === 'Vendor contract' || (it.kind === 'Rent roll' && it.id.indexOf('U-') === 0);
      var key = groupable ? [it.kind, it.kind === 'Transition task' ? it.title : '', p.code, it.severity].join('|') : null;
      if (key && idx[key] != null) out[idx[key]].items.push(it);
      else { if (key) idx[key] = out.length; out.push({ key: key || it.id, items: [it] }); }
    });
    return out.map(function (g) {
      if (g.items.length === 1) return { group: false, item: g.items[0] };
      var dl = g.items.map(function (i) { return i.deadline; }).filter(function (d) { return d != null; });
      return { group: true, key: g.key, items: g.items, severity: g.items[0].severity, kind: g.items[0].kind, title: g.items[0].title, code: primaryReason(g.items[0]).code, deadline: dl.length ? Math.min.apply(null, dl) : null };
    });
  }
  /* "Start here" = the first n open critical items in queue order (critical first, earliest deadline first). */
  function startHere(items, isOpen, n) { return items.filter(function (i) { return i.severity === 'Critical' && isOpen(i); }).slice(0, n || 3); }

  var Engine = { analyze: analyze, primaryReason: primaryReason, actNow: actNow, groupItems: groupItems, startHere: startHere, parseDate: parseDate, parseMoney: parseMoney, normStatus: normStatus, unitKey: unitKey, iso: iso, nice: nice, parseISOInput: parseISOInput, money: money$, SEV: SEV };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else root.Engine = Engine;
})(this);
