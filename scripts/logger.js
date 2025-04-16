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
  static debugLevel = Logger.DEBUG_LEVEL.INFO;
  static debugMode = true; // デフォルトは有効
  
  /**
   * デバッグモードの初期化（ストレージから設定を読み込む）
   */
  static async initDebugMode() {
    try {
      const data = await browser.storage.local.get('debugMode');
      Logger.debugMode = data.debugMode !== false; // 設定がなければデフォルトでtrue
      
      // 読み込み結果を直接console.logで出力（初期化中なのでLoggerは使わない）
      console.log(`Logger デバッグモード: ${Logger.debugMode ? '有効' : '無効'}`);
      
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
   * グループ化されたログ出力を開始
   * @param {string} groupName - グループ名
   */
  static startGroup(groupName) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      console.group(groupName);
    }
  }
  
  /**
   * 折りたたまれたグループを開始
   * @param {string} groupName - グループ名
   */
  static startCollapsedGroup(groupName) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      console.groupCollapsed(groupName);
    }
  }

  /**
   * グループを終了
   */
  static endGroup() {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      console.groupEnd();
    }
  }

  /**
   * デバッグログを出力（最も詳細なレベル）
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
   * 情報ログを出力
   * @param {string} message - メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static info(message, data) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      if (data !== undefined) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * 警告ログを出力
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
   * エラーログを出力
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
   * DPR関連のログ出力をグループ化
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logDprOperation(title, logFunction) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      Logger.startGroup(`DPR設定: ${title}`);
      try {
        logFunction();
      } finally {
        Logger.endGroup();
      }
    }
  }

  /**
   * ウィンドウサイズ関連のログ出力をグループ化
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logWindowOperation(title, logFunction) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      Logger.startGroup(`ウィンドウサイズ: ${title}`);
      try {
        logFunction();
      } finally {
        Logger.endGroup();
      }
    }
  }

  /**
   * プリセット関連のログ出力をグループ化
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logPresetOperation(title, logFunction) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      Logger.startGroup(`プリセット: ${title}`);
      try {
        logFunction();
      } finally {
        Logger.endGroup();
      }
    }
  }

  /**
   * システム関連のログ出力をグループ化
   * @param {string} title - グループタイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logSystemOperation(title, logFunction) {
    if (Logger.debugMode && Logger.debugLevel >= Logger.DEBUG_LEVEL.INFO) {
      Logger.startGroup(`システム: ${title}`);
      try {
        logFunction();
      } finally {
        Logger.endGroup();
      }
    }
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
   * 初期化メソッド - background.js起動時に呼び出すこと
   */
  static initialize() {
    Logger.initDebugMode().then(() => {
      Logger.info('Loggerを初期化しました');
    });
    
    // 既存のloggerオブジェクトを置き換え（互換性用）
    if (typeof window !== 'undefined') {
      window.logger = Logger.compatLogger;
    }
  }
}

// 拡張機能の起動時に自動初期化
document.addEventListener('DOMContentLoaded', () => {
  Logger.initialize();
});

// グローバルに公開
window.Logger = Logger;