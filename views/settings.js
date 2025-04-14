// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async function() {
  console.log('設定画面を初期化しています...');
  
  // プリセット一覧を読み込む
  loadPresets();
  
  // DPR設定を読み込む
  await loadDprSetting();
  
  // イベントリスナーを設定
  setupEventListeners();
  
  // メッセージリスナーを設定
  setupMessageListeners();
  
  // デバッグボタンの追加
  addDebugButton();
  
  console.log('設定画面の初期化が完了しました');
});

// イベントリスナーのセットアップ
function setupEventListeners() {
  // 新規プリセット作成ボタン - 修正
  document.getElementById('add-preset-button').addEventListener('click', function(event) {
    // イベントオブジェクトではなく、nullまたは引数なしで呼び出す
    openPresetEditor(null); // または単に openPresetEditor();
  });
  
  // DPR設定フォームのsubmitイベント - インラインハンドラーの代わり
  document.getElementById('dpr-form').addEventListener('submit', function(event) {
    event.preventDefault();
    saveDprSetting();
  });
  
  // DPR設定保存ボタンのクリックイベント（念のため）
  document.getElementById('save-dpr-setting').addEventListener('click', function(event) {
    event.preventDefault();
    saveDprSetting();
  });
}

// メッセージリスナーのセットアップ
function setupMessageListeners() {
  // タブメッセージを受信
  browser.runtime.onMessage.addListener(message => {
    console.log('メッセージを受信:', message);
    
    if (message.action === 'presetSaved') {
      // プリセットが保存されたら一覧を更新
      loadPresets();
      
      // メッセージを表示
      const actionText = message.isEdit ? '更新' : '作成';
      showStatusMessage(`プリセットを${actionText}しました`);
    }
  });
}

// ステータスメッセージを表示
function showStatusMessage(message, duration = 3000) {
  // 既存のメッセージ要素があれば削除
  const existingMsg = document.getElementById('status-message');
  if (existingMsg) {
    existingMsg.remove();
  }
  
  // 新しいメッセージ要素を作成
  const msgElement = document.createElement('div');
  msgElement.id = 'status-message';
  msgElement.className = 'status-message';
  msgElement.textContent = message;
  
  // bodyに追加
  document.body.appendChild(msgElement);
  
  // アニメーション用にすぐにクラスを追加
  setTimeout(() => {
    msgElement.classList.add('visible');
  }, 10);
  
  // 一定時間後に非表示
  setTimeout(() => {
    msgElement.classList.remove('visible');
    setTimeout(() => {
      msgElement.remove();
    }, 300); // フェードアウト後に削除
  }, duration);
}

// プリセット一覧を読み込む
async function loadPresets() {
  try {
    const data = await browser.storage.local.get('presets');
    const presets = data.presets || [];
    
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
    
  } catch (err) {
    console.error('プリセット読み込みエラー:', err);
  }
}

// プリセット編集ウィンドウを開く
function openPresetEditor(presetId = null) {
  try {
    // 引数のタイプをチェック
    if (presetId && typeof presetId === 'object') {
      console.warn('警告: openPresetEditorに不正な値が渡されました', presetId);
      presetId = null;
    }
    
    console.log('プリセットエディタを開きます。編集ID:', presetId || '新規作成');
    
    const url = browser.runtime.getURL('views/preset-editor.html');
    const fullUrl = presetId ? `${url}?id=${presetId}` : url;
    
    // 十分な初期サイズを設定
    browser.windows.create({
      url: fullUrl,
      type: 'popup',
      width: 650,
      height: 600  // 初期高さを600pxに増加
    }).then(window => {
      console.log('プリセットエディタウィンドウを開きました:', window);
    }).catch(err => {
      console.error('ウィンドウ作成エラー:', err);
      alert('プリセットエディタを開けませんでした: ' + err.message);
    });
  } catch (err) {
    console.error('エディタ起動エラー:', err);
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
    
    // 指定されたIDのプリセットを除外
    presets = presets.filter(preset => preset.id !== id);
    
    // 保存
    await browser.storage.local.set({ presets });
    
    // プリセット一覧を更新
    loadPresets();
    
    // 成功メッセージ
    showStatusMessage('プリセットを削除しました');
    
  } catch (err) {
    console.error('プリセット削除エラー:', err);
    alert('プリセットの削除に失敗しました');
  }
}

// DPR設定を読み込む
async function loadDprSetting() {
  try {
    console.log('システムDPR設定を読み込んでいます...');
    
    const data = await browser.storage.local.get('systemDpr');
    const dprValue = data.systemDpr || 100; // デフォルト100%
    
    console.log('読み込まれたDPR設定:', dprValue, '%');
    
    // フォームに設定
    const dprInput = document.getElementById('system-dpr');
    if (dprInput) {
      dprInput.value = dprValue;
    } else {
      console.error('DPR入力要素が見つかりません');
    }
    
    console.log('DPR設定の読み込みが完了しました');
  } catch (err) {
    console.error('DPR設定読み込みエラー:', err);
    // エラー表示
  }
}

// DPR設定を保存する
async function saveDprSetting() {
  try {
    // フォームから値を取得
    const dprInput = document.getElementById('system-dpr');
    const dprValue = parseInt(dprInput.value, 10);
    
    console.log(`保存しようとしている拡大率: ${dprValue}%`);
    
    // 値のバリデーション
    if (isNaN(dprValue) || dprValue < 100 || dprValue > 300) {
      alert('画面拡大率は100%～300%の間で設定してください');
      return;
    }
    
    // 保存
    await browser.storage.local.set({ systemDpr: dprValue });
    
    // 保存したことをバックグラウンドスクリプトに通知
    await browser.runtime.sendMessage({ 
      action: 'dprSettingUpdated', 
      value: dprValue 
    });
    
    // 保存成功メッセージを表示
    const messageElement = document.getElementById('dpr-save-message');
    if (messageElement) {
      messageElement.textContent = `拡大率設定（${dprValue}%）を保存しました`;
      messageElement.style.display = 'block';
      
      // 3秒後にメッセージを非表示
      setTimeout(() => {
        messageElement.style.display = 'none';
      }, 3000);
    }
    
    console.log('拡大率設定の保存に成功しました');
  } catch (err) {
    console.error('DPR設定保存エラー:', err);
    alert('設定の保存に失敗しました: ' + err.message);
  }
}

// デバッグボタンを追加
function addDebugButton() {
  const container = document.querySelector('.settings-container') || document.body;
  
  // セクションを作成
  const debugSection = document.createElement('div');
  debugSection.style.marginTop = '30px';
  debugSection.style.padding = '15px';
  debugSection.style.borderTop = '1px solid #ddd';
  
  const debugTitle = document.createElement('h3');
  debugTitle.textContent = '開発者向け';
  debugTitle.style.marginTop = '0';
  
  const debugButton = document.createElement('button');
  debugButton.textContent = '変換テスト実行';
  debugButton.className = 'button';
  debugButton.style.marginRight = '10px';
  
  // 結果表示エリア
  const resultArea = document.createElement('pre');
  resultArea.id = 'debug-result';
  resultArea.style.marginTop = '10px';
  resultArea.style.padding = '10px';
  resultArea.style.backgroundColor = '#f5f5f5';
  resultArea.style.border = '1px solid #ddd';
  resultArea.style.maxHeight = '300px';
  resultArea.style.overflow = 'auto';
  resultArea.style.display = 'none';
  
  // テスト実行
  debugButton.addEventListener('click', async () => {
    try {
      // DPR取得
      const dprData = await browser.storage.local.get('systemDpr');
      const systemDpr = dprData.systemDpr || 100;
      const dprFactor = systemDpr / 100;
      
      // テストデータ
      const testSizes = [
        { type: '論理ピクセル', width: 1000, height: 700 },
        { type: '物理ピクセル', width: 1000, height: 700, isPhysical: true }
      ];
      
      // 結果表示
      let result = `DPR設定: ${systemDpr}%（係数: ${dprFactor}）\n\n`;
      
      testSizes.forEach(test => {
        result += `== ${test.type} 変換テスト ==\n`;
        result += `入力値: ${test.width}×${test.height}\n`;
        
        if (test.isPhysical) {
          // 物理→論理
          const logicalWidth = Math.round(test.width / dprFactor);
          const logicalHeight = Math.round(test.height / dprFactor);
          result += `物理→論理変換: ${logicalWidth}×${logicalHeight}\n`;
        } else {
          // 論理→物理
          const physicalWidth = Math.round(test.width * dprFactor);
          const physicalHeight = Math.round(test.height * dprFactor);
          result += `論理→物理変換: ${physicalWidth}×${physicalHeight}\n`;
        }
        
        result += '\n';
      });
      
      // 結果を表示
      const resultElement = document.getElementById('debug-result');
      resultElement.textContent = result;
      resultElement.style.display = 'block';
      
    } catch (err) {
      alert('テスト実行エラー: ' + err.message);
    }
  });
  
  debugSection.appendChild(debugTitle);
  debugSection.appendChild(debugButton);
  debugSection.appendChild(resultArea);
  container.appendChild(debugSection);
}