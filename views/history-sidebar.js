// 履歴サイドバーのJavaScript処理

const HISTORY_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 250;
const MAX_FETCH_LIMIT = 1000000; // 「すべて読み込む」の安全上限

let searchTimer = null;
let expandedItem = null;
let contextMenuElement = null;

// 読み込み済みの履歴。取得件数の上限を引き上げて取得し直すたびに置き換える
let loadedItems = [];
let fetchLimit = HISTORY_PAGE_SIZE; // history.search の maxResults
let hasMore = false;
let loadingAll = false;      // 「すべて読み込む」実行中
let cancelLoadAll = false;   // 「すべて読み込む」の中止要求
let currentQuery = '';
// ユーザーが開閉した日付グループの状態（key -> open）。未操作の日付は既定の状態になる
let toggledGroups = new Map();

document.addEventListener('DOMContentLoaded', async function () {
  const searchInput = document.getElementById('search-input');

  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadHistory, SEARCH_DEBOUNCE_MS);
  });

  // メニュー外のクリック、Escape、スクロール、フォーカス喪失でコンテキストメニューを閉じる
  document.addEventListener('click', closeContextMenu);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeContextMenu();
    }
  });
  window.addEventListener('blur', closeContextMenu);
  window.addEventListener('resize', closeContextMenu);
  document.addEventListener('scroll', closeContextMenu, true);

  document.getElementById('history-more').addEventListener('click', loadMoreHistory);
  document.getElementById('history-all').addEventListener('click', function () {
    if (loadingAll) {
      cancelLoadAll = true;
      return undefined;
    }
    return loadAllHistory();
  });

  await loadHistory();
});

// 履歴を最初から検索して一覧を表示（検索語の変更時など）
async function loadHistory() {
  currentQuery = document.getElementById('search-input').value.trim();
  loadedItems = [];
  fetchLimit = HISTORY_PAGE_SIZE;
  hasMore = false;
  toggledGroups = new Map();

  await fetchHistory();
}

// 「さらに読み込む」: 取得件数の上限を引き上げて取得し直す
// （history.search の endTime で区切ると、複数回訪問したページが毎回先頭に返り、
//   先へ進めなくなるため、新しい順の先頭 N 件を取得し直す方式にしている）
async function loadMoreHistory() {
  if (loadingAll) {
    return;
  }
  fetchLimit += HISTORY_PAGE_SIZE;
  await fetchHistory();
}

// 「すべて読み込む」: 履歴がなくなるまで上限を倍にして取得し直す（途中で中止できる）
async function loadAllHistory() {
  const status = document.getElementById('history-status');
  const allButton = document.getElementById('history-all');
  const moreButton = document.getElementById('history-more');

  loadingAll = true;
  cancelLoadAll = false;
  moreButton.disabled = true;
  allButton.textContent = '中止';

  try {
    while (hasMore && !cancelLoadAll && fetchLimit < MAX_FETCH_LIMIT) {
      fetchLimit = Math.min(fetchLimit * 2, MAX_FETCH_LIMIT);
      const ok = await fetchHistory({ render: false });
      if (!ok) {
        break;
      }
      status.textContent = `読み込み中… ${loadedItems.length}件`;
    }
  } finally {
    loadingAll = false;
    cancelLoadAll = false;
    moreButton.disabled = false;
    allButton.textContent = 'すべて読み込む';
    status.textContent = loadedItems.length === 0 ? '履歴が見つかりません' : '';
    renderHistory();
  }
}

// 履歴を新しい順に fetchLimit 件取得して、一覧に反映する。成功したら true を返す
async function fetchHistory(options) {
  const render = !options || options.render !== false;
  const status = document.getElementById('history-status');

  try {
    const items = await browser.history.search({
      text: currentQuery,
      startTime: 0,
      maxResults: fetchLimit
    });

    loadedItems = items;
    // 上限いっぱいまで返ってきた間は、続きがあるとみなす
    hasMore = items.length >= fetchLimit;
    if (render) {
      status.textContent = loadedItems.length === 0 ? '履歴が見つかりません' : '';
      renderHistory();
    }
    return true;
  } catch (err) {
    await Logger.error('履歴読み込みエラー:', err);
    status.textContent = '履歴の読み込みに失敗しました';
    return false;
  }
}

// 日付ごとの開閉できるツリーとして描画する
function renderHistory() {
  const list = document.getElementById('history-list');
  const moreRow = document.getElementById('history-more-row');
  const todayKey = HistoryGroups.dateKey(Date.now());

  list.innerHTML = '';
  expandedItem = null;

  for (const group of HistoryGroups.groupByDate(loadedItems)) {
    const li = document.createElement('li');
    li.className = 'history-group';

    const details = document.createElement('details');
    // 未操作の日付: 検索中はすべて開く。通常は今日だけ開く
    details.open = toggledGroups.has(group.key)
      ? toggledGroups.get(group.key)
      : (currentQuery !== '' || group.key === todayKey);

    // 件数が多くても軽いよう、項目は開いたときに初めて描画する
    const items = document.createElement('ul');
    items.className = 'history-group-items';
    let filled = false;
    const fillItems = function () {
      if (filled) {
        return;
      }
      filled = true;
      for (const item of group.items) {
        items.appendChild(createHistoryItem(item));
      }
    };

    details.addEventListener('toggle', function () {
      toggledGroups.set(group.key, details.open);
      if (details.open) {
        fillItems();
      }
    });

    const summary = document.createElement('summary');
    summary.className = 'history-group-summary';

    const label = document.createElement('span');
    label.className = 'history-group-label';
    label.textContent = HistoryGroups.groupLabel(group.key);

    const count = document.createElement('span');
    count.className = 'history-group-count';
    count.textContent = `${group.items.length}件`;

    summary.appendChild(label);
    summary.appendChild(count);
    details.appendChild(summary);

    details.appendChild(items);
    if (details.open) {
      fillItems();
    }

    li.appendChild(details);
    list.appendChild(li);
  }

  moreRow.hidden = !hasMore && !loadingAll;
}

// 履歴項目を作成（クリックでプリセット選択を展開）
function createHistoryItem(historyItem) {
  const li = document.createElement('li');
  li.className = 'history-item';

  const header = document.createElement('div');
  header.className = 'history-item-header';
  header.title = historyItem.url;

  const title = document.createElement('div');
  title.className = 'history-title';
  title.textContent = historyItem.title || historyItem.url;

  const url = document.createElement('div');
  url.className = 'history-url';
  url.textContent = historyItem.url;

  header.appendChild(title);
  header.appendChild(url);

  // 最終訪問日時
  if (historyItem.lastVisitTime) {
    const time = document.createElement('div');
    time.className = 'history-time';
    time.textContent = HistoryGroups.formatTime(historyItem.lastVisitTime);
    header.appendChild(time);
  }

  const presetsBox = document.createElement('div');
  presetsBox.className = 'history-presets';

  li.appendChild(header);
  li.appendChild(presetsBox);

  // 右クリック: ブラウザ標準メニューの代わりに、プリセットを直接選べるメニューを表示
  li.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, historyItem.url);
  });

  header.addEventListener('click', async function () {
    const wasExpanded = li.classList.contains('expanded');

    if (expandedItem) {
      expandedItem.classList.remove('expanded');
      expandedItem = null;
    }
    if (wasExpanded) {
      return;
    }

    await renderPresetButtons(presetsBox, historyItem.url);
    li.classList.add('expanded');
    expandedItem = li;
  });

  return li;
}

// 毎回プリセットを選択する：展開部にプリセットのボタンを表示
async function renderPresetButtons(container, url) {
  container.innerHTML = '';

  const presets = await FwrStore.getPresets();

  if (presets.length === 0) {
    const message = document.createElement('div');
    message.className = 'history-presets-label';
    message.textContent = 'プリセットがありません。設定ページで作成してください。';
    container.appendChild(message);
    return;
  }

  const label = document.createElement('div');
  label.className = 'history-presets-label';
  label.textContent = 'プリセットを選んで別ウィンドウで開く';
  container.appendChild(label);

  for (const preset of presets) {
    container.appendChild(createPresetButton(preset, url));
  }
}

// プリセット選択ボタンを作成
function createPresetButton(preset, url) {
  const button = document.createElement('button');
  button.className = 'history-preset-button';
  button.appendChild(document.createTextNode(preset.name));

  const size = document.createElement('span');
  size.className = 'history-preset-size';
  size.textContent = `  ${FwrStore.formatSize(preset)}`;
  button.appendChild(size);

  button.addEventListener('click', function () {
    openWithPreset(url, preset);
  });
  return button;
}

// 履歴項目の右クリックメニュー（階層なしでプリセットを直接選択）
async function showContextMenu(x, y, url) {
  closeContextMenu();

  const presets = await FwrStore.getPresets();

  const menu = document.createElement('div');
  menu.className = 'history-context-menu';

  const title = document.createElement('div');
  title.className = 'history-context-title';
  title.textContent = 'Firefox Window Resizer（履歴を別ウィンドウで開く）';
  menu.appendChild(title);

  if (presets.length === 0) {
    const message = document.createElement('div');
    message.className = 'history-presets-label';
    message.textContent = 'プリセットがありません';
    menu.appendChild(message);
  }

  for (const preset of presets) {
    menu.appendChild(createPresetButton(preset, url));
  }

  // 画面外にはみ出さないよう位置を調整
  menu.style.visibility = 'hidden';
  document.body.appendChild(menu);
  const left = Math.max(0, Math.min(x, window.innerWidth - menu.offsetWidth));
  const top = Math.max(0, Math.min(y, window.innerHeight - menu.offsetHeight));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.style.visibility = 'visible';

  contextMenuElement = menu;
}

function closeContextMenu() {
  if (contextMenuElement) {
    contextMenuElement.remove();
    contextMenuElement = null;
  }
}

// バックグラウンドへ「URLを別ウィンドウで開く」を依頼
async function openWithPreset(url, preset) {
  try {
    const currentWindow = await browser.windows.getCurrent();
    await browser.runtime.sendMessage({
      action: 'openUrlWithPreset',
      url: url,
      preset: preset,
      windowId: currentWindow.id
    });
  } catch (err) {
    await Logger.error('履歴を別ウィンドウで開くエラー:', err);
  }
}
