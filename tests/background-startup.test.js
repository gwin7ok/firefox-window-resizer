// background.js を browser API のモックで読み込み、挙動を検証する（Node 標準機能のみ）。
// 実行: node tests/run.js
// background.js を browser API のモックで読み込み、起動まわりの挙動を検証する
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const path = require('path');
const SRC = path.join(__dirname, '..', 'scripts', 'background.js');

function makeEnv(initialStorage) {
  const store = JSON.parse(JSON.stringify(initialStorage));
  const calls = { windowsUpdate: [], menusCreate: 0, setIcon: 0 };
  const listeners = {};
  const ev = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const noopLogger = new Proxy({}, { get: (_, k) => k.startsWith('log')
    ? async (_n, fn) => fn() : async () => {} });
  const browser = {
    storage: {
      local: {
        get: async (keys) => {
          if (keys == null) return { ...store };
          const arr = Array.isArray(keys) ? keys : [keys];
          const out = {}; arr.forEach(k => { if (k in store) out[k] = store[k]; }); return out;
        },
        set: async (o) => Object.assign(store, JSON.parse(JSON.stringify(o)))
      },
      onChanged: ev('storage.onChanged')
    },
    runtime: { onStartup: ev('onStartup'), onInstalled: ev('onInstalled'), onMessage: ev('onMessage'),
               getURL: (p) => 'moz-extension://x/' + p },
    contextMenus: { removeAll: async () => {}, create: () => { calls.menusCreate++; }, onClicked: ev('menus.onClicked') },
    browserAction: { setIcon: async () => { calls.setIcon++; } },
    windows: {
      getAll: async () => [{ id: 7 }],
      update: async (id, v) => { calls.windowsUpdate.push([id, v]); return { id, ...v, type: 'normal', state: 'normal' }; },
      getCurrent: async () => ({ id: 7 })
    },
    tabs: { query: async () => [], create: async () => ({}), update: async () => ({}) }
  };
  const sandbox = { browser, Logger: noopLogger, console, setTimeout, clearTimeout, Promise };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'store.js'), 'utf8'), sandbox, { filename: 'store.js' });
  vm.runInContext(fs.readFileSync(SRC, 'utf8'), sandbox, { filename: 'background.js' });
  return { store, calls, listeners };
}
const plain = (x) => JSON.parse(JSON.stringify(x));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let passed = 0; const ok = (name) => { passed++; console.log('PASS', name); };

(async () => {
  // A1: スクリプト読み込み（イベントページの再起動）だけでは何も実行されない
  {
    const env = makeEnv({ presets: [{ id: 'p1', name: 'A', width: 800, height: 600, left: 0, top: 0 }],
                          settings: { defaultPresetId: 'p1' } });
    await sleep(3000);
    assert.strictEqual(env.calls.windowsUpdate.length, 0);
    assert.strictEqual(env.calls.menusCreate, 0);
    ok('A1 reload of background does not apply startup preset or rebuild menus');
  }
  // 起動時: onStartup で1回だけ適用される
  {
    const env = makeEnv({ presets: [{ id: 'p1', name: 'A', width: 800, height: 600, left: 10, top: 20 }],
                          settings: { defaultPresetId: 'p1' } });
    await env.listeners.onStartup();
    assert.strictEqual(env.calls.windowsUpdate.length, 0, 'delay before apply');
    await sleep(3000);
    assert.strictEqual(env.calls.windowsUpdate.length, 1);
    assert.deepStrictEqual(plain(env.calls.windowsUpdate[0]), [7, { width: 800, height: 600, left: 10, top: 20 }]);
    assert.ok(env.calls.menusCreate > 0);
    ok('onStartup applies the startup preset exactly once (logical px at 100% DPR)');
  }
  // 起動時プリセット未設定なら適用しない
  {
    const env = makeEnv({ presets: [{ id: 'p1', name: 'A', width: 1, height: 1, left: 0, top: 0 }],
                          settings: { defaultPresetId: null } });
    await env.listeners.onStartup(); await sleep(3000);
    assert.strictEqual(env.calls.windowsUpdate.length, 0);
    ok('no startup preset configured -> nothing applied');
  }
  // A2: 新規インストールでデフォルトプリセットに id が付く
  {
    const env = makeEnv({});
    await env.listeners.onInstalled({ reason: 'install' });
    assert.ok(Array.isArray(env.store.presets) && env.store.presets.length === 1);
    assert.ok(env.store.presets[0].id, 'default preset has id');
    assert.deepStrictEqual(plain(env.store.settings), { defaultPresetId: null });
    assert.strictEqual(env.store.systemDpr, 100);
    assert.ok(!('default' in env.store) && !('defaultPresetName' in env.store), 'legacy keys not written');
    ok('A2 fresh install: default preset has id, settings/DPR initialized, no legacy keys');
  }
  // A2: 既存データ(id なし)に id を付与し、既存の id は変えない
  {
    const env = makeEnv({ presets: [{ name: 'old', width: 1, height: 1, left: 0, top: 0 },
                                    { id: 'keep', name: 'k', width: 2, height: 2, left: 0, top: 0 }],
                          settings: { defaultPresetId: null }, systemDpr: 150 });
    await env.listeners.onInstalled({ reason: 'update' });
    assert.ok(env.store.presets[0].id);
    assert.strictEqual(env.store.presets[1].id, 'keep');
    assert.strictEqual(env.store.systemDpr, 150);
    ok('A2 migration: ids assigned only where missing, existing values preserved');
  }
  // DPR 150% では物理px→論理pxに変換して適用
  {
    const env = makeEnv({ presets: [{ id: 'p1', name: 'A', width: 1500, height: 900, left: 150, top: 0 }],
                          settings: { defaultPresetId: 'p1' }, systemDpr: 150 });
    await env.listeners.onStartup(); await sleep(3000);
    assert.deepStrictEqual(plain(env.calls.windowsUpdate[0][1]), { width: 1000, height: 600, left: 100, top: 0 });
    ok('DPR 150%: physical -> logical conversion preserved');
  }
  console.log(`\n${passed} tests passed`);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
