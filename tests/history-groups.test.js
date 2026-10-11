// 履歴の日付グループ化（views/history-groups.js）の検証。ローカルタイムゾーン基準で TZ に依存しない。
const assert = require('assert');
const path = require('path');
const G = require(path.join(__dirname, '..', 'views', 'history-groups.js'));

const at = (y, m, d, h = 0, mi = 0) => new Date(y, m - 1, d, h, mi).getTime();
let n = 0;
const ok = (name) => { n++; console.log('PASS', name); };

// dateKey: ローカル日付で判定する（深夜0時をまたぐ境界）
assert.strictEqual(G.dateKey(at(2026, 10, 11, 0, 0)), '2026-10-11');
assert.strictEqual(G.dateKey(at(2026, 10, 11, 23, 59)), '2026-10-11');
assert.strictEqual(G.dateKey(at(2026, 10, 12, 0, 0)), '2026-10-12');
assert.strictEqual(G.dateKey(0), 'unknown');
assert.strictEqual(G.dateKey(undefined), 'unknown');
ok('dateKey uses local calendar date, unknown for missing time');

// groupByDate: 日付・項目とも新しい順、日時不明は最後
const items = [
  { id: '1', lastVisitTime: at(2026, 10, 10, 9, 0) },
  { id: '2', lastVisitTime: at(2026, 10, 11, 18, 40) },
  { id: '3', lastVisitTime: at(2026, 10, 11, 8, 5) },
  { id: '4' },
  { id: '5', lastVisitTime: at(2026, 10, 9, 23, 59) },
];
const groups = G.groupByDate(items);
assert.deepStrictEqual(groups.map((g) => g.key), ['2026-10-11', '2026-10-10', '2026-10-09', 'unknown']);
assert.deepStrictEqual(groups[0].items.map((i) => i.id), ['2', '3']);
assert.deepStrictEqual(groups[3].items.map((i) => i.id), ['4']);
ok('groupByDate: newest first for days and items, unknown last');

// 入力配列を破壊しない
assert.deepStrictEqual(items.map((i) => i.id), ['1', '2', '3', '4', '5']);
ok('groupByDate does not mutate its input');

// groupLabel
const now = at(2026, 10, 11, 12, 0);
assert.strictEqual(G.groupLabel('2026-10-11', now), '今日 (2026/10/11)');
assert.strictEqual(G.groupLabel('2026-10-10', now), '昨日 (2026/10/10)');
assert.strictEqual(G.groupLabel('2026-10-09', now), '2026/10/09 (金)');
assert.strictEqual(G.groupLabel('unknown', now), '日時不明');
// 月またぎの「昨日」
assert.strictEqual(G.groupLabel('2026-09-30', at(2026, 10, 1, 1, 0)), '昨日 (2026/09/30)');
ok('groupLabel: today / yesterday (incl. month boundary) / weekday / unknown');

// formatTime
assert.strictEqual(G.formatTime(at(2026, 10, 11, 8, 5)), '08:05');
assert.strictEqual(G.formatTime(at(2026, 10, 11, 18, 40)), '18:40');
assert.strictEqual(G.formatTime(undefined), '');
ok('formatTime: HH:mm');

console.log(`\n${n} tests passed`);
