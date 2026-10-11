// 履歴サイドバー（views/history-sidebar.js）の取得・ページング・開閉状態を、最小限の DOM スタブで検証する。
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// ---- 最小限の DOM スタブ ----
class El {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.listeners = {}; this.className = '';
    this.textContent = ''; this.hidden = false; this.open = false; this.value = ''; this.disabled = false;
    this.classList = { contains: () => false, add() {}, remove() {} };
  }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  set innerHTML(_v) { this.children = []; }
  get innerHTML() { return ''; }
  fire(t, ev = {}) { return Promise.all((this.listeners[t] || []).map((fn) => fn(ev))); }
  remove() {}
}

// options.maxPerCall: Firefox が maxResults 未満しか返さない状況を再現する
function makeEnv(options = {}) {
  const maxPerCall = options.maxPerCall || Infinity;
  const els = {};
  ['search-input', 'history-list', 'history-status', 'history-more', 'history-all', 'history-more-row']
    .forEach((id) => { els[id] = new El(id); });
  els['history-more-row'].hidden = true;
  els['history-all'].textContent = 'すべて読み込む';
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
  const all = [];
  for (let i = 0; i < 100; i++) {
    all.push({ id: String(i), url: `https://e.example/${i}`, title: `T${i}`, lastVisitTime: now - i * 60 * 1000 });
  }
  for (let i = 0; i < 250; i++) {
    all.push({ id: 'old' + i, url: 'https://o.example/' + i, title: 'O' + i,
      lastVisitTime: now - (3 + Math.floor(i / 25)) * 24 * 3600 * 1000 - i * 1000 });
  }
  const browser = {
    history: { search: async (q) => {
      calls.push(JSON.parse(JSON.stringify(q)));
      return all
        .filter((x) => (!q.endTime || x.lastVisitTime < q.endTime) && (!q.text || x.title.includes(q.text)))
        .sort((a, b) => b.lastVisitTime - a.lastVisitTime)
        .slice(0, Math.min(q.maxResults, maxPerCall));
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
// 見出し（summary）の件数表示から件数を得る（項目は開いたときに初めて描画される）
const itemCount = (details) => parseInt(details.children[0].children[1].textContent, 10);
const renderedItems = (details) => details.children[1].children.length;
const totalCount = (els) => groupsOf(els).reduce((s, g) => s + itemCount(g), 0);
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

(async () => {
  // 1. 初回表示
  {
    const env = makeEnv();
    await env.docListeners.DOMContentLoaded();
    const groups = groupsOf(env.els);
    assert.strictEqual(env.calls[0].maxResults, 100);
    assert.strictEqual(env.calls[0].endTime, undefined);
    assert.strictEqual(totalCount(env.els), 100);
    assert.strictEqual(groups[0].open, true, 'newest group (today) is open');
    assert.ok(groups.slice(1).every((g) => g.open === false), 'other days are collapsed');
    assert.strictEqual(renderedItems(groups[0]), itemCount(groups[0]), 'open group is rendered');
    assert.strictEqual(env.els['history-more-row'].hidden, false);
    ok('first page: 100 items by date, today open, load buttons visible');
  }

  // 2. 「さらに読み込む」: endTime で続きを取得。続きがなくなるまでボタンを残す
  {
    const env = makeEnv();
    await env.docListeners.DOMContentLoaded();
    const oldest = Math.min(...env.all.slice(0, 100).map((x) => x.lastVisitTime));
    await env.els['history-more'].fire('click');
    assert.strictEqual(env.calls[1].endTime, oldest);
    assert.strictEqual(totalCount(env.els), 200);
    await env.els['history-more'].fire('click');
    assert.strictEqual(totalCount(env.els), 300);
    await env.els['history-more'].fire('click');
    assert.strictEqual(totalCount(env.els), 350);
    assert.strictEqual(env.els['history-more-row'].hidden, false, 'a short page does not end paging');
    await env.els['history-more'].fire('click');
    assert.strictEqual(totalCount(env.els), 350);
    assert.strictEqual(env.els['history-more-row'].hidden, true, 'hidden once a request adds nothing');
    ok('load more: pages via endTime until a request returns nothing new');
  }

  // 3. Firefox が maxResults 未満しか返さなくても、最後まで読み込める（397件で止まる不具合の再現）
  {
    const env = makeEnv({ maxPerCall: 60 });
    await env.docListeners.DOMContentLoaded();
    assert.strictEqual(totalCount(env.els), 60);
    assert.strictEqual(env.els['history-more-row'].hidden, false);
    await env.els['history-all'].fire('click');
    assert.strictEqual(totalCount(env.els), 350, 'all history loaded');
    assert.strictEqual(env.els['history-more-row'].hidden, true);
    assert.strictEqual(env.els['history-all'].textContent, 'すべて読み込む', 'button label restored');
    assert.strictEqual(env.els['history-more'].disabled, false);
    ok('load all: reaches the end even when each page is shorter than maxResults');
  }

  // 4. 古い日付のグループは閉じていて、開いたときに初めて項目を描画する（軽量化）
  {
    const env = makeEnv();
    await env.docListeners.DOMContentLoaded();
    await env.els['history-all'].fire('click');
    const closed = groupsOf(env.els).filter((g) => g.open === false);
    assert.ok(closed.length >= 1);
    assert.ok(closed.every((g) => renderedItems(g) === 0), 'closed groups are not rendered');
    const target = closed[0];
    target.open = true;
    await target.fire('toggle');
    assert.strictEqual(renderedItems(target), itemCount(target), 'rendered on first open');
    ok('lazy rendering: closed groups render their items when first opened');
  }

  // 5. 「すべて読み込む」は途中で中止できる
  {
    const env = makeEnv({ maxPerCall: 10 });
    await env.docListeners.DOMContentLoaded();
    const running = env.els['history-all'].fire('click');
    await env.els['history-all'].fire('click'); // 実行中にもう一度押す = 中止
    await running;
    assert.ok(totalCount(env.els) < 350, 'stopped before loading everything');
    assert.strictEqual(env.els['history-all'].textContent, 'すべて読み込む');
    assert.strictEqual(env.els['history-more-row'].hidden, false, 'can continue after cancel');
    ok('load all: can be cancelled and resumed');
  }

  // 6. 検索中は全グループを開く
  {
    const env = makeEnv();
    await env.docListeners.DOMContentLoaded();
    env.els['search-input'].value = 'O';
    await env.els['search-input'].fire('input');
    await new Promise((r) => setTimeout(r, 400));
    const groups = groupsOf(env.els);
    assert.ok(groups.length >= 1 && groups.every((g) => g.open === true));
    assert.strictEqual(env.calls[env.calls.length - 1].text, 'O');
    ok('search: all groups open');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
