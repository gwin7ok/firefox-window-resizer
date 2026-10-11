// コンテキストメニュー（作成・更新・クリック処理）。
// イベントリスナーの登録は background.js 側で行う（イベントページの起動時に同期登録するため）。
// 依存: logger.js / store.js / window-actions.js（読み込み順は manifest.json の background.scripts を参照）

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
 * コンテキストメニューがクリックされたときの処理（browser.contextMenus.onClicked のリスナー）
 * 注意: sidebarAction.open() はユーザー操作の直後（await の前）に呼ぶ必要がある。
 * @param {Object} info - メニュー情報
 * @param {Object} tab - タブ情報
 */
async function handleMenuClick(info, tab) {
  try {
    if (info.menuItemId === "open-settings") {
      await openSettingsPage();
      return;
    }

    if (info.menuItemId === "open-history-sidebar") {
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
}

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
