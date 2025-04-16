// ポップアップのJavaScript処理

// DOMが完全に読み込まれてから実行
document.addEventListener('DOMContentLoaded', async function() {
  Logger.logSystemOperation('ポップアップ初期化', () => {
    Logger.info('ポップアップを初期化しています...');
  });
  
  // プリセット一覧を読み込む
  await loadPresets();
  
  // 設定ボタンがあれば設定画面を開くイベントリスナーを設定
  const settingsButton = document.getElementById('settings-button');
  if (settingsButton) {
    settingsButton.addEventListener('click', openSettings);
  }
  
  Logger.info('ポップアップの初期化が完了しました');
});

// プリセットを読み込む
async function loadPresets() {
  try {
    Logger.logPresetOperation('読み込み開始', () => {
      Logger.info('プリセットを読み込んでいます...');
    });
    
    // コンテナを取得
    const container = document.getElementById('presets-container');
    if (!container) {
      Logger.error('presets-container 要素が見つかりません');
      return;
    }
    
    // ストレージからプリセットを取得
    const data = await browser.storage.local.get('presets');
    Logger.info('取得したデータ:', data);
    
    // presets が配列でない場合は空の配列を使用
    const presets = Array.isArray(data.presets) ? data.presets : [];
    Logger.info('プリセット配列:', presets, '長さ:', presets.length);
    
    // コンテンツをクリア
    container.innerHTML = '';
    
    if (presets.length === 0) {
      // プリセットがない場合のメッセージ
      const noPresetsMsg = document.createElement('div');
      noPresetsMsg.className = 'no-presets-message';
      noPresetsMsg.textContent = 'プリセットがありません。設定ページで作成してください。';
      container.appendChild(noPresetsMsg);
      
      // 設定ページへのリンク
      const settingsLink = document.createElement('button');
      settingsLink.className = 'settings-link';
      settingsLink.textContent = '設定ページを開く';
      settingsLink.addEventListener('click', openSettings);
      container.appendChild(settingsLink);
      
      return;
    }
    
    // テーブル形式のヘッダーを追加
    const headerRow = document.createElement('div');
    headerRow.className = 'presets-header';
    
    const nameHeader = document.createElement('div');
    nameHeader.className = 'preset-header-column';
    nameHeader.textContent = 'プリセット名';
    
    const sizeHeader = document.createElement('div');
    sizeHeader.className = 'preset-header-column';
    sizeHeader.textContent = 'サイズ';
    
    const positionHeader = document.createElement('div');
    positionHeader.className = 'preset-header-column';
    positionHeader.textContent = '位置';
    
    headerRow.appendChild(nameHeader);
    headerRow.appendChild(sizeHeader);
    headerRow.appendChild(positionHeader);
    
    container.appendChild(headerRow);
    
    // プリセットのリストを作成
    const presetsTable = document.createElement('div');
    presetsTable.className = 'presets-table';
    container.appendChild(presetsTable);
    
    // プリセットを表示（列ごとに左揃え）
    presets.forEach(preset => {
      const presetItem = createPresetItem(preset);
      presetsTable.appendChild(presetItem);
    });
    
    Logger.logPresetOperation('読み込み完了', () => {
      Logger.info('プリセットの読み込みが完了しました');
    });
  } catch (err) {
    Logger.error('プリセット読み込みエラー:', err);
    
    // エラー表示
    const container = document.getElementById('presets-container');
    if (container) {
      container.innerHTML = '';
      
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = 'プリセットの読み込みに失敗しました。';
      container.appendChild(errorMsg);
    } else {
      Logger.error('エラーメッセージを表示できません: presets-container 要素が見つかりません');
    }
  }
}

// プリセット項目を作成（列ごとに左揃え）
function createPresetItem(preset) {
  // プリセットの検証
  if (!preset || !preset.name) {
    Logger.warn('無効なプリセット:', preset);
    return document.createElement('div');
  }
  
  // 行全体を作成（クリック可能）
  const item = document.createElement('div');
  item.className = 'preset-item';
  item.title = `クリックして "${preset.name}" を適用`;
  
  // プリセット名（第1列）
  const nameElement = document.createElement('div');
  nameElement.className = 'preset-column preset-name';
  nameElement.textContent = preset.name;
  
  // サイズ表示（第2列）
  const sizeElement = document.createElement('div');
  sizeElement.className = 'preset-column preset-size';
  sizeElement.textContent = `${preset.width}×${preset.height}`;
  
  // 位置表示（第3列）
  const positionElement = document.createElement('div');
  positionElement.className = 'preset-column preset-position';
  positionElement.textContent = `(${preset.left}, ${preset.top})`;
  
  // 要素を行に追加
  item.appendChild(nameElement);
  item.appendChild(sizeElement);
  item.appendChild(positionElement);
  
  // 行全体のクリックイベント
  item.addEventListener('click', () => applyPreset(preset));
  
  return item;
}

// プリセットを適用
async function applyPreset(preset) {
  try {
    Logger.logPresetOperation('適用', () => {
      Logger.info('プリセット適用リクエスト');
      Logger.info('適用するプリセット:', preset);
    });
    
    // バックグラウンドスクリプトにメッセージ送信
    const response = await browser.runtime.sendMessage({
      action: 'applyPreset',
      preset: preset
    });
    
    Logger.info('適用結果:', response);
    
    // エラーチェック
    if (response && response.error) {
      throw new Error(response.error);
    }
    
    Logger.info('プリセットを適用しました');
    
    // ポップアップを閉じる
    window.close();
  } catch (err) {
    Logger.error('プリセット適用エラー:', err);
    alert('プリセットの適用に失敗しました: ' + err.message);
  }
}

// 設定ページを開く
function openSettings() {
  try {
    Logger.logSystemOperation('設定ページへ移動', () => {
      Logger.info('設定ページを開きます');
    });

    browser.runtime.openOptionsPage().then(() => {
      window.close(); // ポップアップを閉じる
    }).catch(err => {
      Logger.error('設定ページを開けませんでした:', err);
      // 代替手段
      browser.tabs.create({ url: browser.runtime.getURL('views/settings.html') })
        .then(() => window.close());
    });
  } catch (err) {
    Logger.error('設定ページを開く処理でエラー:', err);
    alert('設定ページを開けませんでした: ' + err.message);
  }
}

// エラーハンドリングのグローバル設定
window.addEventListener('error', function(event) {
  Logger.error('グローバルエラー:', event.error);
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
  Logger.error('未処理のPromise拒否:', event.reason);
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