// DOMが読み込まれたら実行
document.addEventListener('DOMContentLoaded', async function () {
  await Logger.logSystemOperation('設定画面初期化', async () => {
    await Logger.info('設定画面を初期化しています...');

    // プリセット一覧を読み込む
    loadPresets();

    // 初期DPR設定を読み込む
    loadInitialDprSetting();

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
}

// メッセージリスナーのセットアップ
function setupMessageListeners() {
  // タブメッセージを受信
  browser.runtime.onMessage.addListener(async message => {
    await Logger.logSystemOperation('メッセージ受信', async () => {
      await Logger.info('メッセージを受信[settings.js]:', message);

      if (message.action === 'presetSaved') {
        // プリセットが保存されたら一覧を更新
        loadPresets();

        // メッセージを表示
        const actionText = message.isEdit ? '更新' : '作成';
        showStatusMessage(`プリセットを${actionText}しました`);
      }
    });
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

      const url = browser.runtime.getURL('views/preset-editor.html');
      const fullUrl = presetId ? `${url}?id=${presetId}` : url;

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

      const data = await browser.storage.local.get('presets');
      let presets = data.presets || [];

      // 指定されたIDのプリセットを除外
      presets = presets.filter(preset => preset.id !== id);

      // 保存
      await browser.storage.local.set({ presets });


      // 成功メッセージ
      await Logger.info('プリセットの削除に成功しました');
      showStatusMessage('プリセットを削除しました');

      // プリセット一覧を更新
      await loadPresets();
    });
  } catch (err) {
    await Logger.error('プリセット削除エラー:', err);
    alert('プリセットの削除に失敗しました');
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


