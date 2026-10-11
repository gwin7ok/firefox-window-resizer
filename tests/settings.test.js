// views/settings.js: プリセット一覧、並べ替え（ボタン/ドラッグ&ドロップ）、削除、拡大率、起動時プリセット、エディタ起動。
const assert = require('assert');
const { createViewEnv, plain } = require('./helpers/view-env');

const SCRIPTS = ['scripts/store.js', 'views/preset-view.js', 'views/settings.js'];
const ELEMENTS = [
  { id: 'add-preset-button', tag: 'button' },
  { id: 'presets-container', tag: 'div' },
  { id: 'no-presets-message', tag: 'div' },
  { id: 'startup-form', tag: 'form' },
  { id: 'default-preset', tag: 'select' },
  { id: 'save-startup-setting', tag: 'button' },
  { id: 'dpr-form', tag: 'form' },
  { id: 'system-dpr', tag: 'input' },
  { id: 'save-dpr-setting', tag: 'button' },
  { id: 'dpr-save-message', tag: 'div' },
];
const presets = [
  { id: 'a', name: 'A', width: 100, height: 100, left: 0, top: 0 },
  { id: 'b', name: 'B', width: 200, height: 200, left: 1, top: 1 },
  { id: 'c', name: 'C', width: 300, height: 300, left: 2, top: 2 },
];
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

async function open(storage, options = {}) {
  const env = createViewEnv({ scripts: SCRIPTS, elements: ELEMENTS, storage, ...options });
  // select の先頭の「使用しない」オプション
  const none = env.document.createElement('option');
  none.value = 'null';
  none.textContent = '使用しない';
  env.elements['default-preset'].appendChild(none);
  env.elements['default-preset'].value = 'null';
  await env.document.dispatch('DOMContentLoaded');
  await env.flush();
  return env;
}
const tbodyOf = (env) => env.elements['presets-container'].querySelector('tbody');
const rowsOf = (env) => (tbodyOf(env) ? tbodyOf(env).children : []);
const namesOf = (env) => rowsOf(env).map((r) => r.children[1].textContent);
const idsOf = (store) => plain(store.presets).map((p) => p.id);

(async () => {
  // 初期表示: 一覧・拡大率・起動時プリセットの選択肢
  {
    const env = await open({ presets, systemDpr: 125, settings: { defaultPresetId: 'b' } });
    assert.deepStrictEqual(namesOf(env), ['A', 'B', 'C']);
    assert.deepStrictEqual(rowsOf(env)[1].children.map((c) => c.textContent).slice(1, 4), ['B', '200×200', '(1, 1)']);
    assert.strictEqual(env.elements['no-presets-message'].style.display, 'none');
    assert.strictEqual(env.elements['system-dpr'].value, 125);
    const select = env.elements['default-preset'];
    assert.deepStrictEqual(select.options.map((o) => o.value), ['null', 'a', 'b', 'c']);
    assert.strictEqual(select.value, 'b', 'stored startup preset is selected');
    ok('initial render: list, DPR value, startup preset options and selection');
  }

  // 順序ボタンの無効化
  {
    const env = await open({ presets });
    const buttons = (row) => row.children[0].children.filter((c) => c.tagName === 'button');
    assert.strictEqual(buttons(rowsOf(env)[0])[0].disabled, true, 'first row: up disabled');
    assert.strictEqual(buttons(rowsOf(env)[2])[1].disabled, true, 'last row: down disabled');
    assert.strictEqual(buttons(rowsOf(env)[1])[0].disabled, false);
    ok('order buttons: disabled at both ends');
  }

  // プリセットなし
  {
    const env = await open({ presets: [] });
    assert.strictEqual(env.elements['no-presets-message'].style.display, 'block');
    assert.strictEqual(rowsOf(env).length, 0);
    ok('no presets: shows the empty message');
  }

  // 下へボタン: 順序を変更し、背景へ通知する
  {
    const env = await open({ presets });
    const down = rowsOf(env)[0].children[0].children.filter((c) => c.tagName === 'button')[1];
    await down.dispatch('click');
    await env.flush();
    assert.deepStrictEqual(idsOf(env.store), ['b', 'a', 'c']);
    assert.deepStrictEqual(env.calls.messages, [{ action: 'presetSaved', source: 'order_changed' }]);
    assert.deepStrictEqual(namesOf(env), ['B', 'A', 'C'], 'list is re-rendered');
    ok('down button reorders, persists, notifies, and re-renders');
  }

  // ドラッグ&ドロップ: 先頭を末尾へ
  {
    const env = await open({ presets });
    const tbody = tbodyOf(env);
    const rows = tbody.children;
    const dt = { setData() {}, effectAllowed: '', dropEffect: '' };
    await tbody.dispatch('dragstart', { target: rows[0], dataTransfer: dt });
    await tbody.dispatch('drop', { target: rows[2], clientY: 1, dataTransfer: dt });
    await env.flush();
    assert.deepStrictEqual(idsOf(env.store), ['b', 'c', 'a']);
    ok('drag & drop: dragging the first row below the last row moves it to the end');
  }

  // 削除: 確認でキャンセルなら何もしない
  {
    const env = await open({ presets, settings: { defaultPresetId: 'b' } }, { confirm: false });
    await env.sandbox.deletePreset('b');
    assert.strictEqual(env.calls.confirms.length, 1);
    assert.deepStrictEqual(idsOf(env.store), ['a', 'b', 'c']);
    assert.strictEqual(env.calls.messages.length, 0);
    ok('delete: cancelled confirmation changes nothing');
  }

  // 削除: 起動時プリセットに設定されていれば解除し、背景へ通知
  {
    const env = await open({ presets, settings: { defaultPresetId: 'b' } });
    await env.sandbox.deletePreset('b');
    await env.flush();
    assert.deepStrictEqual(idsOf(env.store), ['a', 'c']);
    assert.strictEqual(env.store.settings.defaultPresetId, null, 'startup preset reset');
    assert.deepStrictEqual(env.calls.messages, [{ action: 'presetDeleted', presetId: 'b' }]);
    assert.deepStrictEqual(namesOf(env), ['A', 'C']);
    ok('delete: removes the preset, resets the startup preset if it was selected, notifies');
  }

  // 削除: 別のプリセットが起動時プリセットなら設定は維持
  {
    const env = await open({ presets, settings: { defaultPresetId: 'a' } });
    await env.sandbox.deletePreset('c');
    assert.strictEqual(env.store.settings.defaultPresetId, 'a');
    ok('delete: unrelated startup preset is kept');
  }

  // 拡大率の保存と検証
  {
    const env = await open({ presets, systemDpr: 100 });
    env.elements['system-dpr'].value = '150';
    await env.elements['dpr-form'].dispatch('submit');
    await env.flush();
    assert.strictEqual(env.store.systemDpr, 150);
    assert.ok(env.elements['dpr-save-message'].textContent.includes('150%'));
    assert.strictEqual(env.calls.alerts.length, 0);

    for (const bad of ['50', '301', 'abc', '']) {
      env.elements['system-dpr'].value = bad;
      await env.elements['dpr-form'].dispatch('submit');
    await env.flush();
      assert.strictEqual(env.store.systemDpr, 150, `invalid "${bad}" is not stored`);
    }
    assert.strictEqual(env.calls.alerts.length, 4);
    ok('DPR: saves 100-300, rejects out-of-range and invalid input with an alert');
  }

  // 起動時プリセットの保存（選択 / 「使用しない」）
  {
    const env = await open({ presets, settings: { defaultPresetId: null } });
    env.elements['default-preset'].value = 'c';
    await env.elements['startup-form'].dispatch('submit');
    await env.flush();
    assert.strictEqual(env.store.settings.defaultPresetId, 'c');
    env.elements['default-preset'].value = 'null';
    await env.elements['startup-form'].dispatch('submit');
    await env.flush();
    assert.strictEqual(env.store.settings.defaultPresetId, null);
    ok('startup preset: saves the selection, "null" clears it');
  }

  // エディタを開く: 新規 / 編集 / 不正な引数（イベントオブジェクト）
  {
    const env = await open({ presets });
    const created = [];
    env.browser.windows.create = async (o) => { created.push(plain(o)); return { id: 9 }; };

    await env.elements['add-preset-button'].dispatch('click');
    await env.sandbox.openPresetEditor('b');
    await env.sandbox.openPresetEditor({ type: 'click' });

    assert.strictEqual(created.length, 3);
    const urls = created.map((c) => new URL(c.url));
    assert.ok(urls.every((u) => u.pathname.endsWith('/views/preset-editor.html')));
    assert.strictEqual(urls[0].searchParams.get('id'), null);
    assert.strictEqual(urls[0].searchParams.get('sourceWindowId'), '1');
    assert.strictEqual(urls[1].searchParams.get('id'), 'b');
    assert.strictEqual(urls[2].searchParams.get('id'), null, 'object argument is treated as new');
    assert.ok(created.every((c) => c.type === 'popup' && c.width === 650));
    ok('openPresetEditor: new / edit(id) / invalid argument, with sourceWindowId');
  }

  // 背景からの更新通知で一覧を再読み込み
  {
    const env = await open({ presets });
    const store = env.store;
    store.presets = [presets[2]];
    await env.listeners.onMessage({ action: 'refreshSettings', source: 'presetSaved' });
    await env.flush();
    assert.deepStrictEqual(namesOf(env), ['C']);
    ok('refreshSettings message reloads the list');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
