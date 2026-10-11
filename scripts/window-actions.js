// ウィンドウ/タブの操作（プリセットの適用、タブの別ウィンドウ化、リンクを新ウィンドウで開く）。
// 背景スクリプト（background.js）とコンテキストメニュー（menus.js）から使う。
// 依存: logger.js / store.js（読み込み順は manifest.json の background.scripts を参照）

// 設定されている拡大率の係数（150% なら 1.5）を取得する
async function getSystemDpr() {
  try {
    return await FwrStore.getDprFactor();
  } catch (err) {
    await Logger.error('DPR設定読み込みエラー:', err);
    return 1.0; // エラー時のデフォルト値
  }
}

/**
 * 物理ピクセル値を論理ピクセル値に変換する
 * @param {Object} physicalValues - 物理ピクセル値 (width, height, left, top)
 * @param {number} [dpr] - 使用するDPR値（指定なしの場合は取得）
 * @returns {Promise<Object>} 論理ピクセル値とテーブル出力
 */
async function convertToLogicalPixels(physicalValues, dpr = null) {
  // DPR値が指定されていない場合は取得
  if (dpr === null) {
    dpr = await getSystemDpr();
  }
  
  // 変換処理（共通モジュールの変換を使用）
  const result = FwrStore.toLogical(physicalValues, dpr);
  
  // ログ用テーブル（オプション）
  const tableData = {
    幅: { 元値: physicalValues.width, 計算式: `${physicalValues.width} / ${dpr}`, 変換後: result.width },
    高さ: { 元値: physicalValues.height, 計算式: `${physicalValues.height} / ${dpr}`, 変換後: result.height },
    左位置: { 元値: physicalValues.left, 計算式: `${physicalValues.left} / ${dpr}`, 変換後: result.left },
    上位置: { 元値: physicalValues.top, 計算式: `${physicalValues.top} / ${dpr}`, 変換後: result.top }
  };
  
  return { 
    values: result, 
    tableData: tableData,
    dpr: dpr
  };
}

// 現在のウィンドウIDを取得
async function getCurrentWindowId() {
  // バックグラウンドには「現在のウィンドウ」がないため、最後にフォーカスされた通常ウィンドウを使う
  const win = await browser.windows.getLastFocused({ windowTypes: ['normal'] });
  return win.id;
}

/**
 * プリセットに基づいてウィンドウサイズを適用する統合関数
 * @param {Object} preset - 適用するプリセット
 * @param {boolean} detachTab - 現在のタブを別ウィンドウに分離するかどうか
 * @param {number} targetWindowId - 対象ウィンドウID（指定がない場合は現在のウィンドウ）
 * @param {number} targetTabId - 分離対象のタブID（指定がない場合は対象ウィンドウのアクティブタブ）
 * @returns {Promise<Object>} 適用結果
 */
async function applyPresetWithOptions(preset, detachTab = false, targetWindowId = null, targetTabId = null) {
  try {
    const title = detachTab 
      ? `"${preset.name}" を適用（タブ分離モード）` 
      : `"${preset.name}" を適用`;
    
    return await Logger.logPresetOperation(title, async () => {
      // 1. 対象ウィンドウIDの決定
      const windowId = targetWindowId || await getCurrentWindowId();
      await Logger.info(`対象ウィンドウID: ${windowId} (${targetWindowId ? '指定' : '自動取得'})`);
      
      // 2. タブ分離モードの場合は対象ウィンドウのアクティブタブを取得
      
      // タブ分離モードの場合は現在のタブを取得
      let activeTab = null;
      if (detachTab) {
        if (targetTabId !== null) {
          activeTab = await browser.tabs.get(targetTabId);
        } else {
          const tabs = await browser.tabs.query({ active: true, windowId });

          if (!tabs || tabs.length === 0) {
            throw new Error('アクティブなタブが見つかりませんでした');
          }

          activeTab = tabs[0];
        }
        await Logger.info(`選択中のタブ: "${activeTab.title}" (ID: ${activeTab.id})`);
      }
      
      // 1. 元のプリセット値を出力
      await Logger.info("1. 元のプリセット値:", {
        width: preset.width,
        height: preset.height,
        left: preset.left,
        top: preset.top,
      });

      // 2. DPRの取得（非同期処理）
      const dpr = await getSystemDpr();
      await Logger.info(`2. ユーザー設定のDPR値: ${dpr} (拡大率: ${dpr * 100}%)`);

      // 3. 新しい変換関数を使用して物理→論理変換
      const physicalValues = {
        width: preset.width,
        height: preset.height,
        left: preset.left,
        top: preset.top
      };
      
      await Logger.info("3. 物理ピクセル値をDPRで割って論理ピクセル値に変換");
      const conversion = await convertToLogicalPixels(physicalValues, dpr);
      
      // テーブル出力
      await Logger.table(conversion.tableData);
      
      // 論理値を取得
      const logicalValues = conversion.values;
      
      let result;
      
      // タブ分離モードによって処理を分岐
      if (detachTab) {
        // タブ分離モード: 空のウィンドウを作成してタブを移動
        await Logger.info(`4. タブ "${activeTab.title}" を新しいウィンドウに分離して適用`);
        await Logger.info(`対象タブID: ${activeTab.id}`);
        
        // 1. まず空のウィンドウを作成（about:blankで）
        const windowCreateValues = {
          ...logicalValues,
          url: "about:blank"  // 空のウィンドウを作成
        };
        
        await Logger.info("新しい空のウィンドウを作成する値:", windowCreateValues);
        
        const newWindow = await browser.windows.create(windowCreateValues);
        await Logger.info("新しい空のウィンドウを作成しました:", { 
          id: newWindow.id, 
          left: newWindow.left, 
          top: newWindow.top,
          width: newWindow.width,
          height: newWindow.height 
        });
        
        // 2. 現在のタブを新しいウィンドウに移動（状態を保持）
        await Logger.info(`タブ ${activeTab.id} を新しいウィンドウ ${newWindow.id} に移動中...`);
        const movedTab = await browser.tabs.move(activeTab.id, {
          windowId: newWindow.id,
          index: 0  // 最初の位置に移動
        });
        await Logger.info("タブの移動が完了しました:", { 
          tabId: movedTab[0].id, 
          windowId: movedTab[0].windowId 
        });
        
        // 3. 新しいウィンドウの空のタブ（about:blank）を削除
        const newWindowTabs = await browser.tabs.query({ windowId: newWindow.id });
        const blankTab = newWindowTabs.find(tab => tab.url === "about:blank" && tab.id !== movedTab[0].id);
        if (blankTab) {
          await Logger.info(`空のタブ ${blankTab.id} を削除中...`);
          await browser.tabs.remove(blankTab.id);
        }
        
        // 4. 座標がずれている場合は再調整
        if (newWindow.left !== windowCreateValues.left || newWindow.top !== windowCreateValues.top) {
          await Logger.warn("座標がずれました。再調整中...");
          await Logger.info("期待値:", { left: windowCreateValues.left, top: windowCreateValues.top });
          await Logger.info("実際値:", { left: newWindow.left, top: newWindow.top });
          
          // 再度位置を調整
          const correctedWindow = await browser.windows.update(newWindow.id, {
            left: windowCreateValues.left,
            top: windowCreateValues.top
          });
          await Logger.info("再調整後:", { left: correctedWindow.left, top: correctedWindow.top });
          result = correctedWindow;
        } else {
          result = newWindow;
        }
      } else {
        // 通常モード: 既存ウィンドウを更新
        await Logger.info("4. ウィンドウに適用する最終値:", logicalValues);
        await Logger.info(`対象ウィンドウID: ${windowId}`);
        
        result = await browser.windows.update(windowId, logicalValues);
      }

      // 結果オブジェクトを単純化
      const simplifiedResult = {
        id: result.id,
        width: result.width,
        height: result.height,
        left: result.left,
        top: result.top,
        type: result.type,
        state: result.state,
        detached: detachTab // タブ分離情報を追加
      };
      
      // 5. 適用結果
      await Logger.info("5. 適用結果:", simplifiedResult);
      
      return { success: true, result: simplifiedResult };
    });
  } catch (error) {
    const errorType = detachTab ? 'タブ分離' : 'プリセット適用';
    await Logger.error(`${errorType}エラー:`, error);
    throw error;
  }
}

// 指定のウィンドウにプリセットを適用（起動時適用などから呼ばれる）
async function applyPresetToWindow(windowId, preset) {
  try {
    return await applyPresetWithOptions(preset, false, windowId);
  } catch (error) {
    await Logger.error(`ウィンドウ ${windowId} へのプリセット適用エラー:`, error);
    throw error;
  }
}

/**
 * リンクURLを新しいウィンドウで開いてプリセットを適用
 * @param {string} url - 開くURL
 * @param {Object} preset - 適用するプリセット
 * @param {number} [windowId] - URLを開く元のウィンドウID（未指定なら現在のウィンドウ）
 */
async function openLinkInNewWindowWithPreset(url, preset, windowId = null) {
  try {
    await Logger.logPresetOperation('リンクを新ウィンドウで開く', async () => {
      await Logger.info(`リンクURLを新しいウィンドウで開きます: ${url}`);
      await Logger.info(`適用プリセット: ${preset.name} (${preset.width}×${preset.height})`);
      
      // 1. 指定ウィンドウ（なければ最後にフォーカスされた通常ウィンドウ）でURLをタブとして開く
      const currentWindow = windowId !== null && windowId !== undefined
        ? { id: windowId }
        : await browser.windows.getLastFocused({ windowTypes: ['normal'] });
      await Logger.info(`現在のウィンドウID: ${currentWindow.id}`);
      
      const newTab = await browser.tabs.create({
        url: url,
        windowId: currentWindow.id,
        active: true
      });
      await Logger.info(`新しいタブを作成しました: ID ${newTab.id}`);
      
      // 2. 少し待機してタブの読み込みを待つ
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 3. applyPresetWithOptions関数を使用してタブを別ウィンドウ化＋プリセット適用
      await Logger.info(`タブ分離モードでプリセットを適用します`);
      const result = await applyPresetWithOptions(preset, true, currentWindow.id, newTab.id);
      
      await Logger.info(`リンクを新ウィンドウで開く処理が完了しました:`, result);
      return result;
    });
  } catch (error) {
    await Logger.error('リンクを新ウィンドウで開く処理エラー:', error);
    throw error;
  }
}

// 設定ページを開く関数
async function openSettingsPage() {
  await Logger.logSystemOperation('設定ページを開く', async () => {
    await Logger.info('設定ページを開きます');

    // 既存の設定タブを検索
    let settingsTab = null;
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.includes('views/settings.html')) {
        settingsTab = tab;
        break;
      }
    }

    if (settingsTab) {
      // 既存の設定タブがある場合は、それをアクティブにする
      browser.tabs.update(settingsTab.id, { active: true });
    } else {
      // 既存の設定タブがない場合は、新しいタブで開く
      browser.tabs.create({ url: 'views/settings.html' });
    }
  });
}
