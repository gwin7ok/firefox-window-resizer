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

// 統一DPR値の設定（システム全体で一貫した値を使用）
const UNIFIED_DPR = 1.25; // WindowsのデフォルトDPR値

// 起動時のデフォルトプリセット適用フラグ
const APPLY_DEFAULT_PRESET_ON_STARTUP = false; // 安定化までfalseに

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

async function getSystemDpr() {
  try {
    // キャッシュがあればそれを使用
    if (cachedDpr !== null) {
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

// スクリーン情報取得関数（モニタ判定なし版）
async function getScreenInfo(tabId) {
  try {
    console.group("スクリーン情報取得プロセス");
    console.log("タブID:", tabId);
    
    // 1. タブ情報の取得を試みる
    let tabInfo;
    try {
      const tab = await browser.tabs.get(tabId);
      tabInfo = {
        url: tab.url,
        title: tab.title,
        active: tab.active
      };
      console.log("1. タブ情報取得成功:", tabInfo);
      
      // 拡張機能ページやabout:ページではコンテンツスクリプトが実行できない
      const restrictedUrls = ["moz-extension:", "about:", "chrome:", "resource:"];
      if (!tab.url || restrictedUrls.some(prefix => tab.url.startsWith(prefix))) {
        console.log("非対応URL検出:", tab.url);
        throw new Error("非対応URL - 別の方法を試みます");
      }
    } catch (tabError) {
      console.log("1. タブ情報取得エラー:", tabError);
      tabInfo = { error: tabError.message };
    }
    
    // 2. コンテンツスクリプト実行を試みる（詳細DPR情報を取得）
    try {
      console.log("2. コンテンツスクリプト実行開始");
      const results = await browser.tabs.executeScript(tabId, {
        code: `
        (function() {
          try {
            // DPR関連の詳細情報を収集
            const dprDetails = {
              rawValue: window.devicePixelRatio,
              type: typeof window.devicePixelRatio,
              source: "window.devicePixelRatio",
              jsEngine: navigator.userAgent,
              screenWidth: window.screen.width,
              screenHeight: window.screen.height,
              availWidth: window.screen.availWidth,
              availHeight: window.screen.availHeight,
              windowInnerWidth: window.innerWidth,
              windowInnerHeight: window.innerHeight,
              windowOuterWidth: window.outerWidth,
              windowOuterHeight: window.outerHeight,
              willReadFrequently: true
            };
            
            // メディアクエリでも確認
            const mqString = "(resolution: " + window.devicePixelRatio + "dppx)";
            dprDetails.mediaQueryMatch = window.matchMedia(mqString).matches;
            
            // 比率計算の確認
            if (window.screen.width > 0 && window.outerWidth > 0) {
              dprDetails.calculatedRatio = window.screen.width / window.outerWidth;
            }
            
            return {
              width: window.screen.availWidth || screen.width,
              height: window.screen.availHeight || screen.height,
              left: window.screen.availLeft || 0,
              top: window.screen.availTop || 0,
              dpr: window.devicePixelRatio || 0.9,  // デフォルト値を0.9に変更
              source: "contentScript",
              dprDetails: dprDetails,
              windowContext: {
                url: window.location.href,
                title: document.title
              }
            };
          } catch (e) {
            return {
              error: e.toString(),
              errorSource: "contentScriptExecution"
            };
          }
        })();
        `,
        runAt: "document_end"
      });
      
      // 結果確認
      if (results && results.length > 0 && results[0]) {
        if (results[0].error) {
          console.error("コンテンツスクリプト実行エラー:", results[0].error);
          throw new Error(results[0].error);
        }
        
        // DPR詳細情報のログ
        console.log("📊 DPR詳細情報:", results[0].dprDetails);
        console.table({
          "DPR値": results[0].dpr,
          "取得元": results[0].dprDetails.source,
          "生の値": results[0].dprDetails.rawValue,
          "値の型": results[0].dprDetails.type,
          "メディアクエリ一致": results[0].dprDetails.mediaQueryMatch,
          "計算された比率": results[0].dprDetails.calculatedRatio || "N/A"
        });
        
        console.log("2. コンテンツスクリプトからスクリーン情報取得成功:", results[0]);
        
        // 追加のDPR検証
        if (results[0].dpr !== results[0].dprDetails.rawValue) {
          console.warn("⚠️ DPR値の不一致: 取得値と生の値が異なります");
        }
        
        const result = {
          ...results[0],
          overridden: false, // 実際の値なのでオーバーライドしていない
          dprDetectionMethod: "contentScript(window.devicePixelRatio)"
        };
        
        console.groupEnd();
        return result;
      }
    } catch (scriptError) {
      console.log("2. コンテンツスクリプト実行エラー:", scriptError);
      // 次の方法を試みる
    }
    
    // 3. 現在のウィンドウ情報からDPRを推定
    try {
      const win = await browser.windows.getCurrent();
      console.log("3. ウィンドウ情報から推定");
      
      return {
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        dpr: 0.9, // デフォルト値を0.9に変更
        overridden: true, // 推定値なのでオーバーライド
        source: "windowPosition"
      };
    } catch (winError) {
      console.log("3. ウィンドウ情報取得エラー:", winError);
    }
    
    // 4. システム情報APIを使用（Firefox 85以降）
    try {
      if (browser.system && browser.system.display) {
        const displays = await browser.system.display.getInfo();
        
        if (displays && displays.length > 0) {
          // プライマリディスプレイを探す
          const primaryDisplay = displays.find(d => d.isPrimary) || displays[0];
          
          // DPR計算（OSの設定に基づく）
          let dpr = primaryDisplay.devicePixelRatio || 0.9; // デフォルト値を0.9に変更
          
          console.log("4. system.display APIからディスプレイ情報を取得:", primaryDisplay);
          
          return {
            width: primaryDisplay.bounds.width,
            height: primaryDisplay.bounds.height,
            left: primaryDisplay.bounds.left,
            top: primaryDisplay.bounds.top,
            dpr: dpr,
            overridden: false,
            source: "systemApi"
          };
        }
      }
    } catch (sysError) {
      console.log("4. system.display API利用不可または失敗:", sysError);
    }
    
    // 5. OSフィンガープリントからDPRを推定
    try {
      const platformInfo = await browser.runtime.getPlatformInfo();
      
      // OSに基づくデフォルト値
      let defaultDpr = 0.9; // 基本のデフォルト値
      
      if (platformInfo.os === "mac") {
        defaultDpr = 2.0; // Macの場合はRetina対応
      }
      
      return {
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        dpr: defaultDpr,
        overridden: true,
        source: "platformInfo"
      };
    } catch (platformError) {
      console.log("5. プラットフォーム情報取得エラー:", platformError);
    }
    
    // 6. 最後の手段 - デフォルト値
    console.log("6. すべての方法が失敗 - デフォルト値を使用");
    return {
      width: 1920,
      height: 1080,
      left: 0,
      top: 0,
      dpr: 0.9, // デフォルト値を0.9に変更
      overridden: true,
      source: "defaultFallback"
    };
    
    console.groupEnd();
  } catch (error) {
    console.error("スクリーン情報取得中の予期せぬエラー:", error);
    console.groupEnd();
    
    // 安全なフォールバック値
    return {
      width: 1920,
      height: 1080,
      left: 0,
      top: 0,
      dpr: 0.9, // デフォルト値を0.9に変更
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
      isPhysicalPixels: preset.isPhysicalPixels === true ? "YES" : "NO"
    });
    
    // 2. ユーザー設定のDPR値を取得
    const dpr = await getSystemDpr();
    console.log(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);
    
    // 3. 変換計算
    let logicalWidth, logicalHeight, logicalLeft, logicalTop;
    
    if (preset.isPhysicalPixels === true) {
      // 物理ピクセル値をDPRで割って論理値に変換
      logicalWidth = Math.round(preset.width / dpr);
      logicalHeight = Math.round(preset.height / dpr);
      logicalLeft = Math.round(preset.left / dpr);
      logicalTop = Math.round(preset.top / dpr);
      
      console.log("3. 物理ピクセル値をDPRで割って論理ピクセル値に変換");
    } else {
      // 既に論理ピクセル値の場合はそのまま使用
      logicalWidth = preset.width;
      logicalHeight = preset.height;
      logicalLeft = preset.left;
      logicalTop = preset.top;
      
      console.log("3. 論理ピクセル値をそのまま使用");
    }
    
    // 変換計算の詳細を表形式で出力
    console.table({
      幅: { 元値: preset.width, 計算式: preset.isPhysicalPixels ? `${preset.width} / ${dpr}` : "変換なし", 変換後: logicalWidth },
      高さ: { 元値: preset.height, 計算式: preset.isPhysicalPixels ? `${preset.height} / ${dpr}` : "変換なし", 変換後: logicalHeight },
      左位置: { 元値: preset.left, 計算式: preset.isPhysicalPixels ? `${preset.left} / ${dpr}` : "変換なし", 変換後: logicalLeft },
      上位置: { 元値: preset.top, 計算式: preset.isPhysicalPixels ? `${preset.top} / ${dpr}` : "変換なし", 変換後: logicalTop }
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
    
    // 物理ピクセルフラグを明示的に設定
    preset.isPhysicalPixels = true;
    
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

// メッセージハンドラー
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'applyPreset':
      return getCurrentWindowId().then(windowId => {
        return applyPresetToWindow(windowId, message.preset);
      });
      
    case 'getCurrentWindowInfo':
      return getCurrentWindowInfo();
      
    case 'savePreset':
      return savePreset(message.preset);
    
    // DPR設定が更新されたときの処理を追加
    case 'dprSettingUpdated':
      console.log(`DPR設定が更新されました: ${message.value}%`);
      clearDprCache(); // キャッシュをクリア
      return Promise.resolve({ success: true });
    
    // 設定値を確認するための新しいアクション
    case 'checkDprSetting':
      return browser.storage.local.get('systemDpr').then(data => {
        return {
          systemDpr: data.systemDpr,
          cachedDpr: cachedDpr
        };
      });
      
    case 'getPresets':
      return browser.storage.local.get('presets').then(data => data.presets || []);
      
    case 'getSettings':
      return browser.storage.local.get('settings').then(data => data.settings || DEFAULT_SETTINGS);
      
    case 'savePresets':
      return browser.storage.local.set({ presets: message.presets }).then(() => true);
      
    case 'saveSettings':
      return browser.storage.local.set({ settings: message.settings }).then(() => true);
  }
});

// 初期化
initialize();

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
    console.log('現在のストレージ内容:', data);
    
    // インストール時、または設定がない場合
    if (details.reason === 'install' || data.systemDpr === undefined) {
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