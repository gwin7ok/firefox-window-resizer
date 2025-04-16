/**
 * 構造化されたロギングを提供するモジュール
 */
class Logger {
  /**
   * グループ化されたログ出力を開始
   * @param {string} groupName - グループ名
   */
  static startGroup(groupName) {
    console.group(groupName);
  }

  /**
   * グループを終了
   */
  static endGroup() {
    console.groupEnd();
  }

  /**
   * 情報ログを出力
   * @param {string} message - メッセージ
   * @param {any} data - 追加データ（オプショナル）
   */
  static info(message, data) {
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
    console.table(data);
  }

  /**
   * DPR関連のログ出力をグループ化
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logDprOperation(title, logFunction) {
    Logger.startGroup(`DPR設定: ${title}`);
    try {
      logFunction();
    } finally {
      Logger.endGroup();
    }
  }

  /**
   * ウィンドウサイズ関連のログ出力をグループ化
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logWindowOperation(title, logFunction) {
    Logger.startGroup(`ウィンドウサイズ: ${title}`);
    try {
      logFunction();
    } finally {
      Logger.endGroup();
    }
  }

  /**
   * プリセット関連のログ出力をグループ化
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logPresetOperation(title, logFunction) {
    Logger.startGroup(`プリセット: ${title}`);
    try {
      logFunction();
    } finally {
      Logger.endGroup();
    }
  }

  /**
   * システム関連のログ出力をグループ化
   * @param {function} logFunction - ログ出力を行うコールバック関数
   */
  static logSystemOperation(title, logFunction) {
    Logger.startGroup(`システム: ${title}`);
    try {
      logFunction();
    } finally {
      Logger.endGroup();
    }
  }
}

// グローバルに公開
window.Logger = Logger;