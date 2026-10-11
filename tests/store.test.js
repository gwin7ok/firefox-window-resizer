// 共通ストレージモジュール（scripts/store.js）の検証: 読み書き、既定値、初期化、論理/物理ピクセル変換。
const assert = require('assert');
const path = require('path');

let store = {};
global.browser = {
  storage: {
    local: {
      get: async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        const out = {};
        arr.forEach((k) => { if (k in store) out[k] = JSON.parse(JSON.stringify(store[k])); });
        return out;
      },
      set: async (o) => { Object.assign(store, JSON.parse(JSON.stringify(o))); },
    },
  },
};
const S = require(path.join(__dirname, '..', 'scripts', 'store.js'));
const reset = (initial = {}) => { store = JSON.parse(JSON.stringify(initial)); };
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

(async () => {
  // プリセット
  reset();
  assert.deepStrictEqual(await S.getPresets(), []);
  reset({ presets: 'broken' });
  assert.deepStrictEqual(await S.getPresets(), [], 'non-array is treated as empty');
  await S.savePresets([{ id: 'a', name: 'A' }]);
  assert.deepStrictEqual(await S.getPresets(), [{ id: 'a', name: 'A' }]);
  ok('presets: default [], non-array tolerated, save/load');

  // 設定
  reset();
  assert.deepStrictEqual(await S.getSettings(), { defaultPresetId: null });
  reset({ settings: {} });
  assert.deepStrictEqual(await S.getSettings(), { defaultPresetId: null }, 'missing keys get defaults');
  await S.saveSettings({ defaultPresetId: 'x' });
  assert.strictEqual((await S.getSettings()).defaultPresetId, 'x');
  ok('settings: defaults merged, save/load');

  // 拡大率
  reset();
  assert.strictEqual(await S.getDprPercent(), 100);
  assert.strictEqual(await S.getDprFactor(), 1);
  await S.setDprPercent(150);
  assert.strictEqual(await S.getDprPercent(), 150);
  assert.strictEqual(await S.getDprFactor(), 1.5);
  for (const bad of [0, -5, 'abc', null, NaN]) {
    reset({ systemDpr: bad });
    assert.strictEqual(await S.getDprPercent(), 100, `invalid value ${String(bad)} falls back to 100`);
  }
  ok('DPR: default 100, invalid values fall back, factor');

  // 変換
  const physical = { width: 1500, height: 900, left: 150, top: 75 };
  assert.deepStrictEqual(S.toLogical(physical, 1.5), { width: 1000, height: 600, left: 100, top: 50 });
  assert.deepStrictEqual(S.toPhysical({ width: 1000, height: 600, left: 100, top: 50 }, 1.5), physical);
  assert.deepStrictEqual(S.toLogical({ width: 1001, height: 1, left: 0, top: 1 }, 1.25), { width: 801, height: 1, left: 0, top: 1 });
  ok('conversion: logical <-> physical, rounding');

  // 初期化
  reset();
  let r = await S.ensureDefaults();
  assert.deepStrictEqual(r, { presetsInitialized: true, idsAssigned: false, settingsInitialized: true, dprInitialized: true });
  assert.strictEqual(store.presets.length, 1);
  assert.ok(store.presets[0].id);
  assert.strictEqual(store.systemDpr, 100);
  // 2回目は何もしない
  r = await S.ensureDefaults();
  assert.deepStrictEqual(r, { presetsInitialized: false, idsAssigned: false, settingsInitialized: false, dprInitialized: false });
  // id の付与（既存の id と値は保持）
  reset({ presets: [{ name: 'old' }, { id: 'keep', name: 'k' }], settings: { defaultPresetId: 'keep' }, systemDpr: 125 });
  r = await S.ensureDefaults();
  assert.strictEqual(r.idsAssigned, true);
  assert.ok(store.presets[0].id);
  assert.strictEqual(store.presets[1].id, 'keep');
  assert.strictEqual(store.systemDpr, 125);
  assert.strictEqual(store.settings.defaultPresetId, 'keep');
  ok('ensureDefaults: initializes once, assigns missing ids, preserves existing data');

  // 既定プリセットは変更されない（呼び出し側の変更が定数に影響しない）
  reset();
  await S.ensureDefaults();
  store.presets[0].name = 'changed';
  assert.strictEqual(S.DEFAULT_PRESETS[0].name, '新規プリセット');
  ok('default preset constant is not shared by reference');

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
