/**
 * 構造化されたロギングを提供するモジュール
 */
class Logger {
  // デバッグモードの設定（開発時はtrueにする）
  static debugMode = true;
  
  // ログのキャプチャ設定
  static logs = [];
  static captureEnabled = false;
  
  /**
   * デバッグモードの設定
   * @param {boolean} isEnabled - デバッグモードを有効にするかどうか
   */
  static setDebugMode(isEnabled) {
    Logger.debugMode = isEnabled;
  }
  
  /**
   * ログキャプチャを有効化
   */
  static enableCapture() {
    Logger.captureEnabled = true;
    Logger.logs = [];
  }
  
  /**
   * ログキャプチャを無効化
   */
  static disableCapture() {
    Logger.captureEnabled = false;
  }
  
  /**
   * キャプチャしたログを取得
   * @returns {Array} キャプチャされたログの配列
   */
  static getCapturedLogs() {
    return Logger.logs;
  }
  
  /**
   * グループ化されたログ出力を開始
   * @param {string} groupName - グループ名
   */
  static startGroup(groupName) {
    if (!Logger.debugMode) return;
    console.group(groupName);
    
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'group-start',
        message: groupName,
        timestamp: new Date()
      });
    }
  }

  /**
   * 折りたたまれたグループを開始
   * @param {string} groupName - グループ名
   */
  static startCollapsedGroup(groupName) {
    if (!Logger.debugMode) return;
    console.groupCollapsed(groupName);
    
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'group-start-collapsed',
        message: groupName,
        timestamp: new Date()
      });
    }
  }

  /**
   * グループを終了
   */
  static endGroup() {
    if (!Logger.debugMode) return;
    console.groupEnd();
    
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'group-end',
        timestamp: new Date()
      });
    }
  }

  /**
   * 情報ログを出力
   * @param {string} message - メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static info(message, data) {
    if (!Logger.debugMode) return;
    
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'info',
        message,
        data,
        timestamp: new Date()
      });
    }
    
    if (data !== undefined) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }

  /**
   * 警告ログを出力
   * @param {string} message - 警告メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static warn(message, data) {
    // 警告は常に出力（デバッグモードに関わらず）
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'warn',
        message,
        data,
        timestamp: new Date()
      });
    }
    
    if (data !== undefined) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
  }

  /**
   * エラーログを出力
   * @param {string} message - エラーメッセージ
   * @param {Error} error - エラーオブジェクト（オプショナル）
   */
  static error(message, error) {
    // エラーは常に出力（デバッグモードに関わらず）
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'error',
        message,
        error: error ? error.toString() : null,
        stack: error && error.stack ? error.stack : null,
        timestamp: new Date()
      });
    }
    
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }

  /**
   * テーブル形式でデータを出力
   * @param {any} data - テーブルで表示するデータ
   */
  static table(data) {
    if (!Logger.debugMode) return;
    
    if (Logger.captureEnabled) {
      Logger.logs.push({
        type: 'table',
        data,
        timestamp: new Date()
      });
    }
    
    console.table(data);
  }

  /**
   * 汎用的な操作ログ出力をグループ化
   * @param {string} title - 操作タイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logOperation(category, title, logFunction) {
    if (!Logger.debugMode) {
      try {
        logFunction();
      } catch (error) {
        Logger.error(`${category}: ${title} 実行中にエラーが発生`, error);
      }
      return;
    }
    
    Logger.startGroup(`${category}: ${title}`);
    try {
      logFunction();
    } catch (error) {
      Logger.error(`実行中にエラーが発生`, error);
    } finally {
      Logger.endGroup();
    }
  }

  /**
   * DPR関連のログ出力をグループ化
   * @param {string} title - 操作タイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logDprOperation(title, logFunction) {
    Logger.logOperation('DPR設定', title, logFunction);
  }

  /**
   * ウィンドウサイズ関連のログ出力をグループ化
   * @param {string} title - 操作タイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logWindowOperation(title, logFunction) {
    Logger.logOperation('ウィンドウ', title, logFunction);
  }

  /**
   * プリセット関連のログ出力をグループ化
   * @param {string} title - 操作タイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logPresetOperation(title, logFunction) {
    Logger.logOperation('プリセット', title, logFunction);
  }

  /**
   * システム関連のログ出力をグループ化
   * @param {string} title - 操作タイトル
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logSystemOperation(title, logFunction) {
    Logger.logOperation('システム', title, logFunction);
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.Logger = Logger;
}

// background script 用に export
if (typeof module !== 'undefined') {
  module.exports = Logger;
}