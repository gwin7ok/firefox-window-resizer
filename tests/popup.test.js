// views/popup.js: プリセット一覧の表示、適用（通常/タブ分離）、設定ページへの移動、エラー表示。
const assert = require('assert');
const { createViewEnv, plain } = require('./helpers/view-env');

const SCRIPTS = ['scripts/store.js', 'views/preset-view.js', 'views/popup.js'];
const ELEMENTS = [
  { id: 'presets-container', tag: 'div' },
  { id: 'detach-tab-checkbox', tag: 'input' },
  { id: 'settings-button', tag: 'button' },
];
const presets = [
  { id: 'a', name: '左半分', width: 960, height: 1080, left: 0, top: 0 },
  { id: 'b', name: '全画面\n(2行)', width: 1920, height: 1080, left: 10, top: 20 },
];
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

async function open(storage) {
  const env = createViewEnv({ scripts: SCRIPTS, elements: ELEMENTS, storage });
  await env.document.dispatch('DOMContentLoaded');
  return env;
}
const rowsOf = (env) => env.elements['presets-container'].querySelectorAll('tr').filter((r) => r.className === 'preset-item');

(async () => {
  // 一覧の表示
  {
    const env = await open({ presets });
    const container = env.elements['presets-container'];
    const table = container.querySelector('table');
    assert.ok(table && table.className === 'presets-table');
    const headers = table.querySelectorAll('th').map((th) => th.textContent);
    assert.deepStrictEqual(headers, ['プリセット名', 'サイズ', '位置']);
    const rows = rowsOf(env);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows[0].children.map((c) => c.textContent), ['左半分', '960×1080', '(0, 0)']);
    assert.deepStrictEqual(rows[1].children.map((c) => c.className), ['preset-name', 'preset-size', 'preset-position']);
    assert.ok(rows[1].title.includes('全画面\n(2行)'), 'tooltip contains the (multi-line) name');
    ok('renders a table of presets with name / size / position');
  }

  // プリセットなし: メッセージと設定ページへのリンク
  {
    const env = await open({ presets: [] });
    const container = env.elements['presets-container'];
    assert.ok(container.children.some((c) => c.className === 'no-presets-message'));
    const link = container.children.find((c) => c.className === 'settings-link');
    assert.ok(link);
    await link.dispatch('click');
    assert.strictEqual(env.calls.tabsCreate.length, 1);
    assert.strictEqual(env.calls.tabsCreate[0].url, 'moz-extension://x/views/settings.html');
    assert.strictEqual(env.calls.windowClose, 1);
    ok('no presets: shows a message and a link that opens the settings page');
  }

  // 通常適用: 送信元ウィンドウIDと detachTab=false をメッセージで渡し、ポップアップを閉じる
  {
    const env = await open({ presets });
    await rowsOf(env)[0].dispatch('click');
    assert.deepStrictEqual(env.calls.messages, [
      { action: 'applyPreset', preset: presets[0], detachTab: false, windowId: 1 },
    ]);
    assert.strictEqual(env.calls.windowClose, 1);
    ok('click applies the preset via message (normal mode) and closes the popup');
  }

  // タブ分離オプション
  {
    const env = await open({ presets });
    const checkbox = env.elements['detach-tab-checkbox'];
    assert.strictEqual(checkbox.checked, false, 'initialized unchecked');
    checkbox.checked = true;
    await checkbox.dispatch('change', { target: checkbox });
    await rowsOf(env)[1].dispatch('click');
    assert.strictEqual(env.calls.messages[0].detachTab, true);
    assert.strictEqual(env.calls.messages[0].preset.id, 'b');
    ok('detach-tab checkbox is reflected in the apply message');
  }

  // 既に設定タブがあればそれをアクティブにする
  {
    const env = await open({ presets });
    env.browser.tabs.query = async () => [{ id: 42, url: 'moz-extension://x/views/settings.html' }];
    let updated = null;
    env.browser.tabs.update = async (id, props) => { updated = [id, props]; };
    await env.elements['settings-button'].dispatch('click');
    assert.deepStrictEqual(plain(updated), [42, { active: true }]);
    assert.strictEqual(env.calls.tabsCreate.length, 0);
    ok('settings button focuses an existing settings tab instead of creating one');
  }

  // 適用に失敗したら、アラートを出し、ポップアップは閉じない
  {
    const env = await open({ presets });
    env.browser.runtime.sendMessage = async () => { throw new Error('boom'); };
    await rowsOf(env)[0].dispatch('click');
    assert.strictEqual(env.calls.alerts.length, 1);
    assert.ok(env.calls.alerts[0].includes('boom'));
    assert.strictEqual(env.calls.windowClose, 0);
    ok('apply failure: alert shown, popup stays open');
  }

  // 名前のない不正なプリセットは空行になり、クリックしても何も送らない
  {
    const env = await open({ presets: [{ id: 'x', width: 1, height: 1, left: 0, top: 0 }] });
    const rows = env.elements['presets-container'].querySelectorAll('tr').filter((r) => r.parentNode && r.parentNode.tagName === 'tbody');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].children.length, 0, 'invalid preset renders an empty row');
    ok('invalid preset (no name) renders an empty row');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
