// プリセット編集ポップアップのスクリプト - エラーハンドリング改善

// グローバルフラグを追加
let sizeAdjustmentPerformed = false;

document.addEventListener('DOMContentLoaded', async function() {
await Logger.logSystemOperation('エディタ初期化', async () => {
  await Logger.info('プリセットエディタを初期化しています...');
  });
  
  try {
    // URLパラメータからプリセットIDがあれば取得（編集モード）
    const urlParams = new URLSearchParams(window.location.search);
    const presetId = urlParams.get('id');
    
    // presetIdが有効な文字列かチェック
    const isValidId = presetId && typeof presetId === 'string' && presetId.trim() !== '';
    
  await Logger.info('起動モード:', isValidId ? '編集モード' : '新規作成モード', 'ID:', presetId || 'なし');
    
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
    
  await Logger.info('プリセットエディタの初期化が完了しました');
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        adjustWindowSize();
      });
    });
  } catch (err) {
  await Logger.error('プリセットエディタの初期化に失敗しました:', err);
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
    await Logger.error('無効なプリセットID:', presetId);
      throw new Error('無効なプリセットIDです');
    }
    
  await Logger.logPresetOperation('データ読み込み', async () => {
    await Logger.info('プリセットID:', presetId, 'のデータを読み込みます');
    });
    
    const data = await browser.storage.local.get('presets');
  await Logger.info('取得したデータ:', data);
    
    const presets = Array.isArray(data.presets) ? data.presets : [];
    
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
    await Logger.error('指定されたIDのプリセットが見つかりません:', presetId);
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
    
  await Logger.info('プリセットデータを読み込みました');
  } catch (err) {
  await Logger.error('プリセットデータ読み込みエラー:', err);
    alert('プリセートデータの読み込みに失敗しました: ' + err.message);
    // エラーでも閉じずに新規作成として続行
    setDefaultValues();
  }
}

// デフォルト値をセット
async function setDefaultValues() {
await Logger.logPresetOperation('デフォルト値', async () => {
  await Logger.info('新規プリセットのデフォルト値を設定します');
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
  await Logger.logWindowOperation('現在のサイズを取得', async () => {
      // 1. 全てのウィンドウを取得
      const windows = await browser.windows.getAll();
      
      // メインウィンドウを取得
      const mainWindow = windows.find(win => 
        win.type === 'normal' && !win.incognito && !win.alwaysOnTop && win.state !== 'minimized'
      );
      
      if (!mainWindow) {
        throw new Error('メインブラウザウィンドウが見つかりませんでした');
      }
      
      // 1. 元のウィンドウ情報を表示
    await Logger.info("1. メインブラウザウィンドウ情報:", mainWindow);
      
      // 論理ピクセル値（ブラウザから取得した値）
      const logicalValues = {
        width: mainWindow.width,
        height: mainWindow.height,
        left: mainWindow.left,
        top: mainWindow.top
      };
      
    await Logger.info('メインウィンドウサイズ (論理ピクセル):', logicalValues);
      
      // 2. ユーザー設定のDPR値を取得
      const data = await browser.storage.local.get('systemDpr');
      const systemDpr = data.systemDpr || 100;  // デフォルト100%
      const dprFactor = systemDpr / 100;
      
    await Logger.info(`2. ユーザー設定のDPR値: ${dprFactor} (拡大率: ${systemDpr}%)`);
      
      // 3. 論理ピクセル値を物理ピクセル値に変換
      const physicalWidth = Math.round(logicalValues.width * dprFactor);
      const physicalHeight = Math.round(logicalValues.height * dprFactor);
      const physicalLeft = Math.round(logicalValues.left * dprFactor);
      const physicalTop = Math.round(logicalValues.top * dprFactor);
      
    await Logger.info("3. 論理ピクセル値にDPRをかけて物理ピクセル値に変換");
      
      // 変換計算の詳細をテーブル形式で出力
    await Logger.table({
        幅: { 元値: logicalValues.width, 計算式: `${logicalValues.width} * ${dprFactor}`, 変換後: physicalWidth },
        高さ: { 元値: logicalValues.height, 計算式: `${logicalValues.height} * ${dprFactor}`, 変換後: physicalHeight },
        左位置: { 元値: logicalValues.left, 計算式: `${logicalValues.left} * ${dprFactor}`, 変換後: physicalLeft },
        上位置: { 元値: logicalValues.top, 計算式: `${logicalValues.top} * ${dprFactor}`, 変換後: physicalTop }
      });
      
      // 4. 最終的な値を表示
      const finalValues = {
        width: physicalWidth,
        height: physicalHeight,
        left: physicalLeft,
        top: physicalTop
      };
      
    await Logger.info("4. フォームに設定する物理ピクセル値:", finalValues);
      
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
    });
  } catch (err) {
  await Logger.error('ウィンドウサイズの取得エラー:', err);
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
  await Logger.error('プリセット保存エラー:', err);
    alert('プリセットの保存に失敗しました: ' + err.message);
  }
}

// ウィンドウサイズを内容に合わせて調整する関数を改善 - 非同期対応グループ化
async function adjustWindowSize() {
  // すでに実行済みならスキップ
  if (sizeAdjustmentPerformed) {
  await Logger.debug('ウィンドウサイズはすでに調整済みです');
    return;
  }
  
  try {
    // 一つのロググループとしてすべての処理をラップ
    await Logger.logWindowOperation('サイズ調整', async () => {
      // 必要な高さを計算
      const editorContainer = document.querySelector('.editor-container');
      if (!editorContainer) return;
      
      try {
        // ドキュメント全体の高さを取得（より正確）
        const docHeight = Math.max(
          document.body.scrollHeight,
          document.body.offsetHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight
        );
        
        // コンテンツの高さ + 余白（最小高さを確保）
        const requiredHeight = Math.max(700, docHeight + 80); // 最小高さ700px
        const requiredWidth = Math.max(650, editorContainer.scrollWidth + 40);
        
      await Logger.info('必要なウィンドウサイズ計算:', {
          ドキュメント高さ: docHeight,
          必要高さ: requiredHeight,
          必要幅: requiredWidth
        });
        
        // 非同期処理をawaitで待機してグループ内で完結させる
        const windowInfo = await browser.windows.getCurrent();
      await Logger.info('現在のウィンドウサイズ:', {高さ: windowInfo.height, 幅: windowInfo.width});
        
        // リサイズ操作
        await browser.windows.update(windowInfo.id, {
          height: requiredHeight,
          width: requiredWidth
        });
        
        // フラグを設定
        sizeAdjustmentPerformed = true;
        
      await Logger.info('ウィンドウサイズを調整しました:', {高さ: requiredHeight, 幅: requiredWidth});
      } catch (windowErr) {
        // エラーもグループ内で処理
      await Logger.warn('ウィンドウ操作エラー:', windowErr);
      }
    });
  } catch (err) {
    // グループ外の全体的なエラーハンドリング
  await Logger.error('ウィンドウサイズ調整エラー:', err);
  }
}

// プリセットIDを生成する関数
function generatePresetId() {
  return 'preset-' + Date.now();
}