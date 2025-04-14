// 現在のプリセット一覧
let currentPresets = [];
// 編集中のプリセット
let editingPreset = null;
// 現在の設定
let currentSettings = {};

// プリセット一覧を読み込み
async function loadPresets() {
  try {
    // プリセットとデフォルト設定を読み込む
    const [presets, settings] = await Promise.all([
      browser.runtime.sendMessage({ action: 'getPresets' }),
      browser.runtime.sendMessage({ action: 'getSettings' })
    ]);
    
    currentPresets = presets;
    currentSettings = settings;
    
    renderPresetsTable();
  } catch (err) {
    console.error('データ読み込みエラー:', err);
    alert('設定の読み込みに失敗しました');
  }
}

// プリセット一覧をテーブルに表示
function renderPresetsTable() {
  const tbody = document.getElementById('presets-body');
  tbody.innerHTML = '';
  
  currentPresets.forEach((preset, index) => {
    const row = document.createElement('tr');
    
    // デフォルトプリセットかどうかを確認
    const isDefault = currentSettings.defaultPresetId === preset.id;
    
    row.innerHTML = `
      <td>${preset.name}</td>
      <td>${preset.width}</td>
      <td>${preset.height}</td>
      <td>${preset.left}</td>
      <td>${preset.top}</td>
      <td>
        <label class="radio-container">
          <input type="radio" name="default-preset" value="${preset.id}" ${isDefault ? 'checked' : ''}>
          <span class="checkmark"></span>
        </label>
      </td>
      <td class="row-actions">
        <button class="edit-button secondary">編集</button>
        <button class="delete-button delete">削除</button>
      </td>
    `;
    
    tbody.appendChild(row);
    
    // イベントリスナーを追加
    addTableRowEventListeners(row, preset, index);
  });
}

// テーブル行にイベントリスナーを追加
function addTableRowEventListeners(row, preset, index) {
  // ラジオボタンにイベントリスナーを追加
  const radioButton = row.querySelector('input[type="radio"]');
  radioButton.addEventListener('change', () => {
    if (radioButton.checked) {
      setDefaultPreset(preset.id);
    }
  });
  
  // アクションボタンにイベントリスナーを追加
  const buttons = row.querySelectorAll('button');
  buttons[0].addEventListener('click', () => editPreset(preset));
  buttons[1].addEventListener('click', () => deletePreset(index));
}

// プリセットを編集
function editPreset(preset) {
  const modal = document.getElementById('preset-modal');
  const modalTitle = document.getElementById('modal-title');
  
  modalTitle.textContent = '既存プリセットを編集';
  
  // フォームに値を設定
  document.getElementById('preset-name').value = preset.name;
  document.getElementById('preset-width').value = preset.width;
  document.getElementById('preset-height').value = preset.height;
  document.getElementById('preset-left').value = preset.left;
  document.getElementById('preset-top').value = preset.top;
  
  // 編集中のプリセットを保存
  editingPreset = { ...preset };
  
  // モーダルを表示
  modal.style.display = 'block';
}

// 新規プリセットを追加
function addPreset() {
  const modal = document.getElementById('preset-modal');
  const modalTitle = document.getElementById('modal-title');
  
  modalTitle.textContent = '新規プリセットを作成';
  
  // フォームをクリア
  document.getElementById('preset-name').value = '新しいプリセット';
  document.getElementById('preset-width').value = '';
  document.getElementById('preset-height').value = '';
  document.getElementById('preset-left').value = '0';
  document.getElementById('preset-top').value = '0';
  
  // 新規プリセット
  editingPreset = null;
  
  // モーダルを表示
  modal.style.display = 'block';
}

// プリセットを削除
async function deletePreset(index) {
  if (!confirm('このプリセットを削除してもよろしいですか？')) {
    return;
  }
  
  const deletedPreset = currentPresets[index];
  currentPresets.splice(index, 1);
  
  // デフォルトプリセットだった場合、設定を更新
  if (currentSettings.defaultPresetId === deletedPreset.id) {
    currentSettings.defaultPresetId = null;
    await saveSettings();
  }
  
  // 保存して再読み込み
  try {
    await browser.runtime.sendMessage({
      action: 'savePresets',
      presets: currentPresets
    });
    renderPresetsTable();
  } catch (err) {
    console.error('プリセット削除エラー:', err);
    alert('プリセットの削除に失敗しました');
    loadPresets(); // 再読み込み
  }
}

// デフォルトプリセットを設定
async function setDefaultPreset(presetId) {
  currentSettings.defaultPresetId = presetId;
  await saveSettings();
}

// 設定を保存
async function saveSettings() {
  try {
    await browser.runtime.sendMessage({
      action: 'saveSettings',
      settings: currentSettings
    });
    return true;
  } catch (err) {
    console.error('設定保存エラー:', err);
    alert('設定の保存に失敗しました');
    return false;
  }
}

// モーダルから現在のウィンドウサイズを取得（簡略化版）
async function useCurrentWindowSize() {
  try {
    const windowInfo = await browser.runtime.sendMessage({ action: 'getCurrentWindowInfo' });
    
    // DPR値の取得（固定値適用済み）
    const dpr = windowInfo.dpr || 1.0;
    const isOverridden = windowInfo.overridden || false;
    
    // 物理ピクセルに変換
    const physicalWidth = Math.round(windowInfo.width * dpr);
    const physicalHeight = Math.round(windowInfo.height * dpr);
    const physicalLeft = Math.round(windowInfo.left * dpr);
    const physicalTop = Math.round(windowInfo.top * dpr);
    
    // フォームに値をセット
    document.getElementById('preset-width').value = physicalWidth;
    document.getElementById('preset-height').value = physicalHeight;
    document.getElementById('preset-left').value = physicalLeft;
    document.getElementById('preset-top').value = physicalTop;
    
    // DPR情報を表示（既存のUI要素へ）
    const dprInfoElement = document.getElementById('dpr-info');
    if (dprInfoElement) {
      dprInfoElement.textContent = dpr.toFixed(2) + (isOverridden ? ' (固定値)' : '');
    }
    
    // DPR情報表示部分を表示
    const dprContainer = document.getElementById('dpr-container');
    if (dprContainer) {
      dprContainer.style.display = 'block';
    }
    
    console.log("ウィンドウ情報:", {
      logical: { width: windowInfo.width, height: windowInfo.height },
      physical: { width: physicalWidth, height: physicalHeight },
      dpr: dpr,
      isOverridden: isOverridden
    });
  } catch (err) {
    console.error('ウィンドウ情報取得エラー:', err);
    alert('現在のウィンドウサイズの取得に失敗しました');
  }
}

// プリセットを保存
async function savePreset() {
  // フォームから値を取得
  const name = document.getElementById('preset-name').value.trim();
  const width = parseInt(document.getElementById('preset-width').value, 10);
  const height = parseInt(document.getElementById('preset-height').value, 10);
  const left = parseInt(document.getElementById('preset-left').value, 10);
  const top = parseInt(document.getElementById('preset-top').value, 10);
  
  // 入力チェック
  if (!name) {
    alert('プリセット名を入力してください');
    return;
  }
  
  if (isNaN(width) || width <= 0) {
    alert('幅には正の数値を入力してください');
    return;
  }
  
  if (isNaN(height) || height <= 0) {
    alert('高さには正の数値を入力してください');
    return;
  }
  
  if (isNaN(left)) {
    alert('左位置には数値を入力してください');
    return;
  }
  
  if (isNaN(top)) {
    alert('上位置には数値を入力してください');
    return;
  }
  
  // プリセットデータを作成
  const presetData = {
    name,
    width,
    height,
    left,
    top,
    // 物理ピクセルとして保存されていることを明示
    isPhysicalPixels: true
  };
  
  // 既存プリセットの編集の場合
  if (editingPreset) {
    presetData.id = editingPreset.id;
  }
  
  try {
    // プリセットを保存
    const updatedPresets = await browser.runtime.sendMessage({
      action: 'savePreset',
      preset: presetData
    });
    
    // 更新されたプリセット一覧を反映
    currentPresets = updatedPresets;
    renderPresetsTable();
    
    // モーダルを閉じる
    closeModal();
  } catch (err) {
    console.error('プリセット保存エラー:', err);
    alert('プリセットの保存に失敗しました');
  }
}

// モーダルを閉じる
function closeModal() {
  const modal = document.getElementById('preset-modal');
  modal.style.display = 'none';
  document.getElementById('dpr-container').style.display = 'none';
}

// 設定を保存する関数を追加
async function saveDprSettings() {
  const dprDetectionMethod = document.getElementById('dpr-detection-method').value;
  const mainScaling = parseInt(document.getElementById('main-scaling').value, 10);
  const secondaryScaling = parseInt(document.getElementById('secondary-scaling').value, 10);
  
  try {
    await browser.storage.local.set({
      dprSettings: {
        detectionMethod: dprDetectionMethod,
        mainScaling: mainScaling,
        secondaryScaling: secondaryScaling
      }
    });
    
    console.log("DPR設定を保存しました");
    return true;
  } catch (err) {
    console.error("DPR設定の保存に失敗:", err);
    return false;
  }
}

// DPR情報をクリップボードにコピー（エラー処理強化版）
function copyDprInfo() {
  browser.runtime.sendMessage({ action: 'getCurrentWindowInfo' })
    .then(info => {
      // 単純化されたDPR情報を作成
      const dprInfo = {
        windowSize: {
          width: info.width,
          height: info.height,
          left: info.left,
          top: info.top
        },
        dprValue: info.dpr || 1.0,
        isOverridden: info.overridden || false,
        physicalSize: {
          width: Math.round(info.width * (info.dpr || 1.0)),
          height: Math.round(info.height * (info.dpr || 1.0)),
          left: Math.round(info.left * (info.dpr || 1.0)),
          top: Math.round(info.top * (info.dpr || 1.0))
        },
        userAgent: navigator.userAgent
      };
      
      const dprText = JSON.stringify(dprInfo, null, 2);
      
      // クリップボードにコピー
      navigator.clipboard.writeText(dprText)
        .then(() => {
          alert('DPR情報をクリップボードにコピーしました');
        })
        .catch(err => {
          console.error('コピーに失敗:', err);
          alert('情報のコピーに失敗しました\n' + JSON.stringify(dprInfo));
        });
    })
    .catch(err => {
      console.error('DPR情報取得エラー:', err);
      alert('DPR情報の取得に失敗しました');
    });
}

// コンソールを表示する指示
function viewConsole() {
  alert('F12キーを押してブラウザの開発者ツールを開き、「コンソール」タブを選択してください');
}

// モーダル外クリックで閉じる
window.onclick = function(event) {
  const modal = document.getElementById('preset-modal');
  if (event.target === modal) {
    closeModal();
  }
};

// イベントリスナー
document.addEventListener('DOMContentLoaded', () => {
  loadPresets();
  
  document.getElementById('add-preset').addEventListener('click', addPreset);
  document.getElementById('use-current-size').addEventListener('click', useCurrentWindowSize);
  document.getElementById('modal-save').addEventListener('click', savePreset);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('main-scaling').addEventListener('change', saveDprSettings);
  document.getElementById('secondary-scaling').addEventListener('change', saveDprSettings);
  document.getElementById('dpr-detection-method').addEventListener('change', saveDprSettings);
  document.getElementById('copy-dpr-info')?.addEventListener('click', copyDprInfo);
  document.getElementById('view-console')?.addEventListener('click', viewConsole);
});