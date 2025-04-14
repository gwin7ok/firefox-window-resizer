// プリセット編集ポップアップのスクリプト - エラーハンドリング改善

document.addEventListener('DOMContentLoaded', async function() {
  console.log('プリセットエディタを初期化しています...');
  
  try {
    // URLパラメータからプリセットIDがあれば取得（編集モード）
    const urlParams = new URLSearchParams(window.location.search);
    const presetId = urlParams.get('id');
    
    // presetIdが有効な文字列かチェック
    const isValidId = presetId && typeof presetId === 'string' && presetId.trim() !== '';
    
    console.log('起動モード:', isValidId ? '編集モード' : '新規作成モード', 'ID:', presetId || 'なし');
    
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
    
    console.log('プリセットエディタの初期化が完了しました');
    
    // 即時実行
    adjustWindowSize();
    
    // 遅延して再実行（レンダリングが完了した後）
    setTimeout(() => {
      adjustWindowSize();
    }, 300);
  } catch (err) {
    console.error('プリセットエディタの初期化に失敗しました:', err);
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
      console.error('無効なプリセットID:', presetId);
      throw new Error('無効なプリセットIDです');
    }
    
    console.log('プリセットID:', presetId, 'のデータを読み込みます');
    
    const data = await browser.storage.local.get('presets');
    console.log('取得したデータ:', data);
    
    const presets = Array.isArray(data.presets) ? data.presets : [];
    
    const preset = presets.find(p => p.id === presetId);
    if (!preset) {
      console.error('指定されたIDのプリセットが見つかりません:', presetId);
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
    
    console.log('プリセットデータを読み込みました');
  } catch (err) {
    console.error('プリセットデータ読み込みエラー:', err);
    alert('プリセートデータの読み込みに失敗しました: ' + err.message);
    // エラーでも閉じずに新規作成として続行
    setDefaultValues();
  }
}

// デフォルト値をセット
function setDefaultValues() {
  console.log('新規プリセットのデフォルト値を設定します');
  
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

// 現在のウィンドウサイズを取得する関数の強化

// 現在のウィンドウサイズとポジションを使用
async function useCurrentWindowSize() {
  try {
    console.group('現在のウィンドウサイズを取得');
    
    // 現在のウィンドウの情報を取得
    const windowInfo = await browser.windows.getCurrent();
    console.log('現在のウィンドウ情報 (物理サイズ):', {
      幅: windowInfo.width,
      高さ: windowInfo.height,
      左位置: windowInfo.left,
      上位置: windowInfo.top
    });
    
    // ユーザー設定のDPR値を取得
    const data = await browser.storage.local.get('systemDpr');
    const systemDpr = data.systemDpr || 100;  // デフォルト100%
    
    // DPR係数
    const dprFactor = systemDpr / 100;
    
    console.log('----------------------------------');
    console.log('▶ 変換情報:');
    console.log('   ユーザー設定DPR値:', systemDpr, '%');
    console.log('   DPR係数:', dprFactor);
    
    console.log('----------------------------------');
    console.log('▶ 物理サイズ (ブラウザから取得):');
    console.log('   幅: ', windowInfo.width, 'px');
    console.log('   高さ:', windowInfo.height, 'px');
    console.log('   左位置:', windowInfo.left, 'px');
    console.log('   上位置:', windowInfo.top, 'px');
    
    // 計算過程を表示
    console.log('----------------------------------');
    console.log('▶ 変換計算:');
    console.log(`   論理幅 = 物理幅 ÷ DPR = ${windowInfo.width} ÷ ${dprFactor} = ${windowInfo.width / dprFactor}`);
    console.log(`   論理高さ = 物理高さ ÷ DPR = ${windowInfo.height} ÷ ${dprFactor} = ${windowInfo.height / dprFactor}`);
    console.log(`   論理左位置 = 物理左位置 ÷ DPR = ${windowInfo.left} ÷ ${dprFactor} = ${windowInfo.left / dprFactor}`);
    console.log(`   論理上位置 = 物理上位置 ÷ DPR = ${windowInfo.top} ÷ ${dprFactor} = ${windowInfo.top / dprFactor}`);
    
    // 物理サイズから論理サイズへの変換（小数点以下を四捨五入）
    const logicalWidth = Math.round(windowInfo.width / dprFactor);
    const logicalHeight = Math.round(windowInfo.height / dprFactor);
    const logicalLeft = Math.round(windowInfo.left / dprFactor);
    const logicalTop = Math.round(windowInfo.top / dprFactor);
    
    console.log('----------------------------------');
    console.log('▶ 論理サイズ (変換後):');
    console.log('   幅: ', logicalWidth, 'px');
    console.log('   高さ:', logicalHeight, 'px');
    console.log('   左位置:', logicalLeft, 'px');
    console.log('   上位置:', logicalTop, 'px');
    
    // フォームに設定
    document.getElementById('preset-width').value = logicalWidth;
    document.getElementById('preset-height').value = logicalHeight;
    document.getElementById('preset-left').value = logicalLeft;
    document.getElementById('preset-top').value = logicalTop;
    
    // 設定したサイズ情報を表示
    const sizeInfoText = document.getElementById('size-info-text');
    if (sizeInfoText) {
      sizeInfoText.textContent = `現在のウィンドウサイズ ${logicalWidth}×${logicalHeight} と位置 (${logicalLeft}, ${logicalTop}) を設定しました`;
      sizeInfoText.style.display = 'block';
      
      // 5秒後に非表示
      setTimeout(() => {
        sizeInfoText.style.display = 'none';
      }, 5000);
    }
    
    console.groupEnd();
  } catch (err) {
    console.error('ウィンドウサイズの取得エラー:', err);
    console.groupEnd();
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
    
    // ★★★ 重要: isPhysicalPixelsのフラグを常にfalseに設定 ★★★
    // プリセットオブジェクトを作成
    const preset = {
      id: editId || generatePresetId(),
      name,
      width,
      height,
      left,
      top,
      isPhysicalPixels: false // 常に論理ピクセルとして扱う
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
    console.error('プリセット保存エラー:', err);
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
    
    console.log('必要なウィンドウサイズ計算:', {
      ドキュメント高さ: docHeight,
      必要高さ: requiredHeight,
      必要幅: requiredWidth
    });
    
    // 現在のウィンドウサイズを取得し調整
    browser.windows.getCurrent().then(windowInfo => {
      console.log('現在のウィンドウサイズ:', {高さ: windowInfo.height, 幅: windowInfo.width});
      
      // 常にリサイズする（十分なスペースを確保）
      browser.windows.update(windowInfo.id, {
        height: requiredHeight,
        width: requiredWidth
      }).then(() => {
        console.log('ウィンドウサイズを調整しました:', {高さ: requiredHeight, 幅: requiredWidth});
      }).catch(err => console.warn('ウィンドウリサイズエラー:', err));
    }).catch(err => console.warn('ウィンドウ情報取得エラー:', err));
  } catch (err) {
    console.warn('ウィンドウサイズ調整エラー:', err);
  }
}

// プリセットIDを生成する関数
function generatePresetId() {
  return 'preset-' + Date.now();
}