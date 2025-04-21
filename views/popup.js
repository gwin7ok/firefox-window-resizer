// ポップアップのJavaScript処理

// タブ分離オプション状態
let detachTabOption = false;

// DOMが完全に読み込まれてから実行
document.addEventListener('DOMContentLoaded', async function () {
  await Logger.logSystemOperation('ポップアップ初期化', async () => { // コールバックに async を追加
    await Logger.info('ポップアップを初期化しています...');

    // プリセット一覧を読み込む
    await loadPresets(); // これで正常に動作

    // タブ分離オプションのイベントリスナー設定
    const detachTabCheckbox = document.getElementById('detach-tab-checkbox');
    if (detachTabCheckbox) {
      detachTabCheckbox.checked = false; // 毎回初期化
      detachTabCheckbox.addEventListener('change', function(e) {
        detachTabOption = e.target.checked;
        Logger.info(`タブ分離オプション: ${detachTabOption ? '有効' : '無効'}`);
      });
    }

    // 設定ボタンがあれば設定画面を開くイベントリスナーを設定
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
      settingsButton.addEventListener('click', openSettings);
    }

    await Logger.info('ポップアップの初期化が完了しました');
  });
});

// プリセットを読み込む
async function loadPresets() {
  try {
    await Logger.logPresetOperation('読み込み', async () => {
      await Logger.info('プリセットを読み込んでいます...');

      // コンテナを取得
      const container = document.getElementById('presets-container');
      if (!container) {
        await Logger.error('presets-container 要素が見つかりません');
        return;
      }

      // ストレージからプリセットを取得
      const data = await browser.storage.local.get('presets');
      await Logger.info('取得したデータ:', data);

      // presets が配列でない場合は空の配列を使用
      const presets = Array.isArray(data.presets) ? data.presets : [];
      await Logger.info('プリセット配列:', presets, '長さ:', presets.length);

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
      for (const preset of presets) {
        // await を追加して Promise の解決を待機
        const presetItem = await createPresetItem(preset);
        presetsTable.appendChild(presetItem);
      }

      await Logger.info('プリセットの読み込みが完了しました');

    });
  } catch (err) {
    await Logger.error('プリセット読み込みエラー:', err);

    // エラー表示
    const container = document.getElementById('presets-container');
    if (container) {
      container.innerHTML = '';

      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.textContent = 'プリセットの読み込みに失敗しました。';
      container.appendChild(errorMsg);
    } else {
      await Logger.error('エラーメッセージを表示できません: presets-container 要素が見つかりません');
    }
  }
}

// プリセット項目を作成（列ごとに左揃え）
async function createPresetItem(preset) {
  // プリセットの検証
  if (!preset || !preset.name) {
    await Logger.warn('無効なプリセット:', preset);
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

// プリセットを適用（タブ分離オプション対応）
async function applyPreset(preset) {
  try {
    await Logger.logPresetOperation('適用', async () => {
      await Logger.info('プリセット適用リクエスト');
      await Logger.info(`適用するプリセット: ${preset.name} (タブ分離: ${detachTabOption ? '有効' : '無効'})`);

      // バックグラウンドスクリプトにメッセージ送信
      const response = await browser.runtime.sendMessage({
        action: 'applyPreset',
        preset: preset,
        detachTab: detachTabOption // タブ分離オプションを追加
      });
    });

    // ポップアップを閉じる
    window.close();
  } catch (err) {
    await Logger.error('プリセット適用エラー:', err);
    alert('プリセットの適用に失敗しました: ' + err.message);
  }
}

// 設定ページを開く
async function openSettings() {
  try {
    await Logger.logSystemOperation('設定ページへ移動', async () => {
      await Logger.info('設定ページを開きます');

      browser.runtime.openOptionsPage().then(() => {
        window.close(); // ポップアップを閉じる
      }).catch(async err => {
        await Logger.error('設定ページを開けませんでした:', err);
        // 代替手段
        browser.tabs.create({ url: browser.runtime.getURL('views/settings.html') })
          .then(() => window.close());
      });
    });
  } catch (err) {
    await Logger.error('設定ページを開く処理でエラー:', err);
    alert('設定ページを開けませんでした: ' + err.message);
  }
}

// エラーハンドリングのグローバル設定
window.addEventListener('error', async function (event) {
  await Logger.error('グローバルエラー:', event.error);
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

window.addEventListener('unhandledrejection', async function (event) {
  await Logger.error('未処理のPromise拒否:', event.reason);
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