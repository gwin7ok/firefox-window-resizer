// scripts/menus.js: メニューIDの組み立て・解析、メニューの作成、クリックのルーティング。
const assert = require('assert');
const { loadBackground } = require('./helpers/load-background');
const { makeBrowser, noopLogger, plain } = require('./helpers/mock-browser');

const presets = [
  { id: 'preset-1700000000000', name: '左\n半分', width: 960, height: 1080, left: 0, top: 0 },
  { id: 'p-2', name: '右半分', width: 960, height: 1080, left: 960, top: 0 },
];
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

function setup(storage) {
  const env = makeBrowser({ storage });
  const { sandbox } = loadBackground({ browser: env.browser, Logger: noopLogger });
  return { env, fns: sandbox };
}

(async () => {
  // IDの解析: プリセットIDにハイフンが含まれていても解析できる
  {
    const { fns } = setup({});
    assert.deepStrictEqual(plain(fns.parsePresetMenuItemId('preset-link-preset-1700000000000')),
      { kind: 'preset', context: 'link', key: 'preset-1700000000000' });
    assert.deepStrictEqual(plain(fns.parsePresetMenuItemId('dup-tab-a-b-c')),
      { kind: 'dup', context: 'tab', key: 'a-b-c' });
    for (const bad of ['open-settings', 'preset-unknown-x', 'dup-tab-', 'fwr-link', '']) {
      assert.strictEqual(fns.parsePresetMenuItemId(bad), null, bad);
    }
    ok('parsePresetMenuItemId: hyphenated preset ids, invalid ids return null');
  }

  // キーの組み立てと検索
  {
    const { fns } = setup({});
    assert.strictEqual(fns.presetMenuKey({ id: 'x' }, 3), 'x');
    assert.strictEqual(fns.presetMenuKey({}, 3), 'index:3');
    assert.strictEqual(fns.findPresetByMenuKey(presets, 'p-2'), presets[1]);
    assert.strictEqual(fns.findPresetByMenuKey(presets, 'index:0'), presets[0]);
    assert.strictEqual(fns.findPresetByMenuKey(presets, 'missing'), undefined);
    ok('presetMenuKey / findPresetByMenuKey: by id, index fallback, missing');
  }

  // メニュー作成: 設定項目 + 各コンテキストの親と、プリセットごとのサブメニュー
  {
    const { env, fns } = setup({ presets });
    await fns.createContextMenus();
    const byId = Object.fromEntries(env.calls.menus.map((m) => [m.id, m]));
    assert.deepStrictEqual(byId['open-settings'].contexts, ['browser_action']);
    assert.deepStrictEqual(byId['open-history-sidebar'].contexts, ['browser_action']);
    for (const ctx of ['link', 'page', 'tab', 'bookmark']) {
      assert.ok(byId[`fwr-${ctx}`], `parent for ${ctx}`);
      assert.ok(byId[`preset-${ctx}-p-2`], `child for ${ctx}`);
      assert.strictEqual(byId[`preset-${ctx}-p-2`].parentId, `fwr-${ctx}`);
    }
    for (const ctx of ['page', 'tab']) {
      assert.ok(byId[`fwr-dup-${ctx}`] && byId[`dup-${ctx}-p-2`]);
    }
    assert.ok(!byId['dup-link-p-2'] && !byId['dup-bookmark-p-2'], 'duplicate menu only for page/tab');
    assert.strictEqual(byId['preset-tab-preset-1700000000000'].title, '左 半分', 'multi-line name on one line');
    ok('createContextMenus: parents/children per context, duplicate only for page/tab, single-line titles');
  }

  // プリセットがなければプリセットメニューは作らない
  {
    const { env, fns } = setup({ presets: [] });
    await fns.createContextMenus();
    assert.deepStrictEqual(env.calls.menus.map((m) => m.id), ['open-settings', 'open-history-sidebar']);
    ok('no presets: only the icon menu items');
  }

  // クリックのルーティング
  {
    const { env, fns } = setup({ presets });
    await fns.handleMenuClick({ menuItemId: 'open-settings' }, undefined);
    assert.deepStrictEqual(env.calls.tabsCreate, [{ url: 'views/settings.html' }]);

    await fns.handleMenuClick({ menuItemId: 'open-history-sidebar' }, undefined);
    assert.strictEqual(env.calls.sidebarOpen, 1);
    ok('handleMenuClick: settings and history sidebar items');
  }

  // sidebarAction.open はユーザー操作の直後（await より前）に同期的に呼ばれる
  {
    const { env, fns } = setup({});
    const promise = fns.handleMenuClick({ menuItemId: 'open-history-sidebar' }, undefined);
    assert.strictEqual(env.calls.sidebarOpen, 1, 'called synchronously, before any await');
    await promise;
    ok('handleMenuClick: sidebarAction.open() is called synchronously');
  }

  // 不明なIDや例外は握りつぶさず、ログ出力にとどめる（例外を外に投げない）
  {
    const { env, fns } = setup({ presets });
    await fns.handleMenuClick({ menuItemId: 'something-else' }, { id: 1, windowId: 1 });
    await fns.handleMenuClick({ menuItemId: 'preset-tab-p-2' }, { id: 7, windowId: 1 });
    assert.strictEqual(env.calls.windowsCreate.length, 1, 'valid preset click applied');
    ok('handleMenuClick: unknown ids are ignored, preset click applies');
  }

  // リスナー登録: background.js が handleMenuClick を onClicked に登録している
  {
    const { env, fns } = setup({});
    assert.strictEqual(env.listeners['menus.onClicked'], fns.handleMenuClick);
    ok('background.js registers handleMenuClick as the onClicked listener');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
