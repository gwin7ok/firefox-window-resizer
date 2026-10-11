// 履歴サイドバー（views/history-sidebar.js）の取得・ページング・開閉状態を、最小限の DOM スタブで検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// ---- 最小限の DOM スタブ ----
class El {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.listeners = {}; this.attrs = {};
    this.className = ''; this.textContent = ''; this.hidden = false; this.open = false; this.value = '';
    this.classList = { contains: () => false, add() {}, remove() {} };
  }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  set innerHTML(_v) { this.children = []; }
  get innerHTML() { return ''; }
  fire(t, ev = {}) { return Promise.all((this.listeners[t] || []).map((fn) => fn(ev))); }
  remove() {}
  find(pred, out = []) { if (pred(this)) out.push(this); this.children.forEach((c) => c.find(pred, out)); return out; }
}

function makeEnv() {
  const els = {};
  ['search-input', 'history-list', 'history-status', 'history-more'].forEach((id) => { els[id] = new El(id); });
  els['history-more'].hidden = true;
  const docListeners = {};
  const calls = [];
  const document = {
    getElementById: (id) => els[id],
    createElement: (t) => new El(t),
    createTextNode: (t) => { const e = new El('#text'); e.textContent = t; return e; },
    addEventListener: (t, fn) => { docListeners[t] = fn; },
    body: new El('body'),
  };
  const now = Date.now();
  const mk = (i) => ({ id: String(i), url: `https://e.example/${i}`, title: `T${i}`, lastVisitTime: now - i * 60 * 1000 });
  // 新しい順の履歴（今日 + 古い日付）
  const all = [];
  for (let i = 0; i < 100; i++) all.push(mk(i));                       // 今日（直近約100分。日付をまたぐ場合あり）
  for (let i = 0; i < 40; i++) all.push({ id: 'old' + i, url: 'https://o.example/' + i, title: 'O' + i,
    lastVisitTime: now - (3 + Math.floor(i / 10)) * 24 * 3600 * 1000 - i * 1000 });
  const browser = {
    history: { search: async (q) => {
      calls.push(JSON.parse(JSON.stringify(q)));
      let r = all.filter((x) => (!q.endTime || x.lastVisitTime < q.endTime) && (!q.text || x.title.includes(q.text)));
      r = r.sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, q.maxResults);
      return r;
    } },
    storage: { local: { get: async () => ({ presets: [] }) } },
    windows: { getCurrent: async () => ({ id: 1 }) },
    runtime: { sendMessage: async () => {} },
  };
  const sandbox = { document, window: { addEventListener() {}, innerWidth: 400, innerHeight: 600 }, browser,
    Logger: { error: async () => {}, info: async () => {} }, console, setTimeout, clearTimeout, Date, Math, Set, Map, Promise };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'views', 'history-groups.js'), 'utf8')
    .replace(/typeof self !== 'undefined' \? self : this/, 'globalThis'), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'views', 'history-sidebar.js'), 'utf8'), sandbox);
  return { els, docListeners, calls, sandbox, now, all };
}

const groupsOf = (els) => els['history-list'].children.map((li) => li.children[0]);
const itemCount = (details) => details.children[1].children.length;
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

(async () => {
  const env = makeEnv();
  await env.docListeners.DOMContentLoaded();

  // 初回: 1ページ分（100件）。今日のグループだけ開く。続きがあるので「さらに読み込む」を表示
  let groups = groupsOf(env.els);
  assert.ok(groups.length >= 1);
  assert.strictEqual(env.calls[0].maxResults, 100);
  assert.strictEqual(env.calls[0].endTime, undefined);
  assert.strictEqual(groups[0].open, true, 'newest group (today) is open');
  assert.ok(groups.slice(1).every((g) => g.open === false), 'other days are collapsed');
  assert.strictEqual(groups.reduce((s, g) => s + itemCount(g), 0), 100);
  assert.strictEqual(env.els['history-more'].hidden, false);
  ok('first page: 100 items grouped by date, today open, "load more" visible');

  // 「さらに読み込む」: 直前ページの最古の時刻より前を取得して追加
  const oldest = Math.min(...env.all.slice(0, 100).map((x) => x.lastVisitTime));
  await env.els['history-more'].fire('click');
  assert.strictEqual(env.calls[1].endTime, oldest);
  groups = groupsOf(env.els);
  assert.strictEqual(groups.reduce((s, g) => s + itemCount(g), 0), 140);
  assert.strictEqual(env.els['history-more'].hidden, true, 'no more pages (page not full)');
  const olderGroups = groups.filter((g) => g.open === false);
  assert.ok(olderGroups.length >= 1, 'older days are collapsed by default');
  ok('load more: appends older items using endTime, hides button when exhausted');

  // 検索中は全グループを開く
  env.els['search-input'].value = 'O';
  await env.els['search-input'].fire('input');
  await new Promise((r) => setTimeout(r, 400));
  groups = groupsOf(env.els);
  assert.ok(groups.length >= 1 && groups.every((g) => g.open === true));
  assert.strictEqual(env.calls[env.calls.length - 1].text, 'O');
  ok('search: all groups open');

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
