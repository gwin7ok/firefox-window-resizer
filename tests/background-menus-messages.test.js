// background.js を browser API のモックで読み込み、挙動を検証する（Node 標準機能のみ）。
// 実行: node tests/run.js
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path');
const SRC = path.join(__dirname, '..', 'scripts', 'background.js');
const plain = (x) => JSON.parse(JSON.stringify(x));

function makeEnv(initialStorage) {
  const store = JSON.parse(JSON.stringify(initialStorage));
  const calls = { windowsUpdate: [], windowsCreate: [], tabsCreate: [], tabsDuplicate: [], tabsMove: [], menus: [] };
  const L = {};
  const ev = (n) => ({ addListener: (fn) => { L[n] = fn; } });
  const logger = new Proxy({}, { get: (_, k) => k.startsWith('log') ? async (_n, fn) => fn() : async () => {} });
  let nextTab = 100;
  const browser = {
    storage: { local: {
      get: async (keys) => { const arr = Array.isArray(keys) ? keys : [keys]; const o = {}; arr.forEach(k => { if (k in store) o[k] = store[k]; }); return o; },
      set: async (o) => Object.assign(store, plain(o)) }, onChanged: ev('storage') },
    runtime: { onStartup: ev('startup'), onInstalled: ev('installed'), onMessage: ev('message'), getURL: (p) => 'x/' + p },
    contextMenus: { removeAll: async () => { calls.menus = []; }, create: (o) => { calls.menus.push(plain(o)); }, onClicked: ev('menuClick') },
    browserAction: { setIcon: async () => {} },
    bookmarks: { get: async (id) => [{ id, url: 'https://example.com/bm' }] },
    windows: {
      getAll: async () => [{ id: 1 }],
      getLastFocused: async () => ({ id: 1 }),
      getCurrent: async () => ({ id: 999 }),
      update: async (id, v) => { calls.windowsUpdate.push([id, plain(v)]); return { id, ...v }; },
      create: async (v) => { calls.windowsCreate.push(plain(v)); return { id: 50, left: v.left, top: v.top, width: v.width, height: v.height }; }
    },
    tabs: {
      get: async (id) => ({ id, title: 't' + id, url: 'https://e.com', windowId: 1 }),
      query: async (q) => (q.windowId === 50 ? [{ id: 11, url: 'about:blank', windowId: 50 }] : [{ id: 5, title: 'a', windowId: q.windowId }]),
      create: async (o) => { calls.tabsCreate.push(plain(o)); return { id: nextTab++, windowId: o.windowId }; },
      duplicate: async (id) => { calls.tabsDuplicate.push(id); return { id: nextTab++, windowId: 1 }; },
      move: async (id, o) => { calls.tabsMove.push([id, plain(o)]); return [{ id, windowId: o.windowId }]; },
      remove: async () => {}, update: async () => ({}), sendMessage: async () => {}
    }
  };
  const sandbox = { browser, Logger: logger, console, setTimeout, clearTimeout, Promise };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'background.js' });
  return { store, calls, L };
}
const presets = [
  { id: 'preset-A', name: 'A', width: 800, height: 600, left: 1, top: 2 },
  { id: 'preset-B', name: 'B', width: 1000, height: 700, left: 3, top: 4 },
];
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

(async () => {
  // A3: menu ids carry the preset id
  {
    const env = makeEnv({ presets });
    await env.L.installed({ reason: 'install' });
    const ids = env.calls.menus.map(m => m.id);
    assert.ok(ids.includes('preset-tab-preset-A') && ids.includes('dup-page-preset-B') && ids.includes('preset-bookmark-preset-A'));
    assert.ok(!ids.some(i => /^(preset|dup)-(link|page|tab|bookmark)-\d+$/.test(i)), 'no index-based ids');
    ok('A3 menu ids are built from preset ids');
  }
  // A3: after reorder (menus not rebuilt yet), clicking old id B still applies preset B
  {
    const env = makeEnv({ presets });
    await env.L.installed({ reason: 'install' });
    env.store.presets = [presets[1], presets[0]]; // reordered, menus stale
    await env.L.menuClick({ menuItemId: 'preset-tab-preset-B' }, { id: 7, windowId: 1 });
    assert.strictEqual(env.calls.windowsCreate.length, 1);
    assert.strictEqual(env.calls.windowsCreate[0].width, 1000);
    assert.strictEqual(env.calls.windowsCreate[0].left, 3);
    assert.deepStrictEqual(env.calls.tabsMove[0], [7, { windowId: 50, index: 0 }]);
    ok('A3 reorder-safe: stale menu id still maps to the right preset; right-clicked tab (id 7) is moved');
  }
  // A3: deleted preset -> nothing happens
  {
    const env = makeEnv({ presets });
    await env.L.installed({ reason: 'install' });
    env.store.presets = [presets[0]];
    await env.L.menuClick({ menuItemId: 'preset-tab-preset-B' }, { id: 7, windowId: 1 });
    assert.strictEqual(env.calls.windowsCreate.length, 0);
    ok('A3 deleted preset: click is ignored');
  }
  // duplicate menu
  {
    const env = makeEnv({ presets });
    await env.L.installed({ reason: 'install' });
    await env.L.menuClick({ menuItemId: 'dup-tab-preset-A' }, { id: 7, windowId: 1 });
    assert.deepStrictEqual(env.calls.tabsDuplicate, [7]);
    assert.strictEqual(env.calls.tabsMove[0][0], 100, 'the duplicate (id 100) is moved, not the original');
    ok('duplicate menu moves the duplicate, original stays');
  }
  // A5: link context uses the clicked tab window and moves the new tab explicitly
  {
    const env = makeEnv({ presets });
    await env.L.installed({ reason: 'install' });
    await env.L.menuClick({ menuItemId: 'preset-link-preset-A', linkUrl: 'https://l.example/' }, { id: 7, windowId: 3 });
    assert.deepStrictEqual(env.calls.tabsCreate[0], { url: 'https://l.example/', windowId: 3, active: true });
    assert.strictEqual(env.calls.tabsMove[0][0], 100);
    ok('A5 link: opens in the window of the clicked tab and moves exactly the new tab');
  }
  // A5: bookmark (no tab) falls back to last focused window (not getCurrent=999)
  {
    const env = makeEnv({ presets });
    await env.L.installed({ reason: 'install' });
    await env.L.menuClick({ menuItemId: 'preset-bookmark-preset-A', bookmarkId: 'b1' }, undefined);
    assert.strictEqual(env.calls.tabsCreate[0].windowId, 1);
    assert.strictEqual(env.calls.tabsCreate[0].url, 'https://example.com/bm');
    ok('A5 bookmark without tab: falls back to last focused normal window');
  }
  // A4: onMessage returns promises only for handled messages
  {
    const env = makeEnv({ presets, systemDpr: 150 });
    assert.strictEqual(env.L.message({ action: 'unknown' }), undefined);
    assert.strictEqual(env.L.message({ action: 'getSystemDpr' }), undefined, 'removed message is not handled');
    const r2 = env.L.message({ action: 'applyPreset', preset: presets[0], detachTab: false, windowId: 1 });
    assert.ok(typeof r2.then === 'function'); await r2;
    assert.deepStrictEqual(env.calls.windowsUpdate[0], [1, { width: 533, height: 400, left: 1, top: 1 }]);
    const r3 = env.L.message({ action: 'openUrlWithPreset', url: 'https://h.example/', preset: presets[1], windowId: 4 });
    await r3;
    assert.strictEqual(env.calls.tabsCreate[0].windowId, 4);
    ok('A4 onMessage: promise responses for handled actions, undefined for others');
  }
  console.log(`\n${n} tests passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
