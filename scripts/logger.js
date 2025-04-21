/**
 * 構造化されたロギングを提供するモジュール
 */
class Logger {
  /**
   * デバッグレベル定数
   */
  static DEBUG_LEVEL = {
    NONE: 0,    // ログ出力なし
    ERROR: 1,   // エラーのみ
    WARN: 2,    // 警告以上
    INFO: 3,    // 情報以上
    DEBUG: 4,   // すべて表示（詳細なデバッグ情報）
    ALL: 5      // すべて（トレースなど）
  };

  /**
   * 現在のデバッグ設定
   */
  static debugLevel = Logger.DEBUG_LEVEL.ALL;
  static debugMode = true; // デフォルトは有効
  
  /**
   * グループのネストレベルを追跡
   */
  static nestedLevel = 0;
  
  /**
   * 実行中のグループスタック（グループ名を追跡）
   */
  static activeGroups = [];

  /**
   * 初期化済みフラグ
   */
  static isInitialized = false;

  /**
   * デバッグモードの初期化（ストレージから設定を読み込む）
   */
  static async initDebugMode() {
    try {
      const data = await browser.storage.local.get('debugMode');
      Logger.debugMode = data.debugMode !== false; // 設定がなければデフォルトでtrue
      
      // 読み込み結果を直接console.logで出力（初期化中なのでLoggerは使わない）
     // console.log(`Logger デバッグモード: ${Logger.debugMode ? '有効' : '無効'}`);
      
      // デバッグレベル設定も読み込み
      const levelData = await browser.storage.local.get('debugLevel');
      if (levelData.debugLevel !== undefined) {
        Logger.debugLevel = levelData.debugLevel;
        console.log(`Logger デバッグレベル: ${Logger.debugLevel}`);
      }
    } catch (error) {
      console.error('Logger 初期化エラー:', error);
    }
  }
  
  /**
   * デバッグモードを設定
   * @param {boolean} enabled - 有効/無効
   */
  static setDebugMode(enabled) {
    Logger.debugMode = enabled;
    browser.storage.local.set({ debugMode: enabled }).catch(err => {
      console.error('デバッグモード設定保存エラー:', err);
    });
  }
  
  /**
   * デバッグレベルを設定
   * @param {number} level - デバッグレベル
   */
  static setDebugLevel(level) {
    if (level >= Logger.DEBUG_LEVEL.NONE && level <= Logger.DEBUG_LEVEL.ALL) {
      Logger.debugLevel = level;
      browser.storage.local.set({ debugLevel: level }).catch(err => {
        console.error('デバッグレベル設定保存エラー:', err);
      });
    }
  }

  /**
   * グループ化されたログ出力を開始（ネストレベル追跡付き）
   * @param {string} groupName - グループ名
   * @returns {string} グループID
   */
  static startGroup(groupName) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      // ネストレベル増加
      Logger.nestedLevel++;
      
      // グループスタックに追加
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      Logger.activeGroups.push({
        id: groupId,
        name: groupName,
        level: Logger.nestedLevel
      });
      
      // ネストレベルに応じたインデントと装飾を追加
      const indent = '  '.repeat(Math.max(0, Logger.nestedLevel - 1));
      const prefix = Logger.nestedLevel > 1 ? '┗ ' : '';
      
      console.group(`${indent}${prefix}${groupName}`);
      return groupId;
    }
    return null;
  }
  
  /**
   * 折りたたまれたグループを開始（ネストレベル追跡付き）
   * @param {string} groupName - グループ名
   * @returns {string} グループID
   */
  static startCollapsedGroup(groupName) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      // ネストレベル増加
      Logger.nestedLevel++;
      
      // グループスタックに追加
      const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      Logger.activeGroups.push({
        id: groupId,
        name: groupName,
        level: Logger.nestedLevel
      });
      
      // ネストレベルに応じたインデントと装飾を追加
      const indent = '  '.repeat(Math.max(0, Logger.nestedLevel - 1));
      const prefix = Logger.nestedLevel > 1 ? '┗ ' : '';
      
      console.groupCollapsed(`${indent}${prefix}${groupName}`);
      return groupId;
    }
    return null;
  }

  /**
   * グループを終了（ネストレベル追跡付き）
   * @param {string} groupId - グループID（省略可）
   */
  static endGroup(groupId = null) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      if (groupId && Logger.activeGroups.length > 0) {
        // 特定のグループIDが指定された場合
        const index = Logger.activeGroups.findIndex(g => g.id === groupId);
        if (index >= 0) {
          // このグループより後に開始されたすべてのグループも閉じる
          const closeCount = Logger.activeGroups.length - index;
          
          // 閉じる必要があるグループの数だけgroupEndを呼び出す
          for (let i = 0; i < closeCount; i++) {
            console.groupEnd();
          }
          
          // スタックから削除
          Logger.activeGroups.splice(index, closeCount);
          
          // ネストレベルを適切に調整
          Logger.nestedLevel = index > 0 ? Logger.activeGroups[index - 1].level : 0;
        }
      } else if (Logger.activeGroups.length > 0) {
        // グループIDが指定されていない場合は最新のグループを閉じる
        Logger.activeGroups.pop();
        console.groupEnd();
        
        // ネストレベル減少
        if (Logger.nestedLevel > 0) {
          Logger.nestedLevel--;
        }
      } else {
        // 安全策：アクティブなグループがなくても一応groupEndを呼び出す
        console.groupEnd();
        Logger.nestedLevel = 0;
      }
    }
  }

  /**
   * 共通操作用のグループ化関数 - 非同期対応版
   * @param {string} prefix - グループ接頭辞
   * @param {string} title - グループタイトル 
   * @param {function} logFunction - ログ出力を行うコールバック関数（非同期可）
   * @returns {Promise<any>} コールバック関数の戻り値
   */
  static async logOperationGroup(prefix, title, logFunction) {
    if (!Logger.debugMode || Logger.debugLevel < Logger.DEBUG_LEVEL.INFO) {
      // デバッグモード無効時は単純にコールバックを実行して戻り値を返す
      return await logFunction();
    }
    
    const fullTitle = `${prefix}: ${title}`;
    const groupId = Logger.startGroup(fullTitle);
    
    try {
      // コールバック関数を実行（非同期関数にも対応）
      const result = await logFunction();
      return result;
    } catch (error) {
      // エラーをログに記録
      Logger.error(`${fullTitle} でエラーが発生しました:`, error);
      throw error; // エラーを再スロー
    } finally {
      // 必ずグループを終了
      Logger.endGroup(groupId);
    }
  }

  /**
   * デバッグログを出力（ネストに対応）
   * @param {string} message - メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static debug(message, data) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.DEBUG) {
      if (data !== undefined) {
        console.debug(message, data);
      } else {
        console.debug(message);
      }
    }
  }

  /**
   * 情報ログを出力（ネストに対応）
   * @param {string} message - メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static info(message, data) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      // 現在のグループコンテキストを尊重する（追加のインデントは不要）
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * 警告ログを出力（ネストに対応）
   * @param {string} message - 警告メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static warn(message, data) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.WARN) {
      if (data !== undefined) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  }

  /**
   * エラーログを出力（ネストに対応）
   * @param {string} message - エラーメッセージ
   * @param {Error} error - エラーオブジェクト（オプショナル）
   */
  static error(message, error) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.ERROR) {
      if (error) {
        console.error(message, error);
      } else {
        console.error(message);
      }
    }
  }

  /**
   * テーブル形式でデータを出力
   * @param {any} data - テーブルで表示するデータ
   */
  static table(data) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      console.table(data);
    }
  }

  /**
   * DPR関連のログ出力をグループ化 - 非同期対応版
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数（非同期可）
   * @returns {Promise<any>} コールバック関数の戻り値
   */
  static async logDprOperation(title, logFunction) {
    return await Logger.logOperationGroup('DPR設定', title, logFunction);
  }

  /**
   * ウィンドウサイズ関連のログ出力をグループ化 - 非同期対応版
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数（非同期可）
   * @returns {Promise<any>} コールバック関数の戻り値
   */
  static async logWindowOperation(title, logFunction) {
    return await Logger.logOperationGroup('ウィンドウサイズ', title, logFunction);
  }

  /**
   * プリセット関連のログ出力をグループ化 - 非同期対応版
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数（非同期可）
   * @returns {Promise<any>} コールバック関数の戻り値
   */
  static async logPresetOperation(title, logFunction) {
    return await Logger.logOperationGroup('プリセット', title, logFunction);
  }

  /**
   * システム関連のログ出力をグループ化 - 非同期対応版
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数（非同期可）
   * @returns {Promise<any>} コールバック関数の戻り値
   */
  static async logSystemOperation(title, logFunction) {
    return await Logger.logOperationGroup('システム', title, logFunction);
  }
  
  /**
   * 開発者向けデバッグ機能を追加（開発中のみ使用）
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logDevDebug(title, logFunction) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.DEBUG) {
      Logger.startCollapsedGroup(`開発者向け: ${title}`);
      try {
        logFunction();
      } finally {
        Logger.endGroup();
      }
    }
  }

  /**
   * 既存のloggerオブジェクトとの互換性用メソッド
   * （background.jsにあるloggerオブジェクトからの移行用）
   */
  static get compatLogger() {
    return {
      debug: (...args) => Logger.debug(...args),
      info: (...args) => Logger.info(...args),
      warn: (...args) => Logger.warn(...args),
      error: (...args) => Logger.error(...args)
    };
  }
  
  /**
   * 初期化メソッド - 完全な非同期処理に変更
   * @returns {Promise<boolean>} 初期化完了を示すPromise
   */
  static async initialize() {
    // 二重初期化防止
    if (Logger.isInitialized) return true;
    
    try {
      await Logger.initDebugMode();
      
      // 制限を削除し、常に初期化メッセージを表示
      // console.log('Logger デバッグモード: ' + (Logger.debugMode ? '有効' : '無効'));
      // console.log('Loggerを初期化しました');
      
      // 互換性用の処理
      if (typeof window !== 'undefined') {
        window.logger = Logger.compatLogger;
      }
      
      Logger.isInitialized = true;
      return true;
    } catch (err) {
      console.error('Logger初期化エラー:', err);
      return false;
    }
  }
}

// 拡張機能の起動時に自動初期化
document.addEventListener('DOMContentLoaded', async () => {
  await Logger.initialize();
});

// グローバルに公開
window.Logger = Logger;