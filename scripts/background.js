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

// 初期化処理
async function initialize() {
  // ストレージをチェックし、初期データがなければ設定
  const data = await browser.storage.local.get(['presets', 'settings']);
  
  if (!data.presets) {
    await browser.storage.local.set({ presets: DEFAULT_PRESETS });
  }
  
  if (!data.settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }

  // ブラウザ起動時のデフォルトプリセット適用
  applyDefaultPresetIfNeeded();
}

// 画面情報を取得するためのコンテンツスクリプト実行
async function getScreenInfo(tabId) {
  try {
    // Manifest V2では executeScript を使用
    const results = await browser.tabs.executeScript(tabId, {
      code: `
      (function() {
        return {
          width: window.screen.availWidth,
          height: window.screen.availHeight,
          left: window.screen.availLeft,
          top: window.screen.availTop,
          dpr: window.devicePixelRatio || 1
        };
      })();
      `
    });
    
    // DPRが1.0の場合は固定値を使用
    if (results[0].dpr === 1.0) {
      const isSecondary = results[0].left < 0;
      results[0].dpr = isSecondary ? 1.0 : 1.25; // メインモニタ125%、セカンダリ100%
      results[0].overridden = true;
    }
    
    return results[0];
  } catch (error) {
    console.error("画面情報取得エラー:", error);
    // 失敗した場合はデフォルト値を返す
    return {
      width: 1920,
      height: 1080,
      left: 0,
      top: 0,
      dpr: 1.25, // デフォルトはメインモニタのDPRを想定
      overridden: true
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
      console.warn("アクティブタブが見つからないため、DPR値は固定値を使用します");
      
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
    console.error("ウィンドウ情報取得エラー:", error);
    
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
      // 現在のウィンドウに適用
      const windows = await browser.windows.getAll();
      if (windows.length > 0) {
        await applyPresetToWindow(windows[0].id, defaultPreset);
      }
    }
  }
}

// ウィンドウにプリセットを適用（物理ピクセル → 論理ピクセル変換）
async function applyPresetToWindow(windowId, preset) {
  // 現在のタブの情報を取得してDPRを調べる
  const tabs = await browser.tabs.query({ active: true, windowId: windowId });
  
  if (tabs.length === 0) {
    throw new Error("アクティブタブが見つかりません");
  }
  
  const screenInfo = await getScreenInfo(tabs[0].id);
  const dpr = screenInfo.dpr || 1;
  
  // 物理ピクセル値を論理ピクセル値に変換（DPRで割る）
  const logicalWidth = Math.round(preset.width / dpr);
  const logicalHeight = Math.round(preset.height / dpr);
  const logicalLeft = Math.round(preset.left / dpr);
  const logicalTop = Math.round(preset.top / dpr);
  
  // ブラウザAPIには論理ピクセル値を渡す
  await browser.windows.update(windowId, {
    width: logicalWidth,
    height: logicalHeight,
    left: logicalLeft,
    top: logicalTop
  });
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
      return browser.windows.getCurrent().then(win => 
        applyPresetToWindow(win.id, message.preset)).then(() => true);
      
    case 'savePreset':
      return savePreset(message.preset);
  }
});

// 初期化
initialize();

// ブラウザ起動イベント（再起動時にもデフォルトプリセットを適用）
browser.runtime.onStartup.addListener(applyDefaultPresetIfNeeded);