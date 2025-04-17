const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_PRESET_NAME = "default"; // DEFAULT_PRESET_NAME 変数を宣言
const SYSTEM_DPR_STORAGE_KEY = 'systemDpr';
const APPLY_DEFAULT_PRESET_ON_STARTUP = false; // 安定化までfalseに

// デバッグ情報表示を改善
async function showDebugInfo() {

  // まず DPR 情報を非同期で取得・表示し、完了を待機
  await showDprInfo();

  // DPR処理完了後に、プリセット情報を取得・表示
  await showPresetInfo();
}

// DPR情報表示関数
async function showDprInfo() {
  try {
    return await Logger.logDprOperation('システム設定確認', async () => {
      const data = await browser.storage.local.get('systemDpr');
      const systemDpr = data.systemDpr || 100;
      await Logger.info(`システム設定DPR: ${systemDpr}%（係数: ${systemDpr / 100}）`);
      return systemDpr;
    });
  } catch (err) {
    await Logger.error('DPR情報表示エラー:', err);
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



// プリセットの保存形式
const DEFAULT_PRESETS = [
  {
    name: "新規プリセット",
    width: 1024,
    height: 768,
    left: 0,
    top: 0
  }
];

// 設定のデフォルト値
const DEFAULT_SETTINGS = {
  defaultPresetId: null  // ブラウザ起動時に適用するプリセットID
};



// デバッグレベル設定
const DEBUG_LEVEL = {
  NONE: 0,    // 重要なメッセージのみ
  ERROR: 1,   // エラーも表示
  WARN: 2,    // 警告も表示
  INFO: 3,    // 情報も表示
  DEBUG: 4    // すべて表示
};

// 現在のデバッグレベル
const CURRENT_DEBUG_LEVEL = DEBUG_LEVEL.INFO;

// ロガー関数
const logger = {
  debug: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.DEBUG) Logger.debug(...args);
  },
  info: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.INFO) Logger.info(...args);
  },
  warn: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.WARN) Logger.warn(...args);
  },
  error: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.ERROR) Logger.error(...args);
  }
};

// 初期化処理
async function initialize() {
  try {
    // ストレージをチェックし、初期データがなければ設定
    const data = await browser.storage.local.get(['presets', 'settings']);

    if (!data.presets) {
      await browser.storage.local.set({ presets: DEFAULT_PRESETS });
      await Logger.info("デフォルトプリセットを初期化しました");
    }

    if (!data.settings) {
      await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
      await Logger.info("デフォルト設定を初期化しました");
    }

    // ※安全のため、起動時のプリセット適用はスキップ
    if (APPLY_DEFAULT_PRESET_ON_STARTUP) {
      // 遅延実行して安定化を図る
      setTimeout(() => {
        applyDefaultPresetIfNeeded().catch(async err => {
          await Logger.error("デフォルトプリセット適用エラー:", err);
        });
      }, 1500);
    } else {
      await Logger.info("起動時のデフォルトプリセット適用をスキップしました");
    }
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

    await Logger.logDprOperation('読み込み', async () => {  // async キーワードを追加
      await Logger.info('storage.localからDPR設定を取得中...');

      const data = await browser.storage.local.get('systemDpr');  // これで問題なく動作

      await Logger.logDprOperation('取得結果', async () => {
        await Logger.info('取得したDPR設定データ:', data);

        const percentValue = data.systemDpr !== undefined ? data.systemDpr : 100;
        const dprValue = percentValue / 100;

        await Logger.info(`システム拡大率設定: ${percentValue}% (DPR: ${dprValue})`);

        // キャッシュに保存
        cachedDpr = dprValue;
      });

      const percentValue = data.systemDpr !== undefined ? data.systemDpr : 100;
      const dprValue = percentValue / 100;

      if (callback) {
        callback(percentValue);
      }

      return dprValue;
    });
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



// プリセットを適用する関数（非同期処理でもグループを維持）
async function applyPreset(preset) {
  try {
    // 一つのグループとして全処理をラップ
    return await Logger.logPresetOperation(`"${preset.name}" を適用`, async () => {
      // ここからすべての処理を一つのグループ内で完結させる

      // 1. 元のプリセット値を出力
      await Logger.info("1. 元のプリセット値:", {
        width: preset.width,
        height: preset.height,
        left: preset.left,
        top: preset.top,
      });

      // 2. DPRの取得（非同期処理）- ここで別のグループを作らない
      const data = await browser.storage.local.get('systemDpr');
      const systemDpr = data.systemDpr || 100;
      const dpr = systemDpr / 100;

      await Logger.info(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${systemDpr}%)`);

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
      const windowId = await getCurrentWindowId();
      const finalValues = {
        width: logicalWidth,
        height: logicalHeight,
        left: logicalLeft,
        top: logicalTop
      };

      await Logger.info("4. ウィンドウに適用する最終値:", finalValues);

      // ブラウザAPIに渡す
      const result = await browser.windows.update(windowId, finalValues);

      // 5. 適用結果
      await Logger.info("5. 適用結果:", result);

      return { success: true, result };
    });
  } catch (error) {
    await Logger.error('プリセット適用エラー:', error);
    throw error;
  }
}

// ウィンドウにプリセットを適用（内部実装 - ログ出力を含む）
async function applyPresetToWindowInternal(windowId, preset) {
  // 1. 元のプリセット値を出力
  await Logger.info("1. 元のプリセット値:", {
    width: preset.width,
    height: preset.height,
    left: preset.left,
    top: preset.top,
  });

  // 2. ユーザー設定のDPR値を取得
  const dpr = await getSystemDpr();
  await Logger.info(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);

  // 3. 変換計算
  let logicalWidth, logicalHeight, logicalLeft, logicalTop;

  logicalWidth = Math.round(preset.width / dpr);
  logicalHeight = Math.round(preset.height / dpr);
  logicalLeft = Math.round(preset.left / dpr);
  logicalTop = Math.round(preset.top / dpr);

  await Logger.info("3. 物理ピクセル値をDPRで割って論理ピクセル値に変換");

  // 変換計算の詳細を表形式で出力
  await Logger.table({
    幅: { 元値: preset.width, 計算式: `${preset.width} / ${dpr}`, 変換後: logicalWidth },
    高さ: { 元値: preset.height, 計算式: `${preset.height} / ${dpr}`, 変換後: logicalHeight },
    左位置: { 元値: preset.left, 計算式: `${preset.left} / ${dpr}`, 変換後: logicalLeft },
    上位置: { 元値: preset.top, 計算式: `${preset.top} / ${dpr}`, 変換後: logicalTop }
  });

  // 4. 最終的な適用値を出力
  const finalValues = {
    width: logicalWidth,
    height: logicalHeight,
    left: logicalLeft,
    top: logicalTop
  };

  await Logger.info("4. ウィンドウに適用する最終値:", finalValues);

  // ブラウザAPIに渡す
  const result = await browser.windows.update(windowId, finalValues);

  // 5. 適用結果を出力
  await Logger.info("5. 適用結果:", result);

  return result;
}

// ウィンドウにプリセットを適用（公開API - 呼び出すだけ）
async function applyPresetToWindow(windowId, preset) {
  try {
    return await applyPresetToWindowInternal(windowId, preset);
  } catch (error) {
    handleError('プリセット適用', error);
    throw error; // 必要に応じて再スロー
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



// 現在のウィンドウ情報を取得（確実に変換を行うバージョン）
async function getCurrentWindowInfo() {
  try {
    await Logger.logWindowOperation("現在の情報取得", async () => {
      // 1. 現在のウィンドウを取得
      const win = await browser.windows.getCurrent({ populate: true });
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

      // 4. 物理ピクセル値に変換
      const physical = {
        width: Math.round(logical.width * dpr),
        height: Math.round(logical.height * dpr),
        left: Math.round(logical.left * dpr),
        top: Math.round(logical.top * dpr)
      };

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

    const physical = {
      width: Math.round(logical.width * dpr),
      height: Math.round(logical.height * dpr),
      left: Math.round(logical.left * dpr),
      top: Math.round(logical.top * dpr)
    };

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
      width: 1600, height: 900, left: 0, top: 0,
      dpr: 1.0, dprPercent: 100,
      physicalWidth: 1600, physicalHeight: 900,
      physicalLeft: 0, physicalTop: 0
    };
  }
}

// ブラウザ起動時のデフォルトプリセット適用
async function applyDefaultPresetIfNeeded() {
  const data = await browser.storage.local.get(['presets', 'settings']);
  const { settings, presets } = data;

  if (settings && settings.defaultPresetId !== null && presets) {
    const defaultPreset = presets.find(preset => preset.id === settings.defaultPresetId);
    if (defaultPreset) {
      await Logger.info("デフォルトプリセットを適用します:", defaultPreset);

      // 現在のウィンドウに適用
      const windows = await browser.windows.getAll();
      if (windows.length > 0) {
        await applyPresetToWindow(windows[0].id, defaultPreset);
      }
    }
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

// ブラウザ起動イベント（再起動時にもデフォルトプリセットを適用）
browser.runtime.onStartup.addListener(applyDefaultPresetIfNeeded);


// ストレージ変更検知
browser.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.systemDpr) {
    await Logger.info('ストレージ変更検知:', changes.systemDpr);
    await Logger.info(`DPR設定変更: ${changes.systemDpr.oldValue || '未設定'} -> ${changes.systemDpr.newValue}%`);
    clearDprCache(); // キャッシュをクリア
  }
});

// メッセージリスナー
browser.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  await Logger.info('メッセージを受信:', request);

  if (request.action === 'applyPreset') {
    applyPreset(request.preset);
  } else if (request.action === 'openSettingsPage') {
    openSettingsPage();
  } else if (request.action === 'getSystemDpr') {
    getSystemDpr(sendResponse);
    return true;  // 非同期レスポンスを維持
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

        // 起動時にデフォルトプリセットを適用
        await applyDefaultPresetIfNeeded().catch(err => {
          handleError('デフォルトプリセット適用', err);
        });
      })
    } catch (err) {
      handleError('インストール処理', err);
    }
  }, 100)
})

// 拡張機能が起動したときの処理
async function initialize() {
  return await Logger.logSystemOperation('拡張機能初期化', async () => {
    await Logger.info('拡張機能を初期化します');

    // アイコンを設定
    try {
      await browser.browserAction.setIcon({
        path: {
          "48": "assets/icons/browser-icon-48.png"
        }
      });
      await Logger.info('アイコンを設定しました');
    } catch (err) {
      handleError('アイコン設定', err);
    }

    // コンテキストメニューを作成
    try {
      await browser.contextMenus.create({
        id: "open-settings",
        title: "設定を開く",
        contexts: ["browser_action"]
      });
      await Logger.info('コンテキストメニューを作成しました');
    } catch (err) {
      handleError('コンテキストメニュー作成', err);
    }

    // 起動時に実行
    await showDebugInfo();

  })

}

// コンテキストメニューがクリックされたときの処理
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-settings") {
    openSettingsPage();
  }
});

// エラーハンドリング関数
async function handleError(context, error) {
  await Logger.error(`${context}エラー:`, error);
  // エラー通知やリカバリー処理などもここで一元管理できる
}

// 拡張機能を初期化
initialize();