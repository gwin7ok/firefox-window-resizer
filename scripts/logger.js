// コンソールへのログ出力（console の薄いラッパー）。
// 背景スクリプトと各画面から共通で使う。DevTools のコンソール（about:debugging の「調査」）で確認できる。
//
// 出力レベルは Logger.level で変更できる（既定は DEBUG = すべて出力）。
//   Logger.level = Logger.LEVEL.WARN;  // 警告とエラーのみ
const Logger = (function () {
  const LEVEL = {
    NONE: 0,   // 出力しない
    ERROR: 1,  // エラー
    WARN: 2,   // 警告
    INFO: 3,   // 情報
    DEBUG: 4   // すべて（デバッグ情報を含む）
  };

  const logger = {
    LEVEL: LEVEL,
    level: LEVEL.DEBUG,

    debug: function (...args) {
      if (logger.level >= LEVEL.DEBUG) {
        console.debug(...args);
      }
    },

    info: function (...args) {
      if (logger.level >= LEVEL.INFO) {
        console.log(...args);
      }
    },

    warn: function (...args) {
      if (logger.level >= LEVEL.WARN) {
        console.warn(...args);
      }
    },

    error: function (...args) {
      if (logger.level >= LEVEL.ERROR) {
        console.error(...args);
      }
    },

    table: function (data) {
      if (logger.level >= LEVEL.INFO) {
        console.table(data);
      }
    },

    // 処理を console.group で囲んで実行し、コールバックの戻り値を返す。
    // 例外はそのまま再スローする（呼び出し側でログ出力・処理する）。
    group: async function (title, callback) {
      if (logger.level < LEVEL.INFO) {
        return await callback();
      }
      console.group(title);
      try {
        return await callback();
      } finally {
        console.groupEnd();
      }
    },

    logPresetOperation: function (title, callback) {
      return logger.group('プリセット: ' + title, callback);
    },

    logSystemOperation: function (title, callback) {
      return logger.group('システム: ' + title, callback);
    },

    logDprOperation: function (title, callback) {
      return logger.group('DPR設定: ' + title, callback);
    },

    logWindowOperation: function (title, callback) {
      return logger.group('ウィンドウサイズ: ' + title, callback);
    }
  };

  return logger;
})();

if (typeof window !== 'undefined') {
  window.Logger = Logger;
}
