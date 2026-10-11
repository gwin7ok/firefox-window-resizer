// scripts/window-actions.js: プリセットの適用（通常/タブ分離）、座標の再調整、DPR 変換、ウィンドウ解決。
const assert = require('assert');
const { loadBackground } = require('./helpers/load-background');
const { makeBrowser, noopLogger, plain } = require('./helpers/mock-browser');

const preset = { id: 'p1', name: 'P', width: 1500, height: 900, left: 150, top: 75 };
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

function setup(options) {
  const env = makeBrowser(options);
  const { sandbox } = loadBackground({ browser: env.browser, Logger: noopLogger });
  return { env, fns: sandbox };
}

(async () => {
  // 通常モード: 物理px → 論理px（DPR 150%）に変換して既存ウィンドウを更新
  {
    const { env, fns } = setup({ storage: { systemDpr: 150 } });
    const result = await fns.applyPresetWithOptions(preset, false, 3);
    assert.deepStrictEqual(env.calls.windowsUpdate, [[3, { width: 1000, height: 600, left: 100, top: 50 }]]);
    assert.strictEqual(plain(result).success, true);
    assert.strictEqual(env.calls.windowsCreate.length, 0);
    ok('normal mode: converts physical to logical px and updates the target window');
  }

  // ウィンドウ未指定: 最後にフォーカスされた通常ウィンドウ（getCurrent の 999 ではなく 1）
  {
    const { env, fns } = setup();
    await fns.applyPresetWithOptions(preset, false);
    assert.strictEqual(env.calls.windowsUpdate[0][0], 1);
    assert.strictEqual(await fns.getCurrentWindowId(), 1);
    ok('window resolution: last focused normal window (not getCurrent)');
  }

  // タブ分離: 空ウィンドウ作成 → タブ移動 → 空タブ削除（アクティブタブ）
  {
    const { env, fns } = setup();
    const result = plain(await fns.applyPresetWithOptions(preset, true, 3));
    assert.deepStrictEqual(env.calls.tabsQuery[0], { active: true, windowId: 3 });
    assert.strictEqual(env.calls.windowsCreate[0].url, 'about:blank');
    assert.strictEqual(env.calls.windowsCreate[0].width, 1500);
    assert.deepStrictEqual(env.calls.tabsMove, [[5, { windowId: 50, index: 0 }]]);
    assert.deepStrictEqual(env.calls.tabsRemove, [11], 'the leftover about:blank tab is removed');
    assert.strictEqual(result.result.detached, true);
    ok('detach mode: create blank window, move the active tab, remove the blank tab');
  }

  // タブ分離（タブID指定）: アクティブタブの検索をせず、指定タブを移動
  {
    const { env, fns } = setup();
    await fns.applyPresetWithOptions(preset, true, 3, 77);
    assert.deepStrictEqual(env.calls.tabsGet, [77]);
    assert.ok(!env.calls.tabsQuery.some((q) => q.active), 'no active-tab lookup');
    assert.strictEqual(env.calls.tabsMove[0][0], 77);
    ok('detach mode with targetTabId: moves exactly that tab');
  }

  // 座標ずれ: 作成されたウィンドウの位置が期待値と異なれば再調整する
  {
    const { env, fns } = setup({ createdWindow: { left: 0, top: 0 } });
    await fns.applyPresetWithOptions({ ...preset, left: 200, top: 100 }, true, 3);
    assert.deepStrictEqual(env.calls.windowsUpdate, [[50, { left: 200, top: 100 }]]);
    ok('detach mode: re-adjusts the position when the new window is misplaced');
  }

  // applyPresetToWindow: 指定ウィンドウに通常適用
  {
    const { env, fns } = setup();
    await fns.applyPresetToWindow(9, preset);
    assert.strictEqual(env.calls.windowsUpdate[0][0], 9);
    ok('applyPresetToWindow applies in normal mode to the given window');
  }

  // 失敗時は例外を投げる（呼び出し側で扱う）
  {
    const { env, fns } = setup();
    env.browser.windows.update = async () => { throw new Error('boom'); };
    await assert.rejects(fns.applyPresetToWindow(9, preset), /boom/);
    ok('failures are rethrown to the caller');
  }

  // リンクを新ウィンドウで開く: 指定ウィンドウにタブを作り、そのタブを移動
  {
    const { env, fns } = setup();
    await fns.openLinkInNewWindowWithPreset('https://l.example/', preset, 4);
    assert.deepStrictEqual(env.calls.tabsCreate[0], { url: 'https://l.example/', windowId: 4, active: true });
    assert.strictEqual(env.calls.tabsMove[0][0], 100);
    ok('open link: creates the tab in the given window and moves exactly that tab');
  }

  // 設定ページ: 既存タブがなければ新規作成
  {
    const { env, fns } = setup();
    await fns.openSettingsPage();
    assert.deepStrictEqual(env.calls.tabsCreate, [{ url: 'views/settings.html' }]);
    ok('open settings page creates a tab when none exists');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
