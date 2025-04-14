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

// DPRが常に1.0で検出される問題に対応するための固定値
const FIXED_DPR_SETTINGS = {
  main: 1.25,      // メインモニタは125%
  secondary: 1.0   // セカンダリモニタは100%
};

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

// 画面情報を取得するための関数（エラー表示抑制版）
async function getScreenInfo(tabId) {
  try {
    // タブチェック - 拡張機能ページやabout:ページでは実行不可
    try {
      const tab = await browser.tabs.get(tabId);
      const restrictedUrls = ["moz-extension:", "about:", "chrome:", "resource:"];
      
      if (!tab.url || restrictedUrls.some(prefix => tab.url.startsWith(prefix))) {
        // 静かに失敗 - 警告ログのみ
        if (tab.url) {
          logger.warn(`非対応URL(${tab.url})のため、固定DPR値を使用します`);
        }
        throw new Error("非対応URL");
      }
    } catch (tabError) {
      // 静かに失敗して固定値を返す
      return {
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        dpr: 1.25, // デフォルト値
        overridden: true,
        isDefault: true
      };
    }
    
    // コンテンツスクリプト実行
    try {
      const results = await browser.tabs.executeScript(tabId, {
        code: `
        (function() {
          try {
            return {
              width: window.screen.availWidth || 1920,
              height: window.screen.availHeight || 1080,
              left: window.screen.availLeft || 0,
              top: window.screen.availTop || 0,
              dpr: window.devicePixelRatio || 1
            };
          } catch (e) {
            return null;
          }
        })();
        `,
        runAt: "document_end"
      });
      
      // 結果チェック
      if (!results || results.length === 0 || !results[0]) {
        throw new Error("スクリプト実行結果が無効です");
      }
      
      // DPRが1.0の場合は固定値を使用
      if (results[0].dpr === 1.0) {
        // モニタの位置で判断（左がマイナスならセカンダリモニタ）
        const isSecondary = results[0].left < 0;
        const dprSettings = { main: 1.25, secondary: 1.0 };
        results[0].dpr = isSecondary ? dprSettings.secondary : dprSettings.main;
        results[0].overridden = true;
      }
      
      return results[0];
    } catch (scriptError) {
      // executeScript失敗 - 静かに固定値を返す
      return {
        width: 1920,
        height: 1080,
        left: 0,
        top: 0,
        dpr: 1.25,
        overridden: true,
        isDefault: true
      };
    }
  } catch (error) {
    // すべての例外をここでキャッチし、静かにデフォルト値を返す
    return {
      width: 1920,
      height: 1080,
      left: 0,
      top: 0,
      dpr: 1.25,
      overridden: true,
      isDefault: true
    };
  }
}

// 現在のウィンドウサイズと位置を取得（エラー処理強化版）
async function getCurrentWindowInfo() {
  try {
    const win = await browser.windows.getCurrent();
    
    // アクティブタブを取得
    const tabs = await browser.tabs.query({ active: true, windowId: win.id });
    
    if (tabs.length === 0) {
      logger.warn("アクティブタブが見つからないため、DPR値は固定値を使用します");
      
      // モニタ判定（簡易版）
      const isSecondary = win.left < 0;
      const fixedDpr = isSecondary ? FIXED_DPR_SETTINGS.secondary : FIXED_DPR_SETTINGS.main;
      
      return {
        width: win.width,
        height: win.height,
        left: win.left,
        top: win.top,
        dpr: fixedDpr,
        overridden: true
      };
    }
    
    // スクリーン情報とDPRを取得
    const screenInfo = await getScreenInfo(tabs[0].id);
    
    return {
      width: win.width,
      height: win.height,
      left: win.left,
      top: win.top,
      dpr: screenInfo.dpr || 1.0,
      overridden: screenInfo.overridden || false
    };
  } catch (error) {
    logger.error("ウィンドウ情報取得エラー:", error);
    
    // エラー時は固定値を使用
    const isSecondary = win?.left < 0;
    const fixedDpr = isSecondary ? FIXED_DPR_SETTINGS.secondary : FIXED_DPR_SETTINGS.main;
    
    return {
      width: win?.width || 1024,
      height: win?.height || 768,
      left: win?.left || 0,
      top: win?.top || 0,
      dpr: fixedDpr,
      overridden: true
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

// ウィンドウにプリセットを適用（エラーログ抑制版）
async function applyPresetToWindow(windowId, preset) {
  try {
    // 現在のタブの情報を取得してDPRを調べる
    let dpr = 1.25; // デフォルト値
    let dprSource = "デフォルト値";
    
    try {
      const tabs = await browser.tabs.query({ active: true, windowId: windowId });
      
      if (tabs.length > 0) {
        // DPRを取得（エラーは内部で処理される）
        const screenInfo = await getScreenInfo(tabs[0].id);
        dpr = screenInfo.dpr || 1.25;
        dprSource = screenInfo.overridden ? "固定値" : "検出値";
      }
    } catch (tabError) {
      // エラーを抑制
    }
    
    // プリセットの位置から判断（負の値はセカンダリモニタ）
    if (preset.left < 0 && dpr === 1.25) {
      dpr = 1.0; // セカンダリモニタのデフォルト値
      dprSource = "セカンダリモニタ用デフォルト値";
    }
    
    logger.info(`プリセット適用: DPR=${dpr}(${dprSource})で変換します`, preset);
    
    // 物理ピクセル値を論理ピクセル値に変換（DPRで割る）
    const logicalWidth = Math.round(preset.width / dpr);
    const logicalHeight = Math.round(preset.height / dpr);
    const logicalLeft = Math.round(preset.left / dpr);
    const logicalTop = Math.round(preset.top / dpr);
    
    // デバッグログ
    logger.debug("物理ピクセル値:", { width: preset.width, height: preset.height, left: preset.left, top: preset.top });
    logger.debug("論理ピクセル値:", { width: logicalWidth, height: logicalHeight, left: logicalLeft, top: logicalTop });
    
    // ブラウザAPIには論理ピクセル値を渡す
    return await browser.windows.update(windowId, {
      width: logicalWidth,
      height: logicalHeight,
      left: logicalLeft,
      top: logicalTop
    });
  } catch (error) {
    logger.error("プリセット適用エラー:", error);
    
    try {
      // エラー時は直接変換して適用を試みる（最終手段）
      const fixedDpr = preset.left < 0 ? 1.0 : 1.25; // 簡易モニタ判定
      
      const logicalWidth = Math.round(preset.width / fixedDpr);
      const logicalHeight = Math.round(preset.height / fixedDpr);
      const logicalLeft = Math.round(preset.left / fixedDpr);
      const logicalTop = Math.round(preset.top / fixedDpr);
      
      return await browser.windows.update(windowId, {
        width: logicalWidth,
        height: logicalHeight,
        left: logicalLeft,
        top: logicalTop
      });
    } catch (fallbackError) {
      throw error; // 元のエラーをスロー
    }
  }
}

// プリセットを保存（IDは自動生成）
async function savePreset(presetData) {
  const data = await browser.storage.local.get('presets');
  const presets = data.presets || [];
  
  if (presetData.id) {
    // 既存プリセットの更新
    const index = presets.findIndex(p => p.id === presetData.id);
    if (index !== -1) {
      presets[index] = presetData;
    }
  } else {
    // 新規プリセット
    presetData.id = Date.now().toString(); // ユニークIDを生成
    presets.push(presetData);
  }
  
  await browser.storage.local.set({ presets });
  return presets;
}

// メッセージハンドラー
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'getPresets':
      return browser.storage.local.get('presets').then(data => data.presets || []);
      
    case 'getSettings':
      return browser.storage.local.get('settings').then(data => data.settings || DEFAULT_SETTINGS);
      
    case 'savePresets':
      return browser.storage.local.set({ presets: message.presets }).then(() => true);
      
    case 'saveSettings':
      return browser.storage.local.set({ settings: message.settings }).then(() => true);
      
    case 'getCurrentWindowInfo':
      return getCurrentWindowInfo();
      
    case 'applyPreset':
      logger.info("プリセット適用リクエスト受信:", message.preset);
      return browser.windows.getCurrent().then(win => 
        applyPresetToWindow(win.id, message.preset)).then(() => true);
      
    case 'savePreset':
      logger.info("プリセット保存リクエスト受信:", message.preset);
      return savePreset(message.preset);
  }
});

// 初期化
initialize();

// ブラウザ起動イベント（再起動時にもデフォルトプリセットを適用）
browser.runtime.onStartup.addListener(applyDefaultPresetIfNeeded);