// DPR情報表示関数 - getSystemDprを活用
async function showDprInfo() {
  try {
    return await Logger.logDprOperation('システム設定確認', async () => {
      // 既存のgetSystemDpr関数を利用してDPR値を取得
      const dprFactor = await getSystemDpr();
      const systemDpr = Math.round(dprFactor * 100);

      // DPR値をログに出力
      await Logger.info(`システム設定DPR: ${systemDpr}%（係数: ${dprFactor}）`);
      return systemDpr;
    });
  } catch (err) {
    await Logger.error('DPR情報表示エラー:', err);
    return 100; // エラー時はデフォルト値を返す
  }
}

// プリセット情報表示関数
async function showPresetInfo() {
  try {
    return await Logger.logPresetOperation('登録状況', async () => {
      const presets = await FwrStore.getPresets();

      // プリセットの詳細情報をグループ化して出力
      await Logger.info(`登録プリセット数: ${presets.length}`);

      // forEach を for...of に変更して非同期処理の完了を確実に待機
      let index = 0;
      for (const preset of presets) {
        await Logger.info(`[${index + 1}] ${preset.name}`);
        await Logger.info(`  サイズ: ${preset.width}×${preset.height}`);
        await Logger.info(`  位置: (${preset.left}, ${preset.top})`);
        index++;
      }

      return presets;
    });
  } catch (err) {
    await Logger.error('プリセット情報表示エラー:', err);
  }
}


/**
 * 初期データ（プリセット・設定・DPR）をストレージに用意する。何度呼んでも安全。
 * @returns {Promise<void>}
 */
async function ensureDefaults() {
  const result = await FwrStore.ensureDefaults();
  if (result.presetsInitialized) {
    await Logger.info("デフォルトプリセットを初期化しました");
  }
  if (result.idsAssigned) {
    await Logger.info("idのないプリセットにidを付与しました");
  }
  if (result.settingsInitialized) {
    await Logger.info("デフォルト設定を初期化しました");
  }
  if (result.dprInitialized) {
    await Logger.info('DPR設定を初期化しました');
  }
}

/**
 * 拡張機能の初期化処理（インストール/更新時とブラウザ起動時に1回だけ呼ぶ）。
 * 背景スクリプトは persistent: false のため、再読み込みのたびに実行してはならない。
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    return await Logger.logSystemOperation('拡張機能初期化', async () => {
      await Logger.info('拡張機能を初期化します');

      await ensureDefaults();

      // コンテキストメニュー設定
      try {
        await createContextMenus();
      } catch (error) {
        await Logger.error("コンテキストメニュー作成エラー:", error);
      }

      // 現状の確認（ログ）
      await showDprInfo();
      await showPresetInfo();

      await Logger.info('拡張機能の初期化が完了しました');
    });
  } catch (error) {
    await Logger.error("初期化エラー:", error);
  }
}

// ブラウザ起動時のデフォルトプリセット適用
async function applyDefaultPresetIfNeeded() {
  try {
    return await Logger.logSystemOperation('起動時プリセット適用', async () => {
      // 設定とプリセットを取得
      const settings = await FwrStore.getSettings();
      const presets = await FwrStore.getPresets();
      
      // 設定チェック
      if (!settings.defaultPresetId) {
        await Logger.info("起動時のプリセット適用は無効化されています");
        return { applied: false, reason: "disabled" };
      }
      
      if (presets.length === 0) {
        await Logger.info("適用可能なプリセットがありません");
        return { applied: false, reason: "no_presets" };
      }
      
      // 指定されたIDのプリセットを検索
      const defaultPreset = presets.find(preset => preset.id === settings.defaultPresetId);
      
      if (!defaultPreset) {
        await Logger.warn(`指定されたプリセットID "${settings.defaultPresetId}" が見つかりません`);
        return { applied: false, reason: "preset_not_found", presetId: settings.defaultPresetId };
      }
      
      await Logger.info("起動時適用プリセット:", defaultPreset);
      
      // 現在のウィンドウに適用
      const windows = await browser.windows.getAll();
      if (windows.length === 0) {
        await Logger.warn("適用可能なウィンドウがありません");
        return { applied: false, reason: "no_windows" };
      }
      
      const result = await applyPresetToWindow(windows[0].id, defaultPreset);
      
      await Logger.info("起動時プリセットを適用しました");
      return { applied: true, preset: defaultPreset, result };
    });
  } catch (error) {
    await Logger.error("起動時プリセット適用エラー:", error);
    return { applied: false, reason: "error", error: error.message };
  }
}

// ブラウザ起動時: 初期化し、起動時プリセットを1回だけ適用する
// （persistent: false のため、背景スクリプトの再読み込みでは実行されない）
browser.runtime.onStartup.addListener(async () => {
  try {
    await initialize();

    // 遅延実行してウィンドウの準備を待つ
    setTimeout(async () => {
      try {
        const result = await applyDefaultPresetIfNeeded();
        await Logger.info("起動時プリセット適用結果:", result);
      } catch (err) {
        await Logger.error("デフォルトプリセット適用エラー:", err);
      }
    }, 2500);
  } catch (err) {
    handleError('起動時処理', err);
  }
});

// プリセットの保存/削除通知を受けたときの処理
async function handlePresetsChanged(action) {
  // コンテキストメニューを更新
  await updateContextMenus();

  // 開いている設定ページへ通知
  const settingsTabs = await browser.tabs.query({
    url: browser.runtime.getURL('views/settings.html')
  });

  for (const tab of settingsTabs) {
    try {
      await browser.tabs.sendMessage(tab.id, {
        action: 'refreshSettings',
        source: action
      });
    } catch (err) {
      await Logger.warn(`設定ページへの通知エラー (タブID: ${tab.id}):`, err);
    }
  }
}

// メッセージリスナー
// 応答は Promise を返す方式に統一する。自分が扱わないメッセージには undefined を返し、
// 他のコンテキスト（設定ページなど）のリスナーの応答を妨げない。
browser.runtime.onMessage.addListener((request) => {
  Logger.info('メッセージを受信[background.js]:', request);

  switch (request.action) {
    case 'applyPreset':
      return applyPresetWithOptions(request.preset, request.detachTab === true, request.windowId);
    case 'openUrlWithPreset':
      // 履歴サイドバーなどから「URLを別ウィンドウで開く」依頼
      return openLinkInNewWindowWithPreset(request.url, request.preset, request.windowId);
    case 'openSettingsPage':
      return openSettingsPage();
    case 'presetSaved':
    case 'presetDeleted':
      return handlePresetsChanged(request.action);
    default:
      return undefined;
  }
});

// インストール時・アップデート時（一時的な読み込み含む）に初期化する
browser.runtime.onInstalled.addListener(async () => {
  try {
    await initialize();
  } catch (err) {
    handleError('インストール処理', err);
  }
});


// コンテキストメニューがクリックされたときの処理（本体は menus.js の handleMenuClick）
browser.contextMenus.onClicked.addListener(handleMenuClick);

// エラーハンドリング関数
async function handleError(context, error) {
  await Logger.error(`${context}エラー:`, error);
  // エラー通知やリカバリー処理などもここで一元管理できる
}
