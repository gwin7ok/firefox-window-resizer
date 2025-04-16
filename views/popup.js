// ポップアップのJavaScript処理

// ポップアップの初期化
document.addEventListener('DOMContentLoaded', function() {
  try {
    Logger.logSystemOperation('ポップアップ初期化', () => {
      Logger.info('ポップアップ画面の初期化を開始します');
    });
    
    // プリセットリストを読み込み
    loadPresetList();
    
    // 設定ページへのリンクを設定
    setupSettingsLink();
    
    Logger.logSystemOperation('初期化完了', () => {
      Logger.info('ポップアップ画面の初期化が完了しました');
    });
  } catch (error) {
    Logger.error('ポップアップ初期化エラー:', error);
  }
});

// プリセットリストの読み込み
async function loadPresetList() {
  try {
    Logger.logPresetOperation('リスト読み込み', () => {
      Logger.info('保存済みプリセットを読み込んでいます...');
    });
    
    const presetList = document.getElementById('preset-list');
    if (!presetList) {
      Logger.error('プリセットリスト要素が見つかりません');
      return;
    }
    
    // プリセットを取得
    const data = await browser.storage.local.get(['presets', 'defaultPresetName']);
    const presets = data.presets || [];
    const defaultPresetName = data.defaultPresetName || '';
    
    Logger.logPresetOperation('データ取得', () => {
      Logger.info('読み込まれたプリセット:', presets);
      Logger.info('デフォルトプリセット名:', defaultPresetName);
    });
    
    // プリセットリストをクリア
    presetList.innerHTML = '';
    
    // プリセットリストを表示
    if (presets.length === 0) {
      Logger.info('保存されたプリセットがありません');
      
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'プリセットがありません。設定画面で追加してください。';
      presetList.appendChild(emptyMessage);
    } else {
      // 各プリセットをリストに追加
      presets.forEach(preset => {
        const presetItem = createPresetItem(preset, preset.name === defaultPresetName);
        presetList.appendChild(presetItem);
      });
      
      Logger.info(`${presets.length} 個のプリセットを表示しました`);
    }
  } catch (error) {
    Logger.error('プリセットリスト読み込みエラー:', error);
  }
}

// プリセット項目の作成
function createPresetItem(preset, isDefault) {
  try {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    if (isDefault) {
      presetItem.classList.add('default');
    }
    
    // プリセット名
    const presetName = document.createElement('span');
    presetName.className = 'preset-name';
    presetName.textContent = preset.name;
    presetItem.appendChild(presetName);
    
    // プリセット情報
    const presetInfo = document.createElement('span');
    presetInfo.className = 'preset-info';
    presetInfo.textContent = `${preset.width}×${preset.height}`;
    presetItem.appendChild(presetInfo);
    
    // クリックイベントを追加
    presetItem.addEventListener('click', function() {
      applyPreset(preset);
    });
    
    return presetItem;
  } catch (error) {
    Logger.error('プリセット項目作成エラー:', error);
    
    // エラー時はダミーの要素を返す
    const errorItem = document.createElement('div');
    errorItem.className = 'preset-item error';
    errorItem.textContent = 'エラー：項目を作成できません';
    return errorItem;
  }
}

// プリセットを適用
function applyPreset(preset) {
  try {
    Logger.logPresetOperation('適用開始', () => {
      Logger.info(`プリセット "${preset.name}" を適用します:`, preset);
    });
    
    // バックグラウンドスクリプトにメッセージを送信
    browser.runtime.sendMessage({
      action: 'applyPreset',
      preset: preset
    }).then(response => {
      Logger.logPresetOperation('適用結果', () => {
        Logger.info('プリセット適用が完了しました:', response);
      });
    }).catch(error => {
      Logger.error('プリセット適用メッセージ送信エラー:', error);
    });
  } catch (error) {
    Logger.error('プリセット適用エラー:', error);
  }
}

// 設定ページへのリンクを設定
function setupSettingsLink() {
  try {
    const settingsLink = document.getElementById('settings-link');
    if (!settingsLink) {
      Logger.error('設定リンク要素が見つかりません');
      return;
    }
    
    settingsLink.addEventListener('click', function(e) {
      e.preventDefault();
      
      Logger.logSystemOperation('設定ページへ移動', () => {
        Logger.info('設定ページを開きます');
      });
      
      browser.runtime.sendMessage({
        action: 'openSettingsPage'
      }).catch(error => {
        Logger.error('設定ページを開く際にエラーが発生:', error);
      });
    });
  } catch (error) {
    Logger.error('設定リンク設定エラー:', error);
  }
}

// エラーハンドリングのグローバル設定
window.addEventListener('error', function(event) {
  console.error('グローバルエラー:', event.error);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '10px';
  errorDiv.style.margin = '10px';
  errorDiv.style.border = '1px solid red';
  errorDiv.style.borderRadius = '4px';
  errorDiv.textContent = 'エラーが発生しました: ' + event.message;
  document.body.insertBefore(errorDiv, document.body.firstChild);
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('未処理のPromise拒否:', event.reason);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '10px';
  errorDiv.style.margin = '10px';
  errorDiv.style.border = '1px solid red';
  errorDiv.style.borderRadius = '4px';
  errorDiv.textContent = '非同期処理でエラーが発生しました';
  document.body.insertBefore(errorDiv, document.body.firstChild);
});