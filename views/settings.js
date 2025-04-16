// 初期読み込み時の設定
document.addEventListener('DOMContentLoaded', function() {
  try {
    Logger.logSystemOperation('設定画面初期化', () => {
      Logger.info('設定画面の初期化を開始します');
      
      // UI要素の取得
      const systemDprInput = document.getElementById('system-dpr');
      
      // UI要素の検証
      if (!systemDprInput) {
        Logger.error('system-dpr 入力要素が見つかりません');
        return;
      }
      
      Logger.info('UI要素の初期化が完了しました');
    });
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // システムDPR設定を読み込み
    loadInitialDprSetting();
    
    // プリセットリストを読み込み
    loadPresetList();
    
    // 開発者向け機能を追加
    addDebugButton();
    
  } catch (error) {
    Logger.error('設定画面の初期化エラー:', error);
  }
});

// DPR設定の読み込み
async function loadInitialDprSetting() {
  try {
    Logger.logDprOperation('設定読み込み', () => {
      Logger.info('システムDPR設定を読み込んでいます...');
    });
    
    // background.jsのgetSystemDpr関数を呼び出す
    const backgroundPage = await browser.runtime.getBackgroundPage();
    backgroundPage.getSystemDpr(function(dprValue) {
      Logger.logDprOperation('読み込み完了', () => {
        Logger.info('読み込まれたDPR設定:', dprValue, '%');
      });
      
      // フォームに設定
      const dprInput = document.getElementById('system-dpr');
      if (dprInput) {
        dprInput.value = dprValue;
      } else {
        Logger.error('DPR入力要素が見つかりません');
      }
    });
  } catch (err) {
    Logger.error('DPR設定読み込みエラー:', err);
  }
}

// イベントリスナーのセットアップ
function setupEventListeners() {
  // 新規プリセット作成ボタン
  document.getElementById('add-preset-button').addEventListener('click', function(event) {
    openPresetEditor(null);
  });
  
  // DPR設定フォームのsubmitイベント
  document.getElementById('dpr-form').addEventListener('submit', function(event) {
    event.preventDefault();
    saveDprSetting();
  });
  
  // DPR設定保存ボタンのクリックイベント
  document.getElementById('save-dpr-setting').addEventListener('click', function(event) {
    event.preventDefault();
    saveDprSetting();
  });
}

// プリセットリストを読み込み
async function loadPresetList() {
  try {
    Logger.logPresetOperation('リスト読み込み', () => {
      Logger.info('保存済みプリセットを読み込んでいます...');
    });
    
    // 保存済みプリセットを取得
    const presets = await loadSavedPresets();
    
    // プリセットリストを表示
    displayPresetList(presets);
    
    Logger.logPresetOperation('リスト表示完了', () => {
      Logger.info('プリセットリストの表示が完了しました', {
        プリセット数: presets.length
      });
    });
  } catch (error) {
    Logger.error('プリセットリスト読み込みエラー:', error);
  }
}

// 保存された設定を読み込む
async function loadSavedPresets() {
  try {
    Logger.logPresetOperation('保存データ読み込み', () => {
      Logger.info('storage.localからプリセットデータを読み込んでいます...');
    });
    
    const data = await browser.storage.local.get('presets');
    const presets = data.presets || [];
    
    Logger.logPresetOperation('データ取得完了', () => {
      Logger.info('読み込まれたプリセット:', presets);
    });
    
    return presets;
  } catch (error) {
    Logger.error('プリセットデータ読み込みエラー:', error);
    return []; // エラー時は空配列を返す
  }
}

// プリセットリストを表示
function displayPresetList(presets) {
  const container = document.getElementById('presets-container');
  const noPresetsMessage = document.getElementById('no-presets-message');
  
  // 既存のプリセット表示をクリア（メッセージ以外）
  Array.from(container.children).forEach(child => {
    if (child !== noPresetsMessage) {
      container.removeChild(child);
    }
  });
  
  if (presets.length === 0) {
    noPresetsMessage.style.display = 'block';
    return;
  }
  
  noPresetsMessage.style.display = 'none';
  
  // プリセット一覧テーブルを作成
  const table = document.createElement('table');
  table.className = 'presets-table';
  
  // テーブルヘッダー
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  
  ['プリセット名', 'サイズ', '位置', '操作'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // テーブルボディ
  const tbody = document.createElement('tbody');
  
  presets.forEach(preset => {
    const row = document.createElement('tr');
    
    // プリセット名
    const nameCell = document.createElement('td');
    nameCell.textContent = preset.name;
    row.appendChild(nameCell);
    
    // サイズ
    const sizeCell = document.createElement('td');
    sizeCell.textContent = `${preset.width}×${preset.height}`;
    row.appendChild(sizeCell);
    
    // 位置
    const positionCell = document.createElement('td');
    positionCell.textContent = `(${preset.left}, ${preset.top})`;
    row.appendChild(positionCell);
    
    // 操作ボタン
    const actionCell = document.createElement('td');
    actionCell.className = 'action-buttons';
    
    const editButton = document.createElement('button');
    editButton.className = 'edit-button';
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => openPresetEditor(preset.id));
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-button';
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => deletePreset(preset.id));
    
    actionCell.appendChild(editButton);
    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
}

// プリセット編集ウィンドウを開く
function openPresetEditor(presetId = null) {
  try {
    if (presetId && typeof presetId === 'object') {
      Logger.warn('警告: openPresetEditorに不正な値が渡されました', presetId);
      presetId = null;
    }
    
    Logger.info('プリセットエディタを開きます。編集ID:', presetId || '新規作成');
    
    const url = browser.runtime.getURL('views/preset-editor.html');
    const fullUrl = presetId ? `${url}?id=${presetId}` : url;
    
    browser.windows.create({
      url: fullUrl,
      type: 'popup',
      width: 650,
      height: 600
    }).then(window => {
      Logger.info('プリセットエディタウィンドウを開きました:', window);
    }).catch(err => {
      Logger.error('ウィンドウ作成エラー:', err);
      alert('プリセットエディタを開けませんでした: ' + err.message);
    });
  } catch (err) {
    Logger.error('エディタ起動エラー:', err);
    alert('プリセットエディタの起動に失敗しました: ' + err.message);
  }
}

// プリセットを削除
async function deletePreset(id) {
  if (!confirm('このプリセットを削除してもよろしいですか？')) {
    return;
  }
  
  try {
    const data = await browser.storage.local.get('presets');
    let presets = data.presets || [];
    
    presets = presets.filter(preset => preset.id !== id);
    
    await browser.storage.local.set({ presets });
    
    displayPresetList(presets);
    
    Logger.info('プリセットを削除しました');
  } catch (err) {
    Logger.error('プリセット削除エラー:', err);
    alert('プリセットの削除に失敗しました');
  }
}

// DPR設定を保存する
async function saveDprSetting() {
  try {
    const dprInput = document.getElementById('system-dpr');
    const dprValue = parseInt(dprInput.value, 10);
    
    Logger.info(`保存しようとしている拡大率: ${dprValue}%`);
    
    if (isNaN(dprValue) || dprValue < 100 || dprValue > 300) {
      alert('画面拡大率は100%～300%の間で設定してください');
      return;
    }
    
    await browser.storage.local.set({ systemDpr: dprValue });
    
    await browser.runtime.sendMessage({ 
      action: 'dprSettingUpdated', 
      value: dprValue 
    });
    
    const messageElement = document.getElementById('dpr-save-message');
    if (messageElement) {
      messageElement.textContent = `拡大率設定（${dprValue}%）を保存しました`;
      messageElement.style.display = 'block';
      
      setTimeout(() => {
        messageElement.style.display = 'none';
      }, 3000);
    }
    
    Logger.info('拡大率設定の保存に成功しました');
  } catch (err) {
    Logger.error('DPR設定保存エラー:', err);
    alert('設定の保存に失敗しました: ' + err.message);
  }
}

// デバッグボタンを追加
function addDebugButton() {
  try {
    const container = document.querySelector('.container');
    
    if (!container) {
      Logger.error('コンテナ要素が見つかりません');
      return;
    }
    
    Logger.logSystemOperation('開発者向け機能追加', () => {
      Logger.info('開発者向けデバッグ機能を追加しています');
    });
    
    const devSection = document.createElement('div');
    devSection.className = 'setting-section';
    
    const devTitle = document.createElement('h3');
    devTitle.textContent = '開発者向け';
    devSection.appendChild(devTitle);
    
    const debugBtn = document.createElement('button');
    debugBtn.textContent = '変換テスト実行';
    debugBtn.className = 'button-secondary small';
    debugBtn.addEventListener('click', runConversionTest);
    
    const debugActions = document.createElement('div');
    debugActions.className = 'debug-actions';
    debugActions.appendChild(debugBtn);
    devSection.appendChild(debugActions);
    
    const debugOutput = document.createElement('pre');
    debugOutput.id = 'debug-output';
    debugOutput.style.fontSize = '12px';
    debugOutput.style.backgroundColor = '#f5f5f5';
    debugOutput.style.padding = '10px';
    debugOutput.style.border = '1px solid #ddd';
    debugOutput.style.maxHeight = '300px';
    debugOutput.style.overflow = 'auto';
    debugOutput.style.display = 'none';
    devSection.appendChild(debugOutput);
    
    container.appendChild(devSection);
    
    Logger.info('開発者向けデバッグ機能の追加が完了しました');
  } catch (error) {
    Logger.error('デバッグ機能追加エラー:', error);
  }
}

// 変換テスト実行関数
async function runConversionTest() {
  try {
    const outputEl = document.getElementById('debug-output');
    if (outputEl) {
      outputEl.style.display = 'block';
    }
    
    Logger.logSystemOperation('変換テスト実行', async () => {
      Logger.info('ウィンドウサイズ変換テストを実行します');
      
      const backgroundPage = await browser.runtime.getBackgroundPage();
      
      const data = await browser.storage.local.get('systemDpr');
      const systemDpr = data.systemDpr || 100;
      const dprFactor = systemDpr / 100;
      
      Logger.info(`DPR設定: ${systemDpr}%（係数: ${dprFactor}）`);
      
      const testSizes = [
        { type: '論理ピクセル', width: 1000, height: 700 },
        { type: '物理ピクセル', width: 1000, height: 700, isPhysical: true }
      ];
      
      testSizes.forEach(test => {
        Logger.startGroup(`${test.type} 変換テスト`);
        Logger.info(`入力値: ${test.width}×${test.height}`);
        
        if (test.isPhysical) {
          const logicalWidth = Math.round(test.width / dprFactor);
          const logicalHeight = Math.round(test.height / dprFactor);
          Logger.info(`物理→論理変換: ${logicalWidth}×${logicalHeight}`);
        } else {
          const physicalWidth = Math.round(test.width * dprFactor);
          const physicalHeight = Math.round(test.height * dprFactor);
          Logger.info(`論理→物理変換: ${physicalWidth}×${physicalHeight}`);
        }
        
        Logger.endGroup();
      });
      
      Logger.startGroup('現在のウィンドウサイズを取得');
      
      try {
        const mainWindow = await browser.windows.getCurrent();
        Logger.info('メインブラウザウィンドウ情報:', {
          id: mainWindow.id,
          width: mainWindow.width,
          height: mainWindow.height,
          left: mainWindow.left,
          top: mainWindow.top
        });
        
        Logger.info(`DPR設定: ${systemDpr} %（係数: ${dprFactor}）`);
        
        Logger.info('メインウィンドウサイズ（論理ピクセル）:', {
          width: mainWindow.width,
          height: mainWindow.height,
          left: mainWindow.left,
          top: mainWindow.top
        });
        
        Logger.info('変換後（物理ピクセル）:', {
          width: Math.round(mainWindow.width * dprFactor),
          height: Math.round(mainWindow.height * dprFactor),
          left: Math.round(mainWindow.left * dprFactor),
          top: Math.round(mainWindow.top * dprFactor)
        });
      } catch (error) {
        Logger.error('ウィンドウ情報取得エラー:', error);
      }
      
      Logger.endGroup();
    });
  } catch (err) {
    Logger.error('デバッグテストエラー:', err);
    
    const outputEl = document.getElementById('debug-output');
    if (outputEl) {
      outputEl.textContent = `エラー: ${err.message}`;
    }
  }
}


