// views/preset-editor.js: 新規/編集モードの初期化、現在のウィンドウサイズの取得（DPR 変換）、保存、入力検証。
const assert = require('assert');
const { createViewEnv, plain } = require('./helpers/view-env');

const SCRIPTS = ['scripts/store.js', 'views/preset-editor.js'];
const ELEMENTS = [
  { id: 'preset-form', tag: 'form' },
  { id: 'editor-title', tag: 'h2' },
  { id: 'preset-name', tag: 'input' },
  { id: 'preset-width', tag: 'input' },
  { id: 'preset-height', tag: 'input' },
  { id: 'preset-left', tag: 'input' },
  { id: 'preset-top', tag: 'input' },
  { id: 'save-preset', tag: 'button' },
  { id: 'use-current-size', tag: 'button' },
  { id: 'cancel-button', tag: 'button' },
  { id: 'size-info-text', tag: 'div' },
];
const presets = [
  { id: 'p1', name: '左半分', width: 960, height: 1080, left: 0, top: 0 },
  { id: 'p2', name: '右半分', width: 960, height: 1080, left: 960, top: 0 },
];
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

async function open(options = {}) {
  const env = createViewEnv({ scripts: SCRIPTS, elements: ELEMENTS, ...options });
  await env.document.dispatch('DOMContentLoaded');
  await env.flush();
  return env;
}
const val = (env, id) => env.elements[id].value;
const submit = (env) => env.elements['preset-form'].dispatch('submit');

(async () => {
  // 新規作成モード: 既定値とタイトル
  {
    const env = await open({ storage: { presets }, search: '' });
    assert.strictEqual(env.elements['editor-title'].textContent, 'プリセットを作成');
    assert.deepStrictEqual(
      ['preset-name', 'preset-width', 'preset-height', 'preset-left', 'preset-top'].map((id) => val(env, id)),
      ['', '1280', '720', '0', '0']
    );
    assert.strictEqual(env.elements['save-preset'].textContent, 'プリセットを保存');
    assert.strictEqual(env.elements['preset-form'].dataset.editId, undefined);
    ok('new mode: title, default values, save button label');
  }

  // 編集モード: 保存済みの値をフォームに読み込む
  {
    const env = await open({ storage: { presets }, search: '?id=p2&sourceWindowId=3' });
    assert.strictEqual(env.elements['editor-title'].textContent, 'プリセットを編集');
    assert.deepStrictEqual(
      ['preset-name', 'preset-width', 'preset-height', 'preset-left', 'preset-top'].map((id) => val(env, id)),
      ['右半分', 960, 1080, 960, 0]
    );
    assert.strictEqual(env.elements['preset-form'].dataset.editId, 'p2');
    assert.strictEqual(env.elements['save-preset'].textContent, 'プリセットを更新');
    ok('edit mode: loads the stored preset into the form');
  }

  // 編集モードで存在しないID: アラートを出し、新規作成として続行
  {
    const env = await open({ storage: { presets }, search: '?id=missing' });
    assert.strictEqual(env.calls.alerts.length, 1);
    assert.strictEqual(val(env, 'preset-width'), '1280');
    assert.strictEqual(env.elements['preset-form'].dataset.editId, undefined);
    ok('edit mode with an unknown id: alert, falls back to new-preset defaults');
  }

  // 現在のウィンドウサイズを使用: 論理px → 物理px（DPR 150%）
  {
    const env = await open({
      storage: { presets, systemDpr: 150 },
      search: '?sourceWindowId=3',
      windows: { 3: { id: 3, width: 1000, height: 600, left: 100, top: 50, type: 'normal' } },
    });
    await env.elements['use-current-size'].dispatch('click');
    assert.deepStrictEqual(
      ['preset-width', 'preset-height', 'preset-left', 'preset-top'].map((id) => val(env, id)),
      [1500, 900, 150, 75]
    );
    assert.ok(env.elements['size-info-text'].textContent.includes('1500×900'));
    assert.strictEqual(env.elements['size-info-text'].style.display, 'block');
    ok('use current size: logical px converted to physical px with the configured DPR');
  }

  // ソースウィンドウが取得できなければ、通常ウィンドウを検索して使う
  {
    const env = await open({
      storage: { presets },
      search: '?sourceWindowId=99',
      windowsAll: [
        { id: 5, type: 'popup', width: 1, height: 1, left: 0, top: 0 },
        { id: 6, type: 'normal', incognito: false, state: 'normal', width: 800, height: 600, left: 20, top: 30 },
      ],
    });
    await env.elements['use-current-size'].dispatch('click');
    assert.deepStrictEqual(
      ['preset-width', 'preset-height', 'preset-left', 'preset-top'].map((id) => val(env, id)),
      [800, 600, 20, 30]
    );
    ok('use current size: falls back to the first normal window when the source window is gone');
  }

  // 新規保存: id を採番して追加し、保存通知を送ってウィンドウを閉じる
  {
    const env = await open({ storage: { presets } });
    env.elements['preset-name'].value = '新しい';
    env.elements['preset-width'].value = '1024';
    env.elements['preset-height'].value = '768';
    env.elements['preset-left'].value = '5';
    env.elements['preset-top'].value = '6';
    await submit(env);
    const saved = plain(env.store.presets);
    assert.strictEqual(saved.length, 3);
    assert.match(saved[2].id, /^preset-\d+$/);
    assert.deepStrictEqual({ ...saved[2], id: 'x' }, { id: 'x', name: '新しい', width: 1024, height: 768, left: 5, top: 6 });
    assert.deepStrictEqual(env.calls.messages, [{ action: 'presetSaved', isEdit: false }]);
    assert.strictEqual(env.calls.windowClose, 1);
    ok('save (new): appends with a generated id, notifies, closes the window');
  }

  // 編集保存: 同じ位置で置換
  {
    const env = await open({ storage: { presets }, search: '?id=p1' });
    env.elements['preset-name'].value = '左（更新）';
    env.elements['preset-width'].value = '900';
    await submit(env);
    const saved = plain(env.store.presets);
    assert.strictEqual(saved.length, 2);
    assert.deepStrictEqual(saved[0], { id: 'p1', name: '左（更新）', width: 900, height: 1080, left: 0, top: 0 });
    assert.deepStrictEqual(saved[1], presets[1]);
    assert.deepStrictEqual(env.calls.messages, [{ action: 'presetSaved', isEdit: true }]);
    ok('save (edit): replaces the preset in place and keeps the others');
  }

  // 入力検証: 幅・高さが正でなければ保存せず、閉じない
  {
    for (const bad of [{ width: '0', height: '720' }, { width: '800', height: '-1' }, { width: 'abc', height: '720' }]) {
      const env = await open({ storage: { presets } });
      env.elements['preset-width'].value = bad.width;
      env.elements['preset-height'].value = bad.height;
      await submit(env);
      assert.strictEqual(env.calls.alerts.length, 1, JSON.stringify(bad));
      assert.deepStrictEqual(plain(env.store.presets), presets, 'storage unchanged');
      assert.strictEqual(env.calls.windowClose, 0);
      assert.strictEqual(env.calls.messages.length, 0);
    }
    ok('validation: non-positive or invalid width/height is rejected without saving');
  }

  // キャンセル
  {
    const env = await open({ storage: { presets } });
    await env.elements['cancel-button'].dispatch('click');
    assert.strictEqual(env.calls.windowClose, 1);
    assert.deepStrictEqual(plain(env.store.presets), presets);
    ok('cancel closes the window without saving');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
