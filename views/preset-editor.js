// プリセット編集ポップアップのスクリプト - エラーハンドリング改善

document.addEventListener('DOMContentLoaded', async function() {
  Logger.logSystemOperation('エディタ初期化', () => {
    Logger.info('プリセットエディタを初期化しています...');
  });
  
  try {
    // URLパラメータからプリセットIDがあれば取得（編集モード）
    const urlParams = new URLSearchParams(window.location.search);
    const presetId = urlParams.get('id');
    
    // presetIdが有効な文字列かチェック
    const isValidId = presetId && typeof presetId === 'string' && presetId.trim() !== '';
    
    Logger.info('起動モード:', isValidId ? '編集モード' : '新規作成モード', 'ID:', presetId || 'なし');
    
    // イベントリスナーを設定
    document.getElementById('preset-form').addEventListener('submit', savePreset);
    document.getElementById('use-current-size').addEventListener('click', useCurrentWindowSize);
    document.getElementById('cancel-button').addEventListener('click', () => window.close());
    
    // 編集モードの場合はプリセットデータを読み込む
    if (isValidId) {
      await loadPresetData(presetId);
    } else {
      // 新規作成モード
      document.getElementById('editor-title').textContent = 'プリセットを作成';
      setDefaultValues();
    }
    
    Logger.info('プリセットエディタの初期化が完了しました');
    
    // 即時実行
    adjustWindowSize();
    
    // 遅延して再実行（レンダリングが完了した後）
    setTimeout(() => {
      adjustWindowSize();
    }, 300);
  } catch (err) {
    Logger.error('プリセットエディタの初期化に失敗しました:', err);
    alert('エディタの初期化に失敗しました: ' + err.message);
    // エラーが発生しても新規作成として続行
    setDefaultValues();
  }
});

// プリセットデータを読み込む（編集モード）
async function loadPresetData(presetId) {
  try {
    // 引数のチェック
    if (!presetId || typeof presetId !== 'string') {
      Logger.error('無効なプリセットID:', presetId);
      throw new Error('無効なプリセットIDです');
    }
    
    Logger.logPresetOperation('データ読み込み', () => {
      Logger.info('プリセットID:', presetId, 'のデータを読み込みます');
    });
    
    const data = await browser.storage.local.get('presets');
    Logger.info('取得したデータ:', data);
    
    const presets = Array.isArray(data.presets) ? data.presets : [];
    
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
      Logger.error('指定されたIDのプリセットが見つかりません:', presetId);
      throw new Error('プリセットが見つかりませんでした');
    }
    
    // タイトルを変更
    document.getElementById('editor-title').textContent = 'プリセットを編集';
    
    // データをフォームにセット
    document.getElementById('preset-name').value = preset.name || '';
    document.getElementById('preset-width').value = preset.width || 1280;
    document.getElementById('preset-height').value = preset.height || 720;
    document.getElementById('preset-left').value = preset.left || 0;
    document.getElementById('preset-top').value = preset.top || 0;
    
    // フォームにプリセットIDを設定
    document.getElementById('preset-form').dataset.editId = presetId;
    
    // 保存ボタンのテキスト変更
    document.getElementById('save-preset').textContent = 'プリセットを更新';
    
    Logger.info('プリセットデータを読み込みました');
  } catch (err) {
    Logger.error('プリセットデータ読み込みエラー:', err);
    alert('プリセートデータの読み込みに失敗しました: ' + err.message);
    // エラーでも閉じずに新規作成として続行
    setDefaultValues();
  }
}

// デフォルト値をセット
function setDefaultValues() {
  Logger.logPresetOperation('デフォルト値', () => {
    Logger.info('新規プリセットのデフォルト値を設定します');
  });
  
  // 空のフォームで初期化
  document.getElementById('preset-name').value = '';
  document.getElementById('preset-width').value = '1280';
  document.getElementById('preset-height').value = '720';
  document.getElementById('preset-left').value = '0';
  document.getElementById('preset-top').value = '0';
  
  // 編集IDをクリア
  if (document.getElementById('preset-form').dataset.editId) {
    delete document.getElementById('preset-form').dataset.editId;
  }
  
  // 保存ボタンのテキスト設定
  document.getElementById('save-preset').textContent = 'プリセットを保存';
}

// 現在のウィンドウサイズとポジションを使用
async function useCurrentWindowSize() {
  try {
    Logger.logWindowOperation('サイズ取得', () => {
      Logger.info('現在のウィンドウサイズを取得');
    });
    
    // 全てのウィンドウを取得
    const windows = await browser.windows.getAll();
    
    // 現在のポップアップウィンドウを除外し、メインウィンドウを取得
    // （通常はメインウィンドウがfocusedでないため、Firefoxの場合最初の非ポップアップウィンドウを使用）
    const mainWindow = windows.find(win => 
      win.type === 'normal' && !win.incognito && !win.alwaysOnTop && win.state !== 'minimized'
    );
    
    if (!mainWindow) {
      throw new Error('メインブラウザウィンドウが見つかりませんでした');
    }
    
    Logger.info('メインブラウザウィンドウ情報:', mainWindow);
    
    // ユーザー設定のDPR値を取得
    const data = await browser.storage.local.get('systemDpr');
    const systemDpr = data.systemDpr || 100;  // デフォルト100%
    const dprFactor = systemDpr / 100;
    
    Logger.info('DPR設定:', systemDpr, '% (係数:', dprFactor, ')');
    
    // 論理ピクセル値（ブラウザから取得した値）
    const logicalValues = {
      width: mainWindow.width,
      height: mainWindow.height,
      left: mainWindow.left,
      top: mainWindow.top
    };
    
    Logger.info('メインウィンドウサイズ (論理ピクセル):', logicalValues);
    
    // 論理ピクセル → 物理ピクセル変換
    // プリセットには物理ピクセルで保存
    const physicalWidth = Math.round(logicalValues.width * dprFactor);
    const physicalHeight = Math.round(logicalValues.height * dprFactor);
    const physicalLeft = Math.round(logicalValues.left * dprFactor);
    const physicalTop = Math.round(logicalValues.top * dprFactor);
    
    Logger.info('変換後 (物理ピクセル):', {
      width: physicalWidth,
      height: physicalHeight,
      left: physicalLeft,
      top: physicalTop
    });
    
    // フォームに設定
    document.getElementById('preset-width').value = physicalWidth;
    document.getElementById('preset-height').value = physicalHeight;
    document.getElementById('preset-left').value = physicalLeft;
    document.getElementById('preset-top').value = physicalTop;
    
    // 設定したサイズ情報を表示
    const sizeInfoText = document.getElementById('size-info-text');
    if (sizeInfoText) {
      sizeInfoText.textContent = `メインウィンドウのサイズ ${physicalWidth}×${physicalHeight} と位置 (${physicalLeft}, ${physicalTop}) を設定しました`;
      sizeInfoText.style.display = 'block';
      
      // 5秒後に非表示
      setTimeout(() => {
        sizeInfoText.style.display = 'none';
      }, 5000);
    }
    
    Logger.endGroup();
  } catch (err) {
    Logger.error('ウィンドウサイズの取得エラー:', err);
    Logger.endGroup();
    alert('ウィンドウサイズの取得に失敗しました: ' + err.message);
  }
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
    
    // 値の検証
    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
      alert('幅と高さには正の値を入力してください');
      return;
    }
    
    // プリセットオブジェクトを作成 - 
    const preset = {
      id: editId || generatePresetId(),
      name,
      width,
      height,
      left,
      top
    };
    
    // ストレージから既存のプリセットを取得
    const data = await browser.storage.local.get('presets');
    let presets = Array.isArray(data.presets) ? data.presets : [];
    
    // 編集モードの場合は既存プリセットを置換、そうでなければ追加
    if (editId) {
      const index = presets.findIndex(p => p.id === editId);
      if (index >= 0) {
        presets[index] = preset;
      } else {
        presets.push(preset);
      }
    } else {
      presets.push(preset);
    }
    
    // プリセットを保存
    await browser.storage.local.set({ presets });
    
    // 保存完了を通知
    await browser.runtime.sendMessage({ 
      action: 'presetSaved', 
      isEdit: !!editId 
    });
    
    // ウィンドウを閉じる
    window.close();
  } catch (err) {
    Logger.error('プリセット保存エラー:', err);
    alert('プリセットの保存に失敗しました: ' + err.message);
  }
}

// ウィンドウサイズを内容に合わせて調整する関数を改善

function adjustWindowSize() {
  try {
    // 必要な高さを計算
    const editorContainer = document.querySelector('.editor-container');
    if (!editorContainer) return;
    
    // ドキュメント全体の高さを取得（より正確）
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    );
    
    // コンテンツの高さ + 余白（最小高さを確保）
    const requiredHeight = Math.max(700, docHeight + 80); // 最小高さ600px
    const requiredWidth = Math.max(650, editorContainer.scrollWidth + 40);
    
    Logger.logWindowOperation('サイズ調整', () => {
      Logger.info('必要なウィンドウサイズ計算:', {
        ドキュメント高さ: docHeight,
        必要高さ: requiredHeight,
        必要幅: requiredWidth
      });
    });
    
    // 現在のウィンドウサイズを取得し調整
    browser.windows.getCurrent().then(windowInfo => {
      Logger.info('現在のウィンドウサイズ:', {高さ: windowInfo.height, 幅: windowInfo.width});
      
      // 常にリサイズする（十分なスペースを確保）
      browser.windows.update(windowInfo.id, {
        height: requiredHeight,
        width: requiredWidth
      }).then(() => {
        Logger.info('ウィンドウサイズを調整しました:', {高さ: requiredHeight, 幅: requiredWidth});
      }).catch(err => Logger.warn('ウィンドウリサイズエラー:', err));
    }).catch(err => Logger.warn('ウィンドウ情報取得エラー:', err));
  } catch (err) {
    Logger.warn('ウィンドウサイズ調整エラー:', err);
  }
}

// プリセットIDを生成する関数
function generatePresetId() {
  return 'preset-' + Date.now();
}