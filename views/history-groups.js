// 履歴の日付グループ化に使う純粋関数（DOM・browser API に依存しない）。
// サイドバー（views/history-sidebar.js）とテスト（tests/history-groups.test.js）から使う。
(function (root) {
  var WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var UNKNOWN_KEY = 'unknown';

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  // ローカルタイムゾーンでの日付キー（YYYY-MM-DD）。日時がなければ 'unknown'
  function dateKey(timestamp) {
    if (!timestamp) {
      return UNKNOWN_KEY;
    }
    var d = new Date(timestamp);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  // 履歴項目を日付ごとにグループ化する（日付・項目とも新しい順）
  function groupByDate(items) {
    var map = {};
    var order = [];
    var sorted = items.slice().sort(function (a, b) {
      return (b.lastVisitTime || 0) - (a.lastVisitTime || 0);
    });
    sorted.forEach(function (item) {
      var key = dateKey(item.lastVisitTime);
      if (!map[key]) {
        map[key] = { key: key, items: [] };
        order.push(key);
      }
      map[key].items.push(item);
    });
    return order.map(function (key) {
      return map[key];
    });
  }

  // 見出し用ラベル: 今日 (2026/10/11) / 昨日 (2026/10/10) / 2026/10/09 (金)
  function groupLabel(key, now) {
    if (key === UNKNOWN_KEY) {
      return '日時不明';
    }
    var base = now === undefined ? Date.now() : now;
    var parts = key.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    var text = parts[0] + '/' + parts[1] + '/' + parts[2];
    if (key === dateKey(base)) {
      return '今日 (' + text + ')';
    }
    var yesterday = new Date(base);
    yesterday.setDate(yesterday.getDate() - 1);
    if (key === dateKey(yesterday.getTime())) {
      return '昨日 (' + text + ')';
    }
    return text + ' (' + WEEKDAYS[date.getDay()] + ')';
  }

  // 時刻のみ（HH:mm）
  function formatTime(timestamp) {
    if (!timestamp) {
      return '';
    }
    var d = new Date(timestamp);
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  var api = {
    UNKNOWN_KEY: UNKNOWN_KEY,
    dateKey: dateKey,
    groupByDate: groupByDate,
    groupLabel: groupLabel,
    formatTime: formatTime
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.HistoryGroups = api;
  }
})(typeof self !== 'undefined' ? self : this);
