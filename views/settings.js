// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async function () {
  await Logger.logSystemOperation('設定画面初期化', async () => {
    await Logger.info('設定画面を初期化しています...');

    // プリセット一覧を読み込む
    loadPresets();

    // 初期DPR設定を読み込む
    loadInitialDprSetting();

    // 起動時のデフォルトプリセット設定を読み込む
    loadDefaultPresetSetting();

    // イベントリスナーを設定
    setupEventListeners();

    // メッセージリスナーを設定
    setupMessageListeners();

    await Logger.info('設定画面の初期化が完了しました');
  });
});

// 初期DPR設定を読み込む
async function loadInitialDprSetting() {
  try {
    await Logger.logDprOperation('読み込み', async () => {
      await Logger.info('システムDPR設定を読み込んでいます...');

      // background.jsのgetSystemDpr関数を呼び出す
      const backgroundPage = await browser.runtime.getBackgroundPage();
      backgroundPage.getSystemDpr(async function (dprValue) {
        await Logger.info('読み込まれたDPR設定:', dprValue, '%');

        // フォームに設定
        const dprInput = document.getElementById('system-dpr');
        if (dprInput) {
          dprInput.value = dprValue;
        } else {
          await Logger.error('DPR入力要素が見つかりません');
        }

        await Logger.info('DPR設定の読み込みが完了しました');
      });
    });
  } catch (err) {
    await Logger.error('DPR設定読み込みエラー:', err);
    // エラー表示
    handleCommonError('DPR設定読み込みエラー', err);
  }
}

// イベントリスナーのセットアップ
function setupEventListeners() {
  // 新規プリセット作成ボタン - 修正
  document.getElementById('add-preset-button').addEventListener('click', function (event) {
    // イベントオブジェクトではなく、nullまたは引数なしで呼び出す
    openPresetEditor(null); // または単に openPresetEditor();
  });

  // DPR設定フォームのsubmitイベント - インラインハンドラーの代わり
  document.getElementById('dpr-form').addEventListener('submit', function (event) {
    event.preventDefault();
    saveDprSetting();
  });

  // DPR設定保存ボタンのクリックイベント（念のため）
  document.getElementById('save-dpr-setting').addEventListener('click', function (event) {
    event.preventDefault();
    saveDprSetting();
  });

  // 起動時プリセット設定フォームのsubmitイベント
  document.getElementById('startup-form').addEventListener('submit', function (event) {
    event.preventDefault();
    saveDefaultPresetSetting();
  });

  // 起動時プリセット設定保存ボタンのクリックイベント（念のため）
  document.getElementById('save-startup-setting').addEventListener('click', function (event) {
    event.preventDefault();
    saveDefaultPresetSetting();
  });
}

// メッセージリスナーのセットアップ
function setupMessageListeners() {
  browser.runtime.onMessage.addListener(async (message) => {
    await Logger.info('メッセージを受信[settings.js]:', message);
    
    if (message.action === 'refreshSettings') {
      // プリセットの変更通知を受けたら、プリセットリストと起動時設定を更新
      await loadPresets();
      await loadDefaultPresetSetting();
      
      showStatusMessage('プリセットリストを更新しました');
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
    await Logger.logPresetOperation('リスト読み込み', async () => {
      await Logger.info('保存済みプリセットを読み込んでいます...');

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

      ['順序', 'プリセット名', 'サイズ', '位置', '操作'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
      });

      thead.appendChild(headerRow);
      table.appendChild(thead);

      // テーブルボディ
      const tbody = document.createElement('tbody');
      tbody.className = 'sortable-tbody';

      presets.forEach((preset, index) => {
        const row = document.createElement('tr');
        row.draggable = true;
        row.dataset.presetId = preset.id;
        row.className = 'preset-row';

        // 順序操作セル
        const orderCell = document.createElement('td');
        orderCell.className = 'order-controls';
        
        const upButton = document.createElement('button');
        upButton.className = 'order-button up-button';
        upButton.innerHTML = '↑';
        upButton.title = '上に移動';
        upButton.disabled = index === 0;
        upButton.addEventListener('click', () => movePreset(index, index - 1));
        
        const downButton = document.createElement('button');
        downButton.className = 'order-button down-button';
        downButton.innerHTML = '↓';
        downButton.title = '下に移動';
        downButton.disabled = index === presets.length - 1;
        downButton.addEventListener('click', () => movePreset(index, index + 1));
        
        const dragHandle = document.createElement('span');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '⋮⋮';
        dragHandle.title = 'ドラッグして移動';
        
        orderCell.appendChild(upButton);
        orderCell.appendChild(downButton);
        orderCell.appendChild(dragHandle);
        row.appendChild(orderCell);

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

      // ドラッグ&ドロップイベントリスナーを追加
      setupDragAndDrop(tbody);

      table.appendChild(tbody);
      container.appendChild(table);

      await Logger.info(`${presets.length} 件のプリセットを表示しました`);
    });

  } catch (err) {
    await Logger.error('プリセット読み込みエラー:', err);
  }
}

// プリセット編集ウィンドウを開く
async function openPresetEditor(presetId = null) {
  try {
    // 引数のタイプをチェック
    if (presetId && typeof presetId === 'object') {
      await Logger.warn('警告: openPresetEditorに不正な値が渡されました', presetId);
      presetId = null;
    }

    // すべての処理とログをグループ内に移動
    await Logger.logPresetOperation('編集', async () => {
      await Logger.info('プリセットエディタを開きます。編集ID:', presetId || '新規作成');

      // 現在のウィンドウIDを取得
      const currentWindow = await browser.windows.getCurrent();
      await Logger.info(`元ウィンドウID: ${currentWindow.id}`);

      const url = browser.runtime.getURL('views/preset-editor.html');
      // ウィンドウIDもパラメータに追加
      let fullUrl = url;
      const params = new URLSearchParams();
      if (presetId) {
        params.append('id', presetId);
      }
      params.append('sourceWindowId', currentWindow.id);
      fullUrl = `${url}?${params.toString()}`;

      try {
        // 変更点: ウィンドウを作成して単純なプロパティだけを抽出
        const createdWindow = await browser.windows.create({
          url: fullUrl,
          type: 'popup',
          width: 650,
          height: 600
        });

        // 変更点: 必要な情報だけを抽出してログ出力
        const windowInfo = {
          id: createdWindow.id,
          type: createdWindow.type,
          width: createdWindow.width,
          height: createdWindow.height,
        };

        await Logger.info('プリセットエディタウィンドウを開きました:', windowInfo);
      } catch (windowErr) {
        // ウィンドウ作成エラーの処理
        await Logger.error('ウィンドウ作成エラー:', windowErr);
        alert('プリセットエディタを開けませんでした: ' + windowErr.message);
      }
    });
  } catch (err) {
    // 全体的なエラーハンドリング
    await Logger.error('エディタ起動エラー:', err);
    alert('プリセットエディタの起動に失敗しました: ' + err.message);
  }
}

// プリセットを削除
async function deletePreset(id) {
  if (!confirm('このプリセットを削除してもよろしいですか？')) {
    return;
  }

  try {
    await Logger.logPresetOperation('削除', async () => {
      await Logger.info(`プリセット ID:${id} を削除します`);

      const data = await browser.storage.local.get(['presets', 'settings']);
      let presets = data.presets || [];
      let settings = data.settings || {};

      // 指定されたIDのプリセットを除外
      presets = presets.filter(preset => preset.id !== id);

      // 保存
      await browser.storage.local.set({ presets });

      // もし削除したプリセットが起動時設定に使用されていたら、設定をnullにリセット
      if (settings.defaultPresetId === id) {
        settings.defaultPresetId = null;
        await browser.storage.local.set({ settings });
        await Logger.info('削除されたプリセットが起動時設定に使用されていたため、設定をリセットしました');
      }

      // 成功メッセージ
      await Logger.info('プリセットの削除に成功しました');
      showStatusMessage('プリセットを削除しました');

      // 削除通知を送信
      await browser.runtime.sendMessage({
        action: 'presetDeleted',
        presetId: id
      });

      // プリセット一覧を更新
      await loadPresets();
      await loadDefaultPresetSetting();
    });
  } catch (err) {
    await Logger.error('プリセット削除エラー:', err);
    showStatusMessage('プリセットの削除に失敗しました: ' + err.message, true);
  }
}

// DPR設定を保存する
async function saveDprSetting() {
  try {
    // フォームから値を取得
    const dprInput = document.getElementById('system-dpr');
    const dprValue = parseInt(dprInput.value, 10);

    await Logger.logDprOperation('保存', async () => {
      await Logger.info(`保存しようとしている拡大率: ${dprValue}%`);

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

      await Logger.info('拡大率設定の保存に成功しました');
    });
  } catch (err) {
    await Logger.error('DPR設定保存エラー:', err);
    alert('設定の保存に失敗しました: ' + err.message);
  }
}

// 起動時のデフォルトプリセット設定を読み込む
async function loadDefaultPresetSetting() {
  try {
    await Logger.logPresetOperation('デフォルトプリセット設定読み込み', async () => {
      await Logger.info('起動時適用プリセット設定を読み込んでいます...');

      // 設定を取得
      const data = await browser.storage.local.get('settings');
      const settings = data.settings || { defaultPresetId: null };
      
      await Logger.info('読み込まれた設定:', settings);

      // プリセット一覧を取得
      const presetsData = await browser.storage.local.get('presets');
      const presets = presetsData.presets || [];
      
      // プリセットセレクトボックスに選択肢を追加
      const selectBox = document.getElementById('default-preset');
      if (!selectBox) {
        await Logger.error('プリセット選択要素が見つかりません');
        return;
      }
      
      // 既存の選択肢をクリア（最初の「使用しない」オプション以外）
      while (selectBox.options.length > 1) {
        selectBox.remove(1);
      }
      
      // プリセットを追加
      presets.forEach(preset => {
        const option = document.createElement('option');
        option.value = preset.id;
        option.textContent = preset.name;
        selectBox.appendChild(option);
      });
      
      // 保存されている設定値を選択
      if (settings.defaultPresetId) {
        selectBox.value = settings.defaultPresetId;
      } else {
        selectBox.value = "null";
      }
      
      await Logger.info('起動時プリセット設定の読み込みが完了しました');
    });
  } catch (error) {
    await Logger.error('起動時プリセット設定の読み込みエラー:', error);
    showStatusMessage('起動時プリセット設定の読み込みに失敗しました', true);
  }
}

// 起動時のデフォルトプリセット設定を保存
async function saveDefaultPresetSetting() {
  try {
    await Logger.logPresetOperation('デフォルトプリセット設定保存', async () => {
      await Logger.info('起動時適用プリセット設定を保存します...');
      
      // 選択された値を取得
      const selectBox = document.getElementById('default-preset');
      const selectedValue = selectBox.value;
      
      // "null"の場合はnullに変換、それ以外はそのまま
      const defaultPresetId = selectedValue === "null" ? null : selectedValue;
      
      await Logger.info('保存する値:', { defaultPresetId });
      
      // 既存の設定を取得して更新
      const data = await browser.storage.local.get('settings');
      const settings = data.settings || {};
      
      settings.defaultPresetId = defaultPresetId;
      
      // 設定を保存
      await browser.storage.local.set({ settings });
      
      await Logger.info('起動時プリセット設定を保存しました');
      showStatusMessage('起動時プリセット設定を保存しました');
      

    });
  } catch (error) {
    await Logger.error('起動時プリセット設定の保存エラー:', error);
    showStatusMessage('起動時プリセット設定の保存に失敗しました', true);
  }
}

// プリセット順序移動機能
async function movePreset(fromIndex, toIndex) {
  try {
    await Logger.logPresetOperation('順序変更', async () => {
      await Logger.info(`プリセットを移動: ${fromIndex} → ${toIndex}`);
      
      // プリセット一覧を取得
      const data = await browser.storage.local.get('presets');
      let presets = data.presets || [];
      
      // 順序を変更
      const [movedPreset] = presets.splice(fromIndex, 1);
      presets.splice(toIndex, 0, movedPreset);
      
      // 保存
      await browser.storage.local.set({ presets });
      
      // 表示を更新
      await loadPresets();
      
      await Logger.info('プリセット順序を変更しました');
      showStatusMessage('プリセット順序を変更しました');
    });
  } catch (error) {
    await Logger.error('プリセット順序変更エラー:', error);
    showStatusMessage('プリセット順序の変更に失敗しました', true);
  }
}

// ドラッグ&ドロップのセットアップ
function setupDragAndDrop(tbody) {
  let draggedElement = null;
  let draggedIndex = null;

  tbody.addEventListener('dragstart', function(e) {
    if (e.target.classList.contains('preset-row')) {
      draggedElement = e.target;
      draggedIndex = Array.from(tbody.children).indexOf(draggedElement);
      e.target.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      
      // カスタムドラッグイメージを設定（オプション）
      e.dataTransfer.setData('text/html', e.target.outerHTML);
    }
  });

  tbody.addEventListener('dragend', function(e) {
    if (e.target.classList.contains('preset-row')) {
      e.target.classList.remove('dragging');
      draggedElement = null;
      draggedIndex = null;
      
      // すべてのインジケーターを削除
      removeDropIndicators();
    }
  });

  tbody.addEventListener('dragover', function(e) {
    if (draggedElement) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      // 挿入位置を計算
      const targetRow = e.target.closest('.preset-row');
      if (targetRow && targetRow !== draggedElement) {
        // 既存のインジケーターを削除
        removeDropIndicators();
        
        // マウス位置から挿入位置を判定
        const rect = targetRow.getBoundingClientRect();
        const mouseY = e.clientY;
        const rowMiddle = rect.top + rect.height / 2;
        
        let insertRow;
        if (mouseY < rowMiddle) {
          // 上半分: この行の上に挿入
          insertRow = targetRow;
        } else {
          // 下半分: この行の下に挿入
          insertRow = targetRow.nextElementSibling;
        }
        
        showDropIndicator(insertRow);
      }
    }
  });

  // インジケーター表示用のヘルパー関数
  function showDropIndicator(row) {
    const table = tbody.closest('.presets-table');
    const tableRect = table.getBoundingClientRect();
    
    // インジケーターライン
    const line = document.createElement('div');
    line.className = 'drop-indicator-line';
    line.style.position = 'absolute';
    line.style.width = table.offsetWidth + 'px';
    
    // インジケータードット
    const dot = document.createElement('div');
    dot.className = 'drop-indicator-dot';
    dot.style.position = 'absolute';
    
    if (row) {
      // 指定行の上に表示
      const rowRect = row.getBoundingClientRect();
      const topPosition = rowRect.top - tableRect.top;
      
      line.style.top = topPosition + 'px';
      dot.style.top = topPosition + 'px';
    } else {
      // 最後に表示（テーブルの最下部）
      const lastRow = tbody.lastElementChild;
      if (lastRow) {
        const lastRowRect = lastRow.getBoundingClientRect();
        const bottomPosition = lastRowRect.bottom - tableRect.top;
        
        line.style.top = bottomPosition + 'px';
        dot.style.top = bottomPosition + 'px';
      }
    }
    
    table.appendChild(line);
    table.appendChild(dot);
  }

  // インジケーター削除用のヘルパー関数
  function removeDropIndicators() {
    const table = tbody.closest('.presets-table');
    table.querySelectorAll('.drop-indicator-line, .drop-indicator-dot').forEach(el => {
      el.remove();
    });
    tbody.querySelectorAll('tr').forEach(row => {
      row.style.borderBottom = '';
    });
  }

  tbody.addEventListener('dragenter', function(e) {
    if (draggedElement) {
      e.preventDefault();
    }
  });

  tbody.addEventListener('dragleave', function(e) {
    // ドラッグが離れたときにインジケーターを削除
    if (!tbody.contains(e.relatedTarget)) {
      removeDropIndicators();
    }
  });

  tbody.addEventListener('drop', function(e) {
    if (draggedElement) {
      e.preventDefault();
      
      // ドロップターゲットの行を見つける
      const dropTargetRow = e.target.closest('.preset-row');
      
      if (dropTargetRow && dropTargetRow !== draggedElement) {
        let dropTargetIndex = Array.from(tbody.children).indexOf(dropTargetRow);
        
        // マウス位置から正確な挿入位置を計算
        const rect = dropTargetRow.getBoundingClientRect();
        const mouseY = e.clientY;
        const rowMiddle = rect.top + rect.height / 2;
        
        if (mouseY >= rowMiddle) {
          // 下半分の場合、次の位置に挿入
          dropTargetIndex += 1;
        }
        
        // ドラッグ元より後ろに移動する場合、インデックス調整
        if (draggedIndex < dropTargetIndex) {
          dropTargetIndex -= 1;
        }
        
        console.log('Drop event:', {
          draggedIndex: draggedIndex,
          dropTargetIndex: dropTargetIndex,
          mouseY: mouseY,
          rowMiddle: rowMiddle
        });
        
        if (draggedIndex !== dropTargetIndex) {
          movePreset(draggedIndex, dropTargetIndex);
        }
      }
      
      // インジケーターを削除
      removeDropIndicators();
    }
  });
}


