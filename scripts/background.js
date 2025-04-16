const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 720;
const DEFAULT_PRESET_NAME = "default"; // DEFAULT_PRESET_NAME 変数を宣言
const SYSTEM_DPR_STORAGE_KEY = 'systemDpr';
const APPLY_DEFAULT_PRESET_ON_STARTUP = false; // 安定化までfalseに

// 開発用デバッグ情報
function showDebugInfo() {
  console.log('====== Window Resizer デバッグ情報 ======');
  
  // DPR設定を表示
  browser.storage.local.get('systemDpr').then(data => {
    const systemDpr = data.systemDpr || 100;
    console.log(`システム設定DPR: ${systemDpr}%（係数: ${systemDpr/100}）`);
    
    // プリセット一覧を取得して表示
    browser.storage.local.get('presets').then(data => {
      const presets = Array.isArray(data.presets) ? data.presets : [];
      console.log(`登録プリセット数: ${presets.length}`);
      
      // プリセットの詳細情報
      presets.forEach((preset, index) => {
        console.log(`[${index+1}] ${preset.name}`);
        console.log(`  サイズ: ${preset.width}×${preset.height}`);
        console.log(`  位置: (${preset.left}, ${preset.top})`);
        
        console.log(`  物理換算: ${Math.round(preset.width*(systemDpr/100))}×${Math.round(preset.height*(systemDpr/100))}`);
      });
    });
  });
}

// 起動時に実行
showDebugInfo();

// 1分ごとに再表示（開発中のみ）
// setInterval(showDebugInfo, 60000);

// デバッグログを有効化
browser.storage.local.get('debug').then(data => {
  const isDebugMode = data.debug === true;
  
  // デバッグモードが有効なら標準のconsoleメソッドを使用
  if (isDebugMode) {
    console.log('デバッグモード有効: ログ出力を行います');
    return;
  }
  
  // デバッグモード無効の場合は何もしない関数に置き換え
  const noop = function() {};
  
  // 重要なエラーメッセージはそのまま出力
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // 他のログ関数を無効化
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.trace = noop;
}).catch(err => {
  console.error('デバッグ設定の読み込み中にエラーが発生しました:', err);
});

// デバッグモード切替機能

// デバッグモードの確認と設定
browser.storage.local.get('debugMode').then(data => {
  const isDebugMode = data.debugMode === true;
  if (isDebugMode) {
    console.log('[システム] デバッグモードが有効です');
  }
}).catch(err => {
  console.error('デバッグ設定の読み込みエラー:', err);
});

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
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.DEBUG) console.debug(...args);
  },
  info: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.INFO) console.log(...args);
  },
  warn: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.WARN) console.warn(...args);
  },
  error: (...args) => {
    if (CURRENT_DEBUG_LEVEL >= DEBUG_LEVEL.ERROR) console.error(...args);
  }
};

// 初期化処理
async function initialize() {
  try {
    // ストレージをチェックし、初期データがなければ設定
    const data = await browser.storage.local.get(['presets', 'settings']);
    
    if (!data.presets) {
      await browser.storage.local.set({ presets: DEFAULT_PRESETS });
      logger.info("デフォルトプリセットを初期化しました");
    }
    
    if (!data.settings) {
      await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
      logger.info("デフォルト設定を初期化しました");
    }
    
    // ※安全のため、起動時のプリセット適用はスキップ
    if (APPLY_DEFAULT_PRESET_ON_STARTUP) {
      // 遅延実行して安定化を図る
      setTimeout(() => {
        applyDefaultPresetIfNeeded().catch(err => {
          logger.error("デフォルトプリセット適用エラー:", err);
        });
      }, 1500);
    } else {
      logger.info("起動時のデフォルトプリセット適用をスキップしました");
    }
  } catch (error) {
    logger.error("初期化エラー:", error);
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
        callback(cachedDpr * 100); // コールバック関数にpercentValueを渡す
      }
      return cachedDpr;
    }
    
    console.log('storage.localからDPR設定を取得中...');
    const data = await browser.storage.local.get('systemDpr');
    console.log('取得したDPR設定データ:', data);
    
    const percentValue = data.systemDpr !== undefined ? data.systemDpr : 100;
    const dprValue = percentValue / 100;
    
    // キャッシュに保存
    cachedDpr = dprValue;
    
    console.log(`システム拡大率設定: ${percentValue}% (DPR: ${dprValue})`);
    
    if (callback) {
      callback(percentValue); // コールバック関数にpercentValueを渡す
    }
    
    return dprValue;
  } catch (err) {
    console.error('DPR設定取得エラー:', err);
    return 1.0; // エラー時のデフォルト値
  }
}

// キャッシュをクリアする関数
function clearDprCache() {
  cachedDpr = null;
  console.log('DPR設定キャッシュをクリアしました');
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



// プリセットを適用する関数
async function applyPreset(preset) {
     try {
      const windowId = await getCurrentWindowId();
      await applyPresetToWindow(windowId, preset);
      return { success: true };
    } catch (error) {
      console.error('プリセット適用エラー:', error);
      return { error: error.message };
    }
  }

// 拡大率設定を適用する関数
async function applyZoom(zoom) {
  console.log('拡大率適用:', zoom);
  
  // 既存のタブを更新
  browser.tabs.query({}).then(tabs => {
    tabs.forEach(tab => {
      console.log('タブにズーム設定を適用:', tab.id, zoom);
      browser.tabs.setZoom(tab.id, zoom);
    });
  });
}

// 設定ページを開く関数
async function openSettingsPage() {
  console.log('設定ページを開きます');
  
  // 既存の設定タブを検索
  let settingsTab = null;
  const tabs = await browser.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && tab.url.includes('settings.html')) {
      settingsTab = tab;
      break;
    }
  }
  
  if (settingsTab) {
    // 既存の設定タブがある場合は、それをアクティブにする
    browser.tabs.update(settingsTab.id, { active: true });
  } else {
    // 既存の設定タブがない場合は、新しいタブで開く
    browser.tabs.create({ url: 'settings.html' });
  }
}

// スクリーン情報取得関数（修正版）
async function getScreenInfo() {
  try {
    console.group('スクリーン情報取得');
    
    // ユーザー設定のDPR値を取得（百分率）
    const data = await browser.storage.local.get('systemDpr');
    const systemDpr = data.systemDpr || 100;  // デフォルトは100%
    
    // DPR値を小数に変換（例：125% → 1.25）
    const dprFactor = systemDpr / 100;
    console.log('ユーザー設定DPR値:', systemDpr, '% (係数:', dprFactor, ')');
    
    // 現在のウィンドウを取得
    const windowInfo = await browser.windows.getCurrent();
    console.log('現在のウィンドウ情報:', windowInfo);
    
    // 結果を返す
    const result = {
      width: windowInfo.width,
      height: windowInfo.height,
      left: windowInfo.left,
      top: windowInfo.top,
      dpr: dprFactor,
      source: "userSettings"
    };
    
    console.log('スクリーン情報結果:', result);
    console.groupEnd();
    return result;
  } catch (error) {
    console.error('スクリーン情報取得エラー:', error);
    console.groupEnd();
    
    // エラー時のフォールバック値
    return {
      width: 1920,
      height: 1080,
      left: 0,
      top: 0,
      dpr: 1.0,
      overridden: true,
      source: "errorFallback"
    };
  }
}

// 現在のウィンドウ情報を取得（確実に変換を行うバージョン）
async function getCurrentWindowInfo() {
  try {
    console.group("現在のウィンドウ情報取得");
    
    // 1. 現在のウィンドウを取得
    const win = await browser.windows.getCurrent({ populate: true });
    console.log("1. ブラウザから取得したウィンドウ情報:", win);
    
    // 2. ユーザー設定のDPR値を取得
    const dpr = await getSystemDpr();
    console.log(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);
    
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
    
    // 5. 結果オブジェクトを作成
    const result = {
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
    
    console.log("3. 最終的なウィンドウ情報:", {
      論理ピクセル値: logical,
      物理ピクセル値: physical,
      DPR: dpr,
      拡大率: `${dpr * 100}%`
    });
    
    console.groupEnd();
    return result;
  } catch (error) {
    console.error("ウィンドウ情報取得エラー:", error);
    console.groupEnd();
    
    // エラー時のフォールバック
    const dpr = 1.0; // デフォルト値
    return {
      width: 1600,
      height: 900,
      left: 0,
      top: 0,
      dpr: dpr,
      dprPercent: 100,
      physicalWidth: 1600,
      physicalHeight: 900,
      physicalLeft: 0,
      physicalTop: 0
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
      logger.info("デフォルトプリセットを適用します:", defaultPreset);
      
      // 現在のウィンドウに適用
      const windows = await browser.windows.getAll();
      if (windows.length > 0) {
        await applyPresetToWindow(windows[0].id, defaultPreset);
      }
    }
  }
}

// ウィンドウにプリセットを適用（確実に変換を適用するバージョン）
async function applyPresetToWindow(windowId, preset) {
  try {
    console.group(`プリセット適用: "${preset.name}"`);
    
    // 1. 元のプリセット値を出力
    console.log("1. 元のプリセット値:", {
      width: preset.width,
      height: preset.height,
      left: preset.left, 
      top: preset.top,
    });
    
    // 2. ユーザー設定のDPR値を取得
    const dpr = await getSystemDpr();
    console.log(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);
    
    // 3. 変換計算
    let logicalWidth, logicalHeight, logicalLeft, logicalTop;
    
      logicalWidth = Math.round(preset.width / dpr);
      logicalHeight = Math.round(preset.height / dpr);
      logicalLeft = Math.round(preset.left / dpr);
      logicalTop = Math.round(preset.top / dpr);
      
      console.log("3. 物理ピクセル値をDPRで割って論理ピクセル値に変換");
    
    // 変換計算の詳細を表形式で出力
    console.table({
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
    
    console.log("4. ウィンドウに適用する最終値:", finalValues);
    
    // 5. ブラウザAPIに渡す
    const result = await browser.windows.update(windowId, finalValues);
    
    console.log("5. 適用結果:", result);
    console.groupEnd();
    
    return result;
  } catch (error) {
    console.error("プリセット適用エラー:", error);
    console.groupEnd();
    throw error;
  }
}

// プリセットを保存（統一DPR版）
async function savePreset(preset) {
  try {
    console.group(`プリセット保存: "${preset.name}"（統一DPR）`);
    
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
    console.log("保存したプリセット:", preset);
    
    console.groupEnd();
    return presets;
  } catch (error) {
    console.error("プリセット保存エラー:", error);
    console.groupEnd();
    throw error;
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
    console.error('プリセット取得エラー:', error);
    return [];
  }
}

// 拡張機能の起動時に設定値を確認
browser.runtime.onStartup.addListener(async () => {
  try {
    // DPR設定の確認
    const dpr = await getSystemDpr();
    console.log(`拡張機能起動: 設定されているDPR値は ${dpr} (拡大率: ${dpr * 100}%)`);
    
    // DPRが1.0でない場合は特別にログを出力
    if (dpr !== 1.0) {
      console.log(`注意: 標準設定(100%)と異なる拡大率が設定されています。論理/物理ピクセル変換が有効です。`);
    }
  } catch (err) {
    console.error('起動時の設定チェックエラー:', err);
  }
});

// ブラウザ起動イベント（再起動時にもデフォルトプリセットを適用）
browser.runtime.onStartup.addListener(applyDefaultPresetIfNeeded);

// 拡張機能がインストールされたときの処理を改善
browser.runtime.onInstalled.addListener(async (details) => {
  console.log(`拡張機能イベント: ${details.reason}`);
  
  try {
    // 現在の設定を確認
    const data = await browser.storage.local.get('systemDpr');
    logger.debug('現在のストレージ内容:', data);
    
    // インストール時、または設定がない場合
    if (details.reason === 'install' && data === undefined) {
      console.log('初期設定を適用します');
      
      // 初期設定を確実に保存
      await browser.storage.local.set({
        systemDpr: 100
      });
      
      // 保存確認
      const checkData = await browser.storage.local.get('systemDpr');
      console.log('初期設定後のストレージ内容:', checkData);
    }
  } catch (err) {
    console.error('初期設定エラー:', err);
  }
});

// ストレージ変更検知
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.systemDpr) {
    console.log('ストレージ変更検知:', changes.systemDpr);
    console.log(`DPR設定変更: ${changes.systemDpr.oldValue || '未設定'} -> ${changes.systemDpr.newValue}%`);
    clearDprCache(); // キャッシュをクリア
  }
});

// メッセージリスナー
browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('メッセージを受信:', request);
  
  if (request.action === 'applyPreset') {
    applyPreset(request.preset);
  } else if (request.action === 'applyZoom') {
    applyZoom(request.zoom);
  } else if (request.action === 'openSettingsPage') {
    openSettingsPage();
  } else if (request.action === 'getSystemDpr') {
    getSystemDpr(sendResponse);
    return true;  // 非同期レスポンスを維持
  }
});

// インストール時またはアップデート時の処理
browser.runtime.onInstalled.addListener(details => {
  console.log('インストールまたはアップデート:', details.reason);
  
  if (details.reason === 'install') {
    console.log('初めてのインストールです');
    // 初めてインストールされたときの処理
    browser.storage.local.set({ defaultPresetName: DEFAULT_PRESET_NAME });
  } else if (details.reason === 'update') {
    console.log('アップデートしました');
    // アップデートされたときの処理
  }
  
  // プリセットを初期化
  browser.storage.local.get(DEFAULT_PRESET_NAME).then(item => {
    if (!item[DEFAULT_PRESET_NAME]) {
      console.log('デフォルトプリセットを初期化します');
      const defaultPreset = {
        name: DEFAULT_PRESET_NAME,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        isPhysical: false
      };
      browser.storage.local.set({ [DEFAULT_PRESET_NAME]: defaultPreset });
    }
  });
  
  // 設定を初期化
  browser.storage.local.get(SYSTEM_DPR_STORAGE_KEY).then(item => {
    if (item[SYSTEM_DPR_STORAGE_KEY] === undefined) {
      console.log('DPR設定を初期化します');
      browser.storage.local.set({ [SYSTEM_DPR_STORAGE_KEY]: 100 });
    }
  });
  
  // 起動時にデフォルトプリセットを適用
  applyDefaultPresetIfNeeded().catch(err => {
    logger.error("デフォルトプリセット適用エラー:", err);
  });
});

// 拡張機能が起動したときの処理
async function initialize() {
  console.log('拡張機能を初期化します');
  
  // アイコンを設定
  try {
    await browser.browserAction.setIcon({
      path: {
        "48": "assets/icons/browser-icon-48.png"
      }
    });
    console.log('アイコンを設定しました');
  } catch (err) {
    console.error('アイコン設定エラー:', err);
  }
  
  // コンテキストメニューを作成
  try {
    await browser.contextMenus.create({
      id: "open-settings",
      title: "設定を開く",
      contexts: ["browser_action"]
    });
    console.log('コンテキストメニューを作成しました');
  } catch (err) {
    console.error('コンテキストメニュー作成エラー:', err);
  }
}

// コンテキストメニューがクリックされたときの処理
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-settings") {
    openSettingsPage();
  }
});

// 拡張機能を初期化
initialize();