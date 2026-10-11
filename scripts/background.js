// DPR情報表示関数 - getSystemDprを活用
async function showDprInfo() {
  try {
    return await Logger.logDprOperation('システム設定確認', async () => {
      // 既存のgetSystemDpr関数を利用してDPR値を取得
      const dprFactor = await getSystemDpr();
      const systemDpr = Math.round(dprFactor * 100);

      // DPR値をログに出力
      await Logger.info(`システム設定DPR: ${systemDpr}%（係数: ${dprFactor}）`);
      return systemDpr;
    });
  } catch (err) {
    await Logger.error('DPR情報表示エラー:', err);
    return 100; // エラー時はデフォルト値を返す
  }
}

// プリセット情報表示関数
async function showPresetInfo() {
  try {
    return await Logger.logPresetOperation('登録状況', async () => {
      const presets = await FwrStore.getPresets();

      // プリセットの詳細情報をグループ化して出力
      await Logger.info(`登録プリセット数: ${presets.length}`);

      // forEach を for...of に変更して非同期処理の完了を確実に待機
      let index = 0;
      for (const preset of presets) {
        await Logger.info(`[${index + 1}] ${preset.name}`);
        await Logger.info(`  サイズ: ${preset.width}×${preset.height}`);
        await Logger.info(`  位置: (${preset.left}, ${preset.top})`);
        index++;
      }

      return presets;
    });
  } catch (err) {
    await Logger.error('プリセット情報表示エラー:', err);
  }
}


/**
 * コンテキストメニュー項目IDに埋め込むプリセットのキーを返す。
 * 並べ替えや削除でメニュー再構築前にクリックされても別のプリセットを指さないよう、
 * 配列のindexではなくプリセットIDを使う（idがない場合のみindexで代替）。
 * @param {Object} preset
 * @param {number} index
 * @returns {string}
 */
function presetMenuKey(preset, index) {
  return preset && preset.id ? String(preset.id) : `index:${index}`;
}

/**
 * メニュー項目IDを解析する。形式: "{preset|dup}-{link|page|tab|bookmark}-{presetKey}"
 * @param {string} menuItemId
 * @returns {{kind: string, context: string, key: string}|null}
 */
function parsePresetMenuItemId(menuItemId) {
  const m = /^(preset|dup)-(link|page|tab|bookmark)-(.+)$/.exec(String(menuItemId));
  return m ? { kind: m[1], context: m[2], key: m[3] } : null;
}

/**
 * メニュー項目IDのキーからプリセットを取得する。
 * @param {Array<Object>} presets
 * @param {string} key
 * @returns {Object|undefined}
 */
function findPresetByMenuKey(presets, key) {
  if (key.startsWith('index:')) {
    return presets[parseInt(key.slice('index:'.length), 10)];
  }
  return presets.find(preset => preset && String(preset.id) === key);
}

/**
 * コンテキストメニューを作成
 * @returns {Promise<void>}
 */
async function createContextMenus() {
  // 既存のコンテキストメニューをクリア
  await browser.contextMenus.removeAll();
  
  // 拡張機能アイコン用のコンテキストメニュー
  browser.contextMenus.create({
    id: "open-settings",
    title: "設定を開く",
    contexts: ["browser_action"]
  });

  browser.contextMenus.create({
    id: "open-history-sidebar",
    title: "履歴を別ウィンドウで開く",
    contexts: ["browser_action"]
  });
  
  // プリセット用のメニューを作成
  await createPresetContextMenus();
}

/**
 * プリセット用のコンテキストメニューを作成
 * @returns {Promise<void>}
 */
async function createPresetContextMenus() {
  try {
    // ストレージからプリセットを取得
    const presets = await FwrStore.getPresets();
    
    if (presets.length === 0) {
      await Logger.info('プリセットがないためコンテキストメニューは作成されません');
      return;
    }
    
    // メインメニューを作成（URLリンク、Webページ背景、タブ用）
    const contextTitles = {
      "link": "Firefox Window Resizer (別ウィンドウで開く)",
      "page": "Firefox Window Resizer (別ウィンドウに移動)",
      "tab": "Firefox Window Resizer (別ウィンドウに移動)",
      "bookmark": "Firefox Window Resizer (別ウィンドウで開く)"
    };
    
    const contexts = ["link", "page", "tab", "bookmark"];
    
    for (const context of contexts) {
      // 親メニューを作成
      const parentId = `fwr-${context}`;
      browser.contextMenus.create({
        id: parentId,
        title: contextTitles[context],
        contexts: [context]
      });
      
      // プリセットのサブメニューを作成
      presets.forEach((preset, index) => {
        const menuId = `preset-${context}-${presetMenuKey(preset, index)}`;
        browser.contextMenus.create({
          id: menuId,
          parentId: parentId,
          title: FwrStore.singleLineName(preset.name),
          contexts: [context]
        });
      });
    }

    // 複製用メニューを作成（Webページ背景、タブ用）
    for (const context of ["page", "tab"]) {
      const parentId = `fwr-dup-${context}`;
      browser.contextMenus.create({
        id: parentId,
        title: "Firefox Window Resizer (複製を別ウィンドウで開く)",
        contexts: [context]
      });

      presets.forEach((preset, index) => {
        browser.contextMenus.create({
          id: `dup-${context}-${presetMenuKey(preset, index)}`,
          parentId: parentId,
          title: FwrStore.singleLineName(preset.name),
          contexts: [context]
        });
      });
    }
    
    await Logger.info(`${presets.length}個のプリセットでコンテキストメニューを作成しました`);
  } catch (error) {
    await Logger.error('プリセット用コンテキストメニュー作成エラー:', error);
  }
}

/**
 * コンテキストメニューを更新（プリセット変更時）
 * @returns {Promise<void>}
 */
async function updateContextMenus() {
  try {
    await createContextMenus();
    await Logger.info('コンテキストメニューを更新しました');
  } catch (error) {
    await Logger.error('コンテキストメニュー更新エラー:', error);
  }
}

/**
 * 初期データ（プリセット・設定・DPR）をストレージに用意する。何度呼んでも安全。
 * @returns {Promise<void>}
 */
async function ensureDefaults() {
  const result = await FwrStore.ensureDefaults();
  if (result.presetsInitialized) {
    await Logger.info("デフォルトプリセットを初期化しました");
  }
  if (result.idsAssigned) {
    await Logger.info("idのないプリセットにidを付与しました");
  }
  if (result.settingsInitialized) {
    await Logger.info("デフォルト設定を初期化しました");
  }
  if (result.dprInitialized) {
    await Logger.info('DPR設定を初期化しました');
  }
}

/**
 * 拡張機能の初期化処理（インストール/更新時とブラウザ起動時に1回だけ呼ぶ）。
 * 背景スクリプトは persistent: false のため、再読み込みのたびに実行してはならない。
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    return await Logger.logSystemOperation('拡張機能初期化', async () => {
      await Logger.info('拡張機能を初期化します');

      await ensureDefaults();

      // コンテキストメニュー設定
      try {
        await createContextMenus();
      } catch (error) {
        await Logger.error("コンテキストメニュー作成エラー:", error);
      }

      // 現状の確認（ログ）
      await showDprInfo();
      await showPresetInfo();

      await Logger.info('拡張機能の初期化が完了しました');
    });
  } catch (error) {
    await Logger.error("初期化エラー:", error);
  }
}

// ブラウザ起動時のデフォルトプリセット適用
async function applyDefaultPresetIfNeeded() {
  try {
    return await Logger.logSystemOperation('起動時プリセット適用', async () => {
      // 設定とプリセットを取得
      const settings = await FwrStore.getSettings();
      const presets = await FwrStore.getPresets();
      
      // 設定チェック
      if (!settings.defaultPresetId) {
        await Logger.info("起動時のプリセット適用は無効化されています");
        return { applied: false, reason: "disabled" };
      }
      
      if (presets.length === 0) {
        await Logger.info("適用可能なプリセットがありません");
        return { applied: false, reason: "no_presets" };
      }
      
      // 指定されたIDのプリセットを検索
      const defaultPreset = presets.find(preset => preset.id === settings.defaultPresetId);
      
      if (!defaultPreset) {
        await Logger.warn(`指定されたプリセットID "${settings.defaultPresetId}" が見つかりません`);
        return { applied: false, reason: "preset_not_found", presetId: settings.defaultPresetId };
      }
      
      await Logger.info("起動時適用プリセット:", defaultPreset);
      
      // 現在のウィンドウに適用
      const windows = await browser.windows.getAll();
      if (windows.length === 0) {
        await Logger.warn("適用可能なウィンドウがありません");
        return { applied: false, reason: "no_windows" };
      }
      
      const result = await applyPresetToWindow(windows[0].id, defaultPreset);
      
      await Logger.info("起動時プリセットを適用しました");
      return { applied: true, preset: defaultPreset, result };
    });
  } catch (error) {
    await Logger.error("起動時プリセット適用エラー:", error);
    return { applied: false, reason: "error", error: error.message };
  }
}

// ブラウザ起動時: 初期化し、起動時プリセットを1回だけ適用する
// （persistent: false のため、背景スクリプトの再読み込みでは実行されない）
browser.runtime.onStartup.addListener(async () => {
  try {
    await initialize();

    // 遅延実行してウィンドウの準備を待つ
    setTimeout(async () => {
      try {
        const result = await applyDefaultPresetIfNeeded();
        await Logger.info("起動時プリセット適用結果:", result);
      } catch (err) {
        await Logger.error("デフォルトプリセット適用エラー:", err);
      }
    }, 2500);
  } catch (err) {
    handleError('起動時処理', err);
  }
});

// プリセットの保存/削除通知を受けたときの処理
async function handlePresetsChanged(action) {
  // コンテキストメニューを更新
  await updateContextMenus();

  // 開いている設定ページへ通知
  const settingsTabs = await browser.tabs.query({
    url: browser.runtime.getURL('views/settings.html')
  });

  for (const tab of settingsTabs) {
    try {
      await browser.tabs.sendMessage(tab.id, {
        action: 'refreshSettings',
        source: action
      });
    } catch (err) {
      await Logger.warn(`設定ページへの通知エラー (タブID: ${tab.id}):`, err);
    }
  }
}

// メッセージリスナー
// 応答は Promise を返す方式に統一する。自分が扱わないメッセージには undefined を返し、
// 他のコンテキスト（設定ページなど）のリスナーの応答を妨げない。
browser.runtime.onMessage.addListener((request) => {
  Logger.info('メッセージを受信[background.js]:', request);

  switch (request.action) {
    case 'applyPreset':
      return applyPresetWithOptions(request.preset, request.detachTab === true, request.windowId);
    case 'openUrlWithPreset':
      // 履歴サイドバーなどから「URLを別ウィンドウで開く」依頼
      return openLinkInNewWindowWithPreset(request.url, request.preset, request.windowId);
    case 'openSettingsPage':
      return openSettingsPage();
    case 'presetSaved':
    case 'presetDeleted':
      return handlePresetsChanged(request.action);
    default:
      return undefined;
  }
});

// インストール時・アップデート時（一時的な読み込み含む）に初期化する
browser.runtime.onInstalled.addListener(async () => {
  try {
    await initialize();
  } catch (err) {
    handleError('インストール処理', err);
  }
});


// コンテキストメニューがクリックされたときの処理
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "open-settings") {
      openSettingsPage();
      return;
    }

    if (info.menuItemId === "open-history-sidebar") {
      // sidebarAction.open() はユーザー操作の直後（await の前）に呼ぶ必要がある
      await browser.sidebarAction.open();
      return;
    }
    
    // プリセットメニューがクリックされた場合
    if (info.menuItemId.startsWith("preset-")) {
      await handlePresetContextMenu(info, tab);
    } else if (info.menuItemId.startsWith("dup-")) {
      await handleDuplicateContextMenu(info, tab);
    }
  } catch (error) {
    await Logger.error('コンテキストメニュークリックエラー:', error);
  }
});

/**
 * プリセット用コンテキストメニューの処理
 * @param {Object} info - メニュー情報
 * @param {Object} tab - タブ情報
 */
async function handlePresetContextMenu(info, tab) {
  try {
    const parsed = parsePresetMenuItemId(info.menuItemId);
    if (!parsed) {
      await Logger.error('無効なメニューID:', info.menuItemId);
      return;
    }

    // プリセットを取得（メニューIDのキーはプリセットID。並べ替え直後でも正しいプリセットを指す）
    const presets = await FwrStore.getPresets();
    const preset = findPresetByMenuKey(presets, parsed.key);
    if (!preset) {
      await Logger.error('メニューに対応するプリセットが見つかりません:', parsed.key);
      return;
    }

    const contextType = parsed.context; // "link", "page", "tab", "bookmark"
    await Logger.info(`コンテキストメニューからプリセット適用: ${preset.name} (コンテキスト: ${contextType})`);

    if (contextType === 'link') {
      // URLリンクの場合：リンクURLを新しいウィンドウで開いてプリセット適用
      await openLinkInNewWindowWithPreset(info.linkUrl, preset, tab ? tab.windowId : null);
    } else if (contextType === 'bookmark') {
      // ブックマークの場合：ブックマークのURLを新しいウィンドウで開いてプリセット適用
      if (!info.bookmarkId) {
        await Logger.error('ブックマークIDが取得できませんでした');
        return;
      }
      const [bookmark] = await browser.bookmarks.get(info.bookmarkId);
      if (!bookmark || !bookmark.url) {
        await Logger.warn('URLを持たないブックマーク項目（フォルダ等）のため処理をスキップします');
        return;
      }
      await openLinkInNewWindowWithPreset(bookmark.url, preset, tab ? tab.windowId : null);
    } else {
      // ページ背景・タブの場合：現在のタブを別ウィンドウ化してプリセット適用
      await applyPresetWithOptions(preset, true, tab.windowId, tab.id);
    }
    
  } catch (error) {
    await Logger.error('プリセットコンテキストメニュー処理エラー:', error);
  }
}

/**
 * 複製用コンテキストメニューの処理（タブを複製し、複製側を別ウィンドウに移動してプリセット適用）
 * @param {Object} info - メニュー情報
 * @param {Object} tab - 右クリックされたタブ情報
 */
async function handleDuplicateContextMenu(info, tab) {
  try {
    const parsed = parsePresetMenuItemId(info.menuItemId);
    if (!parsed) {
      await Logger.error('無効なメニューID:', info.menuItemId);
      return;
    }

    const presets = await FwrStore.getPresets();
    const preset = findPresetByMenuKey(presets, parsed.key);
    if (!preset) {
      await Logger.error('メニューに対応するプリセットが見つかりません:', parsed.key);
      return;
    }

    await Logger.info(`複製して別ウィンドウで開く: ${preset.name} (コンテキスト: ${parsed.context}, タブID: ${tab.id})`);

    // 元のタブはそのまま残し、複製したタブを別ウィンドウに移動する
    const duplicatedTab = await browser.tabs.duplicate(tab.id);
    await applyPresetWithOptions(preset, true, tab.windowId, duplicatedTab.id);
  } catch (error) {
    await Logger.error('複製コンテキストメニュー処理エラー:', error);
  }
}

// エラーハンドリング関数
async function handleError(context, error) {
  await Logger.error(`${context}エラー:`, error);
  // エラー通知やリカバリー処理などもここで一元管理できる
}
