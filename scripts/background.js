// 設定値を集約するCONFIGオブジェクト
const CONFIG = {
  // ウィンドウのデフォルト設定
  DEFAULT_WIDTH: 1280,
  DEFAULT_HEIGHT: 720,
  DEFAULT_LEFT: 0,
  DEFAULT_TOP: 0,
  
  // プリセット関連
  DEFAULT_PRESET_NAME: "default",
  APPLY_DEFAULT_PRESET_ON_STARTUP: true, // trueに変更：設定によって内部制御する方式に
  
  // キャッシュ設定
  CACHE_LIFETIME_MS: 60000, // キャッシュの有効期間: 1分
  
  // ストレージキー
  SYSTEM_DPR_STORAGE_KEY: 'systemDpr',
  
  // デバッグレベル設定
  DEBUG_LEVEL: {
    NONE: 0,    // 重要なメッセージのみ
    ERROR: 1,   // エラーも表示
    WARN: 2,    // 警告も表示
    INFO: 3,    // 情報も表示
    DEBUG: 4    // すべて表示
  },
  
  // デフォルトのデバッグレベル
  DEFAULT_DEBUG_LEVEL: 3, // INFO
  
  // 設定のデフォルト値
  DEFAULT_SETTINGS: {
    defaultPresetId: null  // ブラウザ起動時に適用するプリセットID
  },
  
  // デフォルトプリセット
  DEFAULT_PRESETS: [
    {
      name: "新規プリセット",
      width: 1024,
      height: 768,
      left: 0,
      top: 0
    }
  ]
};

// 既存の定数をCONFIG値に置き換え
const DEFAULT_WIDTH = CONFIG.DEFAULT_WIDTH;
const DEFAULT_HEIGHT = CONFIG.DEFAULT_HEIGHT;
const DEFAULT_PRESET_NAME = CONFIG.DEFAULT_PRESET_NAME;
const SYSTEM_DPR_STORAGE_KEY = CONFIG.SYSTEM_DPR_STORAGE_KEY;
const APPLY_DEFAULT_PRESET_ON_STARTUP = CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP;

// 既存の配列・オブジェクト定数を更新
const DEFAULT_PRESETS = CONFIG.DEFAULT_PRESETS;
const DEFAULT_SETTINGS = CONFIG.DEFAULT_SETTINGS;
const DEBUG_LEVEL = CONFIG.DEBUG_LEVEL;
const CURRENT_DEBUG_LEVEL = CONFIG.DEFAULT_DEBUG_LEVEL;

// デバッグ情報表示を改善
async function showDebugInfo() {

  // まず DPR 情報を非同期で取得・表示し、完了を待機
  await showDprInfo();

  // DPR処理完了後に、プリセット情報を取得・表示
  await showPresetInfo();
}

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
      const data = await browser.storage.local.get('presets');
      const presets = Array.isArray(data.presets) ? data.presets : [];

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

// デバッグログを有効化
browser.storage.local.get('debug').then(async data => {
  const isDebugMode = data.debug === true;

  // デバッグモードが有効なら標準のconsoleメソッドを使用
  if (isDebugMode) {
    await Logger.info('デバッグモード有効: ログ出力を行います');
    return;
  }

  // デバッグモード無効の場合は何もしない関数に置き換え
  const noop = function () { };

  // 重要なエラーメッセージはそのまま出力
  const originalError = console.error;
  const originalWarn = console.warn;


}).catch(async err => {
  await Logger.error('デバッグ設定の読み込み中にエラーが発生しました:', err);
});

// デバッグモード切替機能

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
    const data = await browser.storage.local.get('presets');
    const presets = Array.isArray(data.presets) ? data.presets : [];
    
    if (presets.length === 0) {
      await Logger.info('プリセットがないためコンテキストメニューは作成されません');
      return;
    }
    
    // メインメニューを作成（URLリンク、Webページ背景、タブ用）
    const contexts = ["link", "page", "tab"];
    
    for (const context of contexts) {
      // 親メニューを作成
      const parentId = `fwr-${context}`;
      browser.contextMenus.create({
        id: parentId,
        title: "Firefox Window Resizer",
        contexts: [context]
      });
      
      // プリセットのサブメニューを作成
      presets.forEach((preset, index) => {
        const menuId = `preset-${context}-${index}`;
        browser.contextMenus.create({
          id: menuId,
          parentId: parentId,
          title: preset.name.replace(/\n/g, ' '), // 改行を空白に変換
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
 * 拡張機能の初期化処理
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    return await Logger.logSystemOperation('拡張機能初期化', async () => {
      await Logger.info('拡張機能を初期化します');
      
      // アイコン設定
      try {
        await browser.browserAction.setIcon({
          path: {
            16: "../assets/icons/icon-16.png",
            32: "../assets/icons/icon-32.png",
            48: "../assets/icons/icon-48.png",
          }
        });
        await Logger.info("アイコンを設定しました");
      } catch (error) {
        await Logger.error("アイコン設定エラー:", error);
      }
      
      // コンテキストメニュー設定
      try {
        await createContextMenus();
        await Logger.info("コンテキストメニューを作成しました");
      } catch (error) {
        await Logger.error("コンテキストメニュー作成エラー:", error);
      }
      
      // DPR設定の確認
      await showDprInfo();
      
      // ストレージをチェックし、初期データがなければ設定
      const data = await browser.storage.local.get(['presets', 'settings']);

      if (!data.presets) {
        await browser.storage.local.set({ presets: DEFAULT_PRESETS });
        await Logger.info("デフォルトプリセットを初期化しました");
      } else {
        // プリセット一覧を表示（デバッグ用）
        await showPresetInfo();
      }

      if (!data.settings) {
        await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
        await Logger.info("デフォルト設定を初期化しました");
      } else {
        // 設定ログ出力を追加（デバッグ用）
        await Logger.info("現在の設定:", data.settings);
        if (data.settings.defaultPresetId) {
          await Logger.info(`起動時適用プリセットID: ${data.settings.defaultPresetId}`);
        } else {
          await Logger.info("起動時適用プリセットは設定されていません");
        }
      }

      // CONFIG状態の確認と補正
      if (data.settings && data.settings.defaultPresetId) {
        CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP = true;
        await Logger.info("CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP を true に設定しました");
      } else {
        CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP = false;
        await Logger.info("CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP を false に設定しました");
      }

      // DPR設定を初期化
      await browser.storage.local.get(SYSTEM_DPR_STORAGE_KEY).then(async item => {
        if (item[SYSTEM_DPR_STORAGE_KEY] === undefined) {
          await Logger.info('DPR設定を初期化します');
          await browser.storage.local.set({ [SYSTEM_DPR_STORAGE_KEY]: 100 });
        }
      });

      // デフォルトプリセットを初期化
      await browser.storage.local.get(DEFAULT_PRESET_NAME).then(async item => {
        if (!item[DEFAULT_PRESET_NAME]) {
          await Logger.info('デフォルトプリセットを初期化します');
          const defaultPreset = {
            name: DEFAULT_PRESET_NAME,
            width: DEFAULT_WIDTH,
            height: DEFAULT_HEIGHT
          };
          await browser.storage.local.set({ [DEFAULT_PRESET_NAME]: defaultPreset });
        }
      });

      // 起動時のプリセット適用が有効な場合は実行
      await Logger.info("起動時のデフォルトプリセット適用実行フラグ:", CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP);
      if (CONFIG.APPLY_DEFAULT_PRESET_ON_STARTUP) {
        await Logger.info("起動時のデフォルトプリセット適用を開始します");
        
        // 遅延実行して安定化を図る（遅延を少し長めに）
        setTimeout(async () => {
          try {
            await Logger.info("遅延タイマー完了。プリセット適用を開始");
            const result = await applyDefaultPresetIfNeeded();
            await Logger.info("起動時プリセット適用結果:", result);
          } catch (err) {
            await Logger.error("デフォルトプリセット適用エラー:", err);
          }
        }, 2500);
      } else {
        await Logger.info("起動時のデフォルトプリセット適用はスキップしました");
      }
      
      await Logger.info('拡張機能の初期化が完了しました');
    });
  } catch (error) {
    await Logger.error("初期化エラー:", error);
  }
}

// 設定関連の処理を強化

// 設定からDPR値を取得する関数 - キャッシュ機能追加
let cachedDpr = null;

async function getSystemDpr(callback) {
  try {
    // キャッシュがあればそれを使用
    if (cachedDpr !== null) {
      if (callback) {
        callback(cachedDpr * 100);
      }
      return cachedDpr;
    }

    // 戻り値を格納する変数
    let resultDpr;

    await Logger.logDprOperation('読み込み', async () => {
      await Logger.info('storage.localからDPR設定を取得中...');

      const data = await browser.storage.local.get('systemDpr');

      await Logger.info('取得したDPR設定データ:', data);

      const percentValue = data.systemDpr !== undefined ? data.systemDpr : 100;
      const dprValue = percentValue / 100;

      await Logger.info(`システム拡大率設定: ${percentValue}% (DPR: ${dprValue})`);

      // キャッシュに保存
      cachedDpr = dprValue;
      // 戻り値を格納
      resultDpr = dprValue;



      if (callback) {
        callback(percentValue);
      }

    });

    // 最後に確実に値を返す
    return resultDpr || 1.0;
  } catch (err) {
    await Logger.error('DPR設定読み込みエラー:', err);
    return 1.0; // エラー時のデフォルト値
  }
}

// キャッシュをクリアする関数
async function clearDprCache() {
  cachedDpr = null;
  await Logger.info('DPR設定キャッシュをクリアしました');
}

// 論理⇔物理ピクセル変換用のユーティリティ関数

// 論理ピクセルから物理ピクセルへの変換
async function logicalToPhysical(logicalValue) {
  const dpr = await getSystemDpr();
  return Math.round(logicalValue * dpr);
}

// 物理ピクセルから論理ピクセルへの変換
async function physicalToLogical(physicalValue) {
  const dpr = await getSystemDpr();
  return Math.round(physicalValue / dpr);
}

// バッチ変換（オブジェクト全体を一度に変換）
async function convertLogicalToPhysical(logicalObj) {
  const dpr = await getSystemDpr();
  return {
    width: Math.round(logicalObj.width * dpr),
    height: Math.round(logicalObj.height * dpr),
    left: Math.round(logicalObj.left * dpr),
    top: Math.round(logicalObj.top * dpr),
    dpr: dpr
  };
}

async function convertPhysicalToLogical(physicalObj) {
  const dpr = await getSystemDpr();
  return {
    width: Math.round(physicalObj.width / dpr),
    height: Math.round(physicalObj.height / dpr),
    left: Math.round(physicalObj.left / dpr),
    top: Math.round(physicalObj.top / dpr),
    dpr: dpr
  };
}

// 物理ピクセル値を論理ピクセル値に変換
async function convertToLogical(physicalWidth, physicalHeight) {
  const dprFactor = await getSystemDpr();
  const logicalWidth = Math.round(physicalWidth / dprFactor);
  const logicalHeight = Math.round(physicalHeight / dprFactor);
  return { width: logicalWidth, height: logicalHeight };
}

// 論理ピクセル値を物理ピクセル値に変換
async function convertToPhysical(logicalWidth, logicalHeight) {
  const dprFactor = await getSystemDpr();
  const physicalWidth = Math.round(logicalWidth * dprFactor);
  const physicalHeight = Math.round(logicalHeight * dprFactor);
  return { width: physicalWidth, height: physicalHeight };
}

/**
 * 物理ピクセル値を論理ピクセル値に変換する
 * @param {Object} physicalValues - 物理ピクセル値 (width, height, left, top)
 * @param {number} [dpr] - 使用するDPR値（指定なしの場合は取得）
 * @returns {Promise<Object>} 論理ピクセル値とテーブル出力
 */
async function convertToLogicalPixels(physicalValues, dpr = null) {
  // DPR値が指定されていない場合は取得
  if (dpr === null) {
    dpr = await getSystemDpr();
  }
  
  // 変換処理
  const result = {
    width: Math.round(physicalValues.width / dpr),
    height: Math.round(physicalValues.height / dpr),
    left: Math.round(physicalValues.left / dpr),
    top: Math.round(physicalValues.top / dpr)
  };
  
  // ログ用テーブル（オプション）
  const tableData = {
    幅: { 元値: physicalValues.width, 計算式: `${physicalValues.width} / ${dpr}`, 変換後: result.width },
    高さ: { 元値: physicalValues.height, 計算式: `${physicalValues.height} / ${dpr}`, 変換後: result.height },
    左位置: { 元値: physicalValues.left, 計算式: `${physicalValues.left} / ${dpr}`, 変換後: result.left },
    上位置: { 元値: physicalValues.top, 計算式: `${physicalValues.top} / ${dpr}`, 変換後: result.top }
  };
  
  return { 
    values: result, 
    tableData: tableData,
    dpr: dpr
  };
}

/**
 * 論理ピクセル値を物理ピクセル値に変換する
 * @param {Object} logicalValues - 論理ピクセル値 (width, height, left, top)
 * @param {number} [dpr] - 使用するDPR値（指定なしの場合は取得）
 * @returns {Promise<Object>} 物理ピクセル値とテーブル出力
 */
async function convertToPhysicalPixels(logicalValues, dpr = null) {
  // DPR値が指定されていない場合は取得
  if (dpr === null) {
    dpr = await getSystemDpr();
  }
  
  // 変換処理
  const result = {
    width: Math.round(logicalValues.width * dpr),
    height: Math.round(logicalValues.height * dpr),
    left: Math.round(logicalValues.left * dpr),
    top: Math.round(logicalValues.top * dpr)
  };
  
  // ログ用テーブル（オプション）
  const tableData = {
    幅: { 元値: logicalValues.width, 計算式: `${logicalValues.width} * ${dpr}`, 変換後: result.width },
    高さ: { 元値: logicalValues.height, 計算式: `${logicalValues.height} * ${dpr}`, 変換後: result.height },
    左位置: { 元値: logicalValues.left, 計算式: `${logicalValues.left} * ${dpr}`, 変換後: result.left },
    上位置: { 元値: logicalValues.top, 計算式: `${logicalValues.top} * ${dpr}`, 変換後: result.top }
  };
  
  return { 
    values: result, 
    tableData: tableData,
    dpr: dpr
  };
}

// 内部実装（共通コア機能）- 直接呼び出しは想定しない
async function _applyPresetInternal(windowId, preset, operationName) {
  try {
    return await Logger.logPresetOperation(operationName || `"${preset.name}" を適用`, async () => {
      // 1. 元のプリセット値を出力
      await Logger.info("1. 元のプリセット値:", {
        width: preset.width,
        height: preset.height,
        left: preset.left,
        top: preset.top,
      });

      // 2. DPRの取得（非同期処理）
      const dpr = await getSystemDpr();
      await Logger.info(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);

      // 3. 変換計算
      const logicalWidth = Math.round(preset.width / dpr);
      const logicalHeight = Math.round(preset.height / dpr);
      const logicalLeft = Math.round(preset.left / dpr);
      const logicalTop = Math.round(preset.top / dpr);

      await Logger.info("3. 物理ピクセル値をDPRで割って論理ピクセル値に変換");

      // テーブル出力
      await Logger.table({
        幅: { 元値: preset.width, 計算式: `${preset.width} / ${dpr}`, 変換後: logicalWidth },
        高さ: { 元値: preset.height, 計算式: `${preset.height} / ${dpr}`, 変換後: logicalHeight },
        左位置: { 元値: preset.left, 計算式: `${preset.left} / ${dpr}`, 変換後: logicalLeft },
        上位置: { 元値: preset.top, 計算式: `${preset.top} / ${dpr}`, 変換後: logicalTop }
      });

      // 4. ウィンドウに適用
      const finalValues = {
        width: logicalWidth,
        height: logicalHeight,
        left: logicalLeft,
        top: logicalTop
      };

      await Logger.info("4. ウィンドウに適用する最終値:", finalValues);
      await Logger.info(`対象ウィンドウID: ${windowId}`);

      // ブラウザAPIに渡す
      const result = await browser.windows.update(windowId, finalValues);

      // 変更点: 結果オブジェクトを単純化してから出力
      const simplifiedResult = {
        id: result.id,
        width: result.width,
        height: result.height,
        left: result.left,
        top: result.top,
        type: result.type,
        state: result.state
      };

      // 5. 適用結果
      await Logger.info("5. 適用結果:", simplifiedResult);

      return { success: true, result: simplifiedResult };
    });
  } catch (error) {
    await Logger.error('プリセット適用エラー:', error);
    throw error;
  }
}

/**
 * プリセットに基づいてウィンドウサイズを適用する統合関数
 * @param {Object} preset - 適用するプリセット
 * @param {boolean} detachTab - 現在のタブを別ウィンドウに分離するかどうか
 * @param {number} targetWindowId - 対象ウィンドウID（指定がない場合は現在のウィンドウ）
 * @returns {Promise<Object>} 適用結果
 */
async function applyPresetWithOptions(preset, detachTab = false, targetWindowId = null) {
  try {
    const title = detachTab 
      ? `"${preset.name}" を適用（タブ分離モード）` 
      : `"${preset.name}" を適用`;
    
    return await Logger.logPresetOperation(title, async () => {
      // 1. 対象ウィンドウIDの決定
      const windowId = targetWindowId || await getCurrentWindowId();
      await Logger.info(`対象ウィンドウID: ${windowId} (${targetWindowId ? '指定' : '自動取得'})`);
      
      // 2. タブ分離モードの場合は対象ウィンドウのアクティブタブを取得
      
      // タブ分離モードの場合は現在のタブを取得
      let activeTab = null;
      if (detachTab) {
        const tabs = await browser.tabs.query({ active: true, windowId });
        
        if (!tabs || tabs.length === 0) {
          throw new Error('アクティブなタブが見つかりませんでした');
        }
        
        activeTab = tabs[0];
        await Logger.info(`選択中のタブ: "${activeTab.title}" (ID: ${activeTab.id})`);
      }
      
      // 1. 元のプリセット値を出力
      await Logger.info("1. 元のプリセット値:", {
        width: preset.width,
        height: preset.height,
        left: preset.left,
        top: preset.top,
      });

      // 2. DPRの取得（非同期処理）
      const dpr = await getSystemDpr();
      await Logger.info(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);

      // 3. 新しい変換関数を使用して物理→論理変換
      const physicalValues = {
        width: preset.width,
        height: preset.height,
        left: preset.left,
        top: preset.top
      };
      
      await Logger.info("3. 物理ピクセル値をDPRで割って論理ピクセル値に変換");
      const conversion = await convertToLogicalPixels(physicalValues, dpr);
      
      // テーブル出力
      await Logger.table(conversion.tableData);
      
      // 論理値を取得
      const logicalValues = conversion.values;
      
      let result;
      
      // タブ分離モードによって処理を分岐
      if (detachTab) {
        // タブ分離モード: 空のウィンドウを作成してタブを移動
        await Logger.info(`4. タブ "${activeTab.title}" を新しいウィンドウに分離して適用`);
        await Logger.info(`対象タブID: ${activeTab.id}`);
        
        // 1. まず空のウィンドウを作成（about:blankで）
        const windowCreateValues = {
          ...logicalValues,
          url: "about:blank"  // 空のウィンドウを作成
        };
        
        await Logger.info("新しい空のウィンドウを作成する値:", windowCreateValues);
        
        const newWindow = await browser.windows.create(windowCreateValues);
        await Logger.info("新しい空のウィンドウを作成しました:", { 
          id: newWindow.id, 
          left: newWindow.left, 
          top: newWindow.top,
          width: newWindow.width,
          height: newWindow.height 
        });
        
        // 2. 現在のタブを新しいウィンドウに移動（状態を保持）
        await Logger.info(`タブ ${activeTab.id} を新しいウィンドウ ${newWindow.id} に移動中...`);
        const movedTab = await browser.tabs.move(activeTab.id, {
          windowId: newWindow.id,
          index: 0  // 最初の位置に移動
        });
        await Logger.info("タブの移動が完了しました:", { 
          tabId: movedTab[0].id, 
          windowId: movedTab[0].windowId 
        });
        
        // 3. 新しいウィンドウの空のタブ（about:blank）を削除
        const newWindowTabs = await browser.tabs.query({ windowId: newWindow.id });
        const blankTab = newWindowTabs.find(tab => tab.url === "about:blank" && tab.id !== movedTab[0].id);
        if (blankTab) {
          await Logger.info(`空のタブ ${blankTab.id} を削除中...`);
          await browser.tabs.remove(blankTab.id);
        }
        
        // 4. 座標がずれている場合は再調整
        if (newWindow.left !== windowCreateValues.left || newWindow.top !== windowCreateValues.top) {
          await Logger.warn("座標がずれました。再調整中...");
          await Logger.info("期待値:", { left: windowCreateValues.left, top: windowCreateValues.top });
          await Logger.info("実際値:", { left: newWindow.left, top: newWindow.top });
          
          // 再度位置を調整
          const correctedWindow = await browser.windows.update(newWindow.id, {
            left: windowCreateValues.left,
            top: windowCreateValues.top
          });
          await Logger.info("再調整後:", { left: correctedWindow.left, top: correctedWindow.top });
          result = correctedWindow;
        } else {
          result = newWindow;
        }
      } else {
        // 通常モード: 既存ウィンドウを更新
        await Logger.info("4. ウィンドウに適用する最終値:", logicalValues);
        await Logger.info(`対象ウィンドウID: ${windowId}`);
        
        result = await browser.windows.update(windowId, logicalValues);
      }

      // 結果オブジェクトを単純化
      const simplifiedResult = {
        id: result.id,
        width: result.width,
        height: result.height,
        left: result.left,
        top: result.top,
        type: result.type,
        state: result.state,
        detached: detachTab // タブ分離情報を追加
      };
      
      // 5. 適用結果
      await Logger.info("5. 適用結果:", simplifiedResult);
      
      return { success: true, result: simplifiedResult };
    });
  } catch (error) {
    const errorType = detachTab ? 'タブ分離' : 'プリセット適用';
    await Logger.error(`${errorType}エラー:`, error);
    throw error;
  }
}

// 現在のウィンドウにプリセットを適用（ポップアップUIなどから呼ばれる）
async function applyPreset(preset) {
  try {
    return await applyPresetWithOptions(preset, false);
  } catch (error) {
    await Logger.error('現在ウィンドウへのプリセット適用エラー:', error);
    throw error;
  }
}

// 現在のタブを別ウィンドウに独立させてプリセットを適用する関数
async function detachCurrentTabWithPreset(preset) {
  try {
    return await applyPresetWithOptions(preset, true);
  } catch (error) {
    await Logger.error('タブ分離エラー:', error);
    throw error;
  }
}

// 指定のウィンドウにプリセットを適用（起動時適用などから呼ばれる）
async function applyPresetToWindow(windowId, preset) {
  try {
    const operationName = `"${preset.name}" をウィンドウ ${windowId} に適用`;
    return await _applyPresetInternal(windowId, preset, operationName);
  } catch (error) {
    await Logger.error(`ウィンドウ ${windowId} へのプリセット適用エラー:`, error);
    handleError('プリセット適用', error);
    throw error;
  }
}

// 設定ページを開く関数
async function openSettingsPage() {
  await Logger.logSystemOperation('設定ページを開く', async () => {
    await Logger.info('設定ページを開きます');

    // 既存の設定タブを検索
    let settingsTab = null;
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.includes('views/settings.html')) {
        settingsTab = tab;
        break;
      }
    }

    if (settingsTab) {
      // 既存の設定タブがある場合は、それをアクティブにする
      browser.tabs.update(settingsTab.id, { active: true });
    } else {
      // 既存の設定タブがない場合は、新しいタブで開く
      browser.tabs.create({ url: 'views/settings.html' });
    }
  });
}

// ウィンドウ情報を取得（ウィンドウID指定対応バージョン）
async function getCurrentWindowInfo(windowId = null) {
  try {
    await Logger.logWindowOperation("ウィンドウ情報取得", async () => {
      // 1. 対象ウィンドウを取得
      const win = windowId 
        ? await browser.windows.get(windowId, { populate: true })
        : await browser.windows.getCurrent({ populate: true });
      
      await Logger.info(`1. 対象ウィンドウ情報 (ID: ${win.id}):`, win);
      await Logger.info("1. ブラウザから取得したウィンドウ情報:", win);

      // 2. ユーザー設定のDPR値を取得
      const dpr = await getSystemDpr();
      await Logger.info(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);

      // 3. 論理ピクセル値（ブラウザから取得した値）
      const logical = {
        width: win.width,
        height: win.height,
        left: win.left,
        top: win.top
      };

      // 4. 新しい共通関数を使用して物理ピクセル値に変換
      const conversion = await convertToPhysicalPixels(logical, dpr);
      const physical = conversion.values;

      // 5. 結果を出力
      await Logger.info("3. 最終的なウィンドウ情報:", {
        論理ピクセル値: logical,
        物理ピクセル値: physical,
        DPR: dpr,
        拡大率: `${dpr * 100}%`
      });
    });

    // ウィンドウを取得し直す（グループ外に移動）
    const win = await browser.windows.getCurrent({ populate: true });
    const dpr = await getSystemDpr();

    const logical = {
      width: win.width,
      height: win.height,
      left: win.left,
      top: win.top
    };

    // 新しい共通関数を使用
    const conversion = await convertToPhysicalPixels(logical, dpr);
    const physical = conversion.values;

    return {
      // 論理ピクセル値
      width: logical.width,
      height: logical.height,
      left: logical.left,
      top: logical.top,

      // 物理ピクセル値
      physicalWidth: physical.width,
      physicalHeight: physical.height,
      physicalLeft: physical.left,
      physicalTop: physical.top,

      // DPR情報
      dpr: dpr,
      dprPercent: dpr * 100
    };
  } catch (error) {
    await Logger.error("ウィンドウ情報取得エラー:", error);

    // エラー時のフォールバック
    return {
      width: CONFIG.DEFAULT_WIDTH, 
      height: CONFIG.DEFAULT_HEIGHT, 
      left: CONFIG.DEFAULT_LEFT, 
      top: CONFIG.DEFAULT_TOP,
      dpr: 1.0, 
      dprPercent: 100,
      physicalWidth: CONFIG.DEFAULT_WIDTH, 
      physicalHeight: CONFIG.DEFAULT_HEIGHT,
      physicalLeft: CONFIG.DEFAULT_LEFT, 
      physicalTop: CONFIG.DEFAULT_TOP
    };
  }
}

// ブラウザ起動時のデフォルトプリセット適用
async function applyDefaultPresetIfNeeded() {
  try {
    return await Logger.logSystemOperation('起動時プリセット適用', async () => {
      // 設定とプリセットを取得
      const data = await browser.storage.local.get(['presets', 'settings']);
      const { settings, presets } = data;
      
      // 設定チェック
      if (!settings || settings.defaultPresetId === null) {
        await Logger.info("起動時のプリセット適用は無効化されています");
        return { applied: false, reason: "disabled" };
      }
      
      if (!Array.isArray(presets) || presets.length === 0) {
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

// プリセットを保存（統一DPR版）
async function savePreset(preset) {
  try {
    await Logger.logPresetOperation(`プリセット保存: "${preset.name}"`, async () => {
      await Logger.info('プリセット保存を開始します');

      // 既存コード（プリセット保存処理）
      const data = await browser.storage.local.get('presets');
      let presets = data.presets || [];

      // 既存のプリセットの編集の場合
      const existingIndex = presets.findIndex(p => p.id === preset.id);

      if (existingIndex >= 0) {
        presets[existingIndex] = preset;
      } else {
        // 新規プリセットの場合
        preset.id = Date.now().toString();
        presets.push(preset);
      }

      await browser.storage.local.set({ presets });
      await Logger.info("保存したプリセット:", preset);

      return presets;
    });
  } catch (error) {
    handleError('プリセット保存', error);
    throw error; // 必要に応じて再スロー
  }
}

// 現在のウィンドウIDを取得
async function getCurrentWindowId() {
  const win = await browser.windows.getCurrent();
  return win.id;
}

// プリセットを取得する関数
async function getPresets() {
  try {
    const data = await browser.storage.local.get('presets');
    return Array.isArray(data.presets) ? data.presets : [];
  } catch (error) {
    handleError('プリセット取得', error);
    return [];
  }
}

// 拡張機能の起動時に設定値を確認
browser.runtime.onStartup.addListener(async () => {
  try {
    // DPR設定の確認
    const dpr = await getSystemDpr();
    await Logger.info(`拡張機能起動: 設定されているDPR値は ${dpr} (拡大率: ${dpr * 100}%)`);

    // DPRが1.0でない場合は特別にログを出力
    if (dpr !== 1.0) {
      await Logger.info(`注意: 標準設定(100%)と異なる拡大率が設定されています。論理/物理ピクセル変換が有効です。`);
    }
  } catch (err) {
    handleError('起動時の設定チェック', err);
  }
});

// ストレージ変更検知
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.systemDpr) {
    await Logger.info('ストレージ変更検知:', changes.systemDpr);
    await Logger.info(`DPR設定変更: ${changes.systemDpr.oldValue || '未設定'} -> ${changes.systemDpr.newValue}%`);
    await clearDprCache(); // キャッシュをクリア
    await getSystemDpr();
  }
});

// メッセージリスナーを修正
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  await Logger.info('メッセージを受信[background.js]:', request);

  if (request.action === 'applyPreset') {
    const detachTab = request.detachTab === true;
    const targetWindowId = request.windowId; // 送信元ウィンドウIDを取得
    await Logger.info(`プリセット適用: 対象ウィンドウID ${targetWindowId}`);
    await applyPresetWithOptions(request.preset, detachTab, targetWindowId);
  } else if (request.action === 'openSettingsPage') {
    openSettingsPage();
  } else if (request.action === 'getSystemDpr') {
    getSystemDpr(sendResponse);
    return true;  // 非同期レスポンスを維持
  } else if (request.action === 'getCurrentWindowInfo') {
    const targetWindowId = request.windowId;
    await Logger.info(`現在のウィンドウ情報取得: 対象ウィンドウID ${targetWindowId}`);
    const windowInfo = await getCurrentWindowInfo(targetWindowId);
    sendResponse(windowInfo);
    return true;  // 非同期レスポンスを維持
  } else if (request.action === 'presetSaved' || request.action === 'presetDeleted') {
    // プリセットが保存/削除された時にコンテキストメニューを更新
    await updateContextMenus();
    
    // プリセットが保存/削除された時に、開いている設定ページへ通知
    const settingsTabs = await browser.tabs.query({
      url: browser.runtime.getURL('views/settings.html')
    });
    
    // 各設定ページタブに更新を通知
    for (const tab of settingsTabs) {
      try {
        await browser.tabs.sendMessage(tab.id, {
          action: 'refreshSettings',
          source: request.action
        });
      } catch (err) {
        await Logger.warn(`設定ページへの通知エラー (タブID: ${tab.id}):`, err);
      }
    }
  }
});

// インストール時またはアップデート時の処理を修正
browser.runtime.onInstalled.addListener(async (details) => {
  // まずイベントリスナーの即時処理部分を最小化
  const reason = details.reason;

  // setTimeout を使って処理を遅延させる
  setTimeout(async () => {

    try {
      return await Logger.logSystemOperation('インストールまたはアップデート', async () => {

        if (reason === 'install') {
          await Logger.info('初めてのインストールです');
          // 初めてインストールされたときの処理
          await browser.storage.local.set({ defaultPresetName: DEFAULT_PRESET_NAME });
        } else if (reason === 'update') {
          await Logger.info('アップデートしました');
          // アップデートされたときの処理
        }

        // プリセットを初期化
        await browser.storage.local.get(DEFAULT_PRESET_NAME).then(async item => {
          if (!item[DEFAULT_PRESET_NAME]) {
            await Logger.info('デフォルトプリセットを初期化します');
            const defaultPreset = {
              name: DEFAULT_PRESET_NAME,
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT
            };
            await browser.storage.local.set({ [DEFAULT_PRESET_NAME]: defaultPreset });
          }
        });

        // 設定を初期化
        await browser.storage.local.get(SYSTEM_DPR_STORAGE_KEY).then(async item => {
          if (item[SYSTEM_DPR_STORAGE_KEY] === undefined) {
            await Logger.info('DPR設定を初期化します');
            await browser.storage.local.set({ [SYSTEM_DPR_STORAGE_KEY]: 100 });
          }
        });

      })
    } catch (err) {
      handleError('インストール処理', err);
    }
  }, 100)
})


// コンテキストメニューがクリックされたときの処理
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "open-settings") {
      openSettingsPage();
      return;
    }
    
    // プリセットメニューがクリックされた場合
    if (info.menuItemId.startsWith("preset-")) {
      await handlePresetContextMenu(info, tab);
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
    // メニューIDからプリセットインデックスを取得
    // 形式: "preset-{context}-{index}"
    const parts = info.menuItemId.split('-');
    if (parts.length < 3) {
      await Logger.error('無効なメニューID:', info.menuItemId);
      return;
    }
    
    const presetIndex = parseInt(parts[2]);
    if (isNaN(presetIndex)) {
      await Logger.error('無効なプリセットインデックス:', parts[2]);
      return;
    }
    
    // プリセットを取得
    const data = await browser.storage.local.get('presets');
    const presets = Array.isArray(data.presets) ? data.presets : [];
    
    if (presetIndex >= presets.length) {
      await Logger.error('プリセットインデックスが範囲外:', presetIndex);
      return;
    }
    
    const preset = presets[presetIndex];
    await Logger.info(`コンテキストメニューからプリセット適用: ${preset.name}`);
    
    // 別ウィンドウ化 + プリセット適用（detachTab=true固定）
    await applyPresetWithOptions(preset, true, tab.windowId);
    
  } catch (error) {
    await Logger.error('プリセットコンテキストメニュー処理エラー:', error);
  }
}

// エラーハンドリング関数
async function handleError(context, error) {
  await Logger.error(`${context}エラー:`, error);
  // エラー通知やリカバリー処理などもここで一元管理できる
}

// 拡張機能を初期化
initialize();