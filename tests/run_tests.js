// Run: node tests/run_tests.js [path/to/data-pack.xlsx]
// Reads the workbook the same way the browser does (SheetJS, raw values, dates as Excel serials),
// runs the engine at the README dates, and checks every result against the independently counted answer key.
const fs = require('fs'), path = require('path');
const XLSX = require('xlsx');
const Engine = require('../app/engine.js');
const { unitTests, packTests } = require('../app/selftest.js');

const file = process.argv[2] || path.join(__dirname, '..', 'data', 'Asset_Living_Build_Exercise_Data_Pack.xlsx');
const wb = XLSX.read(fs.readFileSync(file), { type: 'buffer', cellDates: false });
const sheets = {};
wb.SheetNames.forEach(n => { sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null, raw: true }); });
const model = Engine.analyze(sheets, { asOf: '2026-10-16', takeover: '2026-12-01' });
if (model.meta.errors.length) { console.error('Load errors:', model.meta.errors); process.exit(1); }

const results = unitTests(Engine).concat(packTests(model, Engine));
const fail = results.filter(r => !r.pass);
const lines = ['# Test results', '', `Run: ${new Date().toISOString()} · Node ${process.version} · workbook: ${path.basename(file)}`, `As-of 2026-10-16, takeover 2026-12-01`, '',
  `**${results.length - fail.length} of ${results.length} passed.**`, '', '| Group | Check | Expected | Actual | Result |', '|---|---|---|---|---|'];
results.forEach(r => lines.push(`| ${r.group} | ${r.name} | ${JSON.stringify(r.expected)} | ${JSON.stringify(r.actual)} | ${r.pass ? 'PASS' : '**FAIL**'} |`));
lines.push('', `Action queue at the README dates: ${model.stats.items.total} items (Critical ${model.stats.items.Critical}, High ${model.stats.items.High}, Medium ${model.stats.items.Medium}).`);
fs.writeFileSync(path.join(__dirname, '..', 'TEST_RESULTS.md'), lines.join('\n') + '\n');
results.forEach(r => console.log((r.pass ? 'PASS ' : 'FAIL ') + r.group + ' | ' + r.name + (r.pass ? '' : ` | expected ${JSON.stringify(r.expected)} got ${JSON.stringify(r.actual)}`)));
console.log(`\n${results.length - fail.length}/${results.length} passed. Queue: ${JSON.stringify(model.stats.items)}`);
process.exit(fail.length ? 1 : 0);
