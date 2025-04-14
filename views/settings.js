// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async function() {
  console.log('設定画面を初期化しています...');
  
  // プリセット一覧を読み込む
  loadPresets();
  
  // DPR設定を確実に読み込む
  await loadDprSetting();
  
  // イベントリスナーを設定
  setupEventListeners();
  
  console.log('設定画面の初期化が完了しました');
});

// イベントリスナーのセットアップ
function setupEventListeners() {
  // プリセットフォームの送信イベント
  document.getElementById('preset-form').addEventListener('submit', savePreset);
  
  // 現在のサイズを使用するボタン
  document.getElementById('use-current-size').addEventListener('click', useCurrentWindowSize);
  
  // 編集キャンセルボタン
  document.getElementById('cancel-edit').addEventListener('click', cancelEdit);
  
  // DPR設定保存ボタン
  document.getElementById('save-dpr-setting').addEventListener('click', saveDprSetting);
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
    
    // プリセットカードを作成
    presets.forEach(preset => {
      const card = createPresetCard(preset);
      container.appendChild(card);
    });
    
  } catch (err) {
    console.error('プリセット読み込みエラー:', err);
  }
}

// プリセットカードを作成
function createPresetCard(preset) {
  const card = document.createElement('div');
  card.className = 'preset-card';
  card.dataset.id = preset.id;
  
  const title = document.createElement('h3');
  title.textContent = preset.name;
  
  const details = document.createElement('p');
  details.textContent = `${preset.width}×${preset.height} @ (${preset.left}, ${preset.top})`;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'preset-card-buttons';
  
  const editButton = document.createElement('button');
  editButton.textContent = '編集';
  editButton.addEventListener('click', () => editPreset(preset));
  
  const deleteButton = document.createElement('button');
  deleteButton.textContent = '削除';
  deleteButton.addEventListener('click', () => deletePreset(preset.id));
  
  buttonContainer.appendChild(editButton);
  buttonContainer.appendChild(deleteButton);
  
  card.appendChild(title);
  card.appendChild(details);
  card.appendChild(buttonContainer);
  
  return card;
}

// プリセットを編集
function editPreset(preset) {
  // フォームに値をセット
  document.getElementById('preset-name').value = preset.name;
  document.getElementById('preset-width').value = preset.width;
  document.getElementById('preset-height').value = preset.height;
  document.getElementById('preset-left').value = preset.left;
  document.getElementById('preset-top').value = preset.top;
  
  // 編集モードにする
  document.getElementById('preset-form').dataset.editId = preset.id;
  document.getElementById('save-preset').textContent = 'プリセットを更新';
  document.getElementById('cancel-edit').style.display = 'block';
  
  // フォームにスクロール
  document.getElementById('preset-form').scrollIntoView({ behavior: 'smooth' });
}

// 編集をキャンセル
function cancelEdit() {
  // フォームをリセット
  document.getElementById('preset-form').reset();
  delete document.getElementById('preset-form').dataset.editId;
  document.getElementById('save-preset').textContent = 'プリセットを保存';
  document.getElementById('cancel-edit').style.display = 'none';
}

// プリセットを保存
async function savePreset(event) {
  event.preventDefault();
  
  try {
    // フォームから値を取得
    const name = document.getElementById('preset-name').value;
    const width = parseInt(document.getElementById('preset-width').value, 10);
    const height = parseInt(document.getElementById('preset-height').value, 10);
    const left = parseInt(document.getElementById('preset-left').value, 10);
    const top = parseInt(document.getElementById('preset-top').value, 10);
    
    // 編集モードかどうか
    const editId = document.getElementById('preset-form').dataset.editId;
    
    // プリセットオブジェクトを作成
    const preset = {
      id: editId || null, // 新規作成時はnull、バックグラウンドスクリプトで生成
      name,
      width,
      height,
      left,
      top,
      isPhysicalPixels: true // 常に物理ピクセルとして扱う
    };
    
    // バックグラウンドスクリプトに保存を依頼
    const updatedPresets = await browser.runtime.sendMessage({
      action: 'savePreset',
      preset
    });
    
    // プリセット一覧を更新
    loadPresets();
    
    // フォームをリセット
    cancelEdit();
    
    // 成功メッセージ
    alert(editId ? 'プリセットを更新しました' : 'プリセットを保存しました');
    
  } catch (err) {
    console.error('プリセット保存エラー:', err);
    alert('プリセットの保存に失敗しました');
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
    
    // 編集中だった場合はキャンセル
    if (document.getElementById('preset-form').dataset.editId === id) {
      cancelEdit();
    }
    
  } catch (err) {
    console.error('プリセット削除エラー:', err);
    alert('プリセットの削除に失敗しました');
  }
}

// DPR設定を読み込む
async function loadDprSetting() {
  try {
    console.log('拡大率設定を読み込んでいます...');
    
    const data = await browser.storage.local.get('systemDpr');
    console.log('storage.local から取得したデータ:', data);
    
    const systemDpr = data.systemDpr !== undefined ? data.systemDpr : 100;
    console.log(`読み込んだ拡大率設定: ${systemDpr}%`);
    
    document.getElementById('system-dpr').value = systemDpr;
    
    return systemDpr;
  } catch (err) {
    console.error('DPR設定読み込みエラー:', err);
    // エラーの場合はデフォルト値を表示
    document.getElementById('system-dpr').value = 100;
    return 100;
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
    
    // 保存前の値を確認（デバッグ用）
    const beforeData = await browser.storage.local.get('systemDpr');
    console.log('保存前の設定値:', beforeData);
    
    // 保存
    await browser.storage.local.set({ systemDpr: dprValue });
    
    // 保存後の値を確認（デバッグ用）
    const afterData = await browser.storage.local.get('systemDpr');
    console.log('保存後の設定値:', afterData);
    
    // 保存したことをバックグラウンドスクリプトに通知
    await browser.runtime.sendMessage({ 
      action: 'dprSettingUpdated', 
      value: dprValue 
    });
    
    // 保存成功メッセージを表示
    const messageElement = document.getElementById('dpr-save-message');
    messageElement.textContent = `拡大率設定（${dprValue}%）を保存しました`;
    messageElement.style.display = 'block';
    
    // 3秒後にメッセージを非表示
    setTimeout(() => {
      messageElement.style.display = 'none';
    }, 3000);
    
    console.log('拡大率設定の保存に成功しました');
  } catch (err) {
    console.error('DPR設定保存エラー:', err);
    alert('設定の保存に失敗しました: ' + err.message);
  }
}

// 現在のウィンドウサイズと位置を取得してフォームに設定
async function useCurrentWindowSize() {
  try {
    // バックグラウンドスクリプトからウィンドウ情報を取得
    const windowInfo = await browser.runtime.sendMessage({ action: 'getCurrentWindowInfo' });
    
    // DPR情報を取得
    const dpr = windowInfo.dpr || 1.0;
    const dprPercent = windowInfo.dprPercent || 100;
    
    // 物理ピクセル値を確実に取得
    const physicalWidth = windowInfo.physicalWidth;
    const physicalHeight = windowInfo.physicalHeight;
    const physicalLeft = windowInfo.physicalLeft;
    const physicalTop = windowInfo.physicalTop;
    
    console.log('取得したウィンドウ情報:', {
      論理: { width: windowInfo.width, height: windowInfo.height },
      物理: { width: physicalWidth, height: physicalHeight },
      DPR: dpr,
      拡大率: `${dprPercent}%`
    });
    
    // 物理ピクセル値をフォームにセット
    document.getElementById('preset-width').value = physicalWidth;
    document.getElementById('preset-height').value = physicalHeight;
    document.getElementById('preset-left').value = physicalLeft;
    document.getElementById('preset-top').value = physicalTop;
    
    // 物理ピクセル値であることを明示的に表示
    const infoText = document.getElementById('size-info-text');
    if (infoText) {
      infoText.textContent = `※現在のサイズ（物理ピクセル、拡大率: ${dprPercent}%）`;
      infoText.style.display = 'block';
    }
  } catch (err) {
    console.error('ウィンドウサイズ取得エラー:', err);
    alert('現在のウィンドウ情報の取得に失敗しました');
  }
}