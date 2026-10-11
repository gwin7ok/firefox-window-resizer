// 履歴サイドバーのJavaScript処理

const HISTORY_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 250;

let searchTimer = null;
let expandedItem = null;
let contextMenuElement = null;

// 読み込み済みの履歴（「さらに読み込む」で追加される）
let loadedItems = [];
let seenIds = new Set();
let oldestVisitTime = null; // 次ページ取得用（これより前の履歴を取得する）
let hasMore = false;
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

  await loadHistory();
});

// 履歴を最初から検索して一覧を表示（検索語の変更時など）
async function loadHistory() {
  currentQuery = document.getElementById('search-input').value.trim();
  loadedItems = [];
  seenIds = new Set();
  oldestVisitTime = null;
  hasMore = false;
  toggledGroups = new Map();

  await fetchHistoryPage();
}

// 「さらに読み込む」: 読み込み済みの最も古い履歴より前を取得する
async function loadMoreHistory() {
  await fetchHistoryPage();
}

// 履歴を1ページ分取得して、一覧に反映する
async function fetchHistoryPage() {
  const status = document.getElementById('history-status');

  try {
    const query = {
      text: currentQuery,
      startTime: 0,
      maxResults: HISTORY_PAGE_SIZE
    };
    if (oldestVisitTime !== null) {
      query.endTime = oldestVisitTime;
    }

    const items = await browser.history.search(query);

    let added = 0;
    for (const item of items) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        loadedItems.push(item);
        added++;
      }
      if (item.lastVisitTime && (oldestVisitTime === null || item.lastVisitTime < oldestVisitTime)) {
        oldestVisitTime = item.lastVisitTime;
      }
    }

    // 1ページ分が埋まっていて新しい項目が増えた場合のみ、続きがあるとみなす
    hasMore = items.length >= HISTORY_PAGE_SIZE && added > 0;
    status.textContent = loadedItems.length === 0 ? '履歴が見つかりません' : '';
    renderHistory();
  } catch (err) {
    await Logger.error('履歴読み込みエラー:', err);
    status.textContent = '履歴の読み込みに失敗しました';
  }
}

// 日付ごとの開閉できるツリーとして描画する
function renderHistory() {
  const list = document.getElementById('history-list');
  const moreButton = document.getElementById('history-more');
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
    details.addEventListener('toggle', function () {
      toggledGroups.set(group.key, details.open);
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

    const items = document.createElement('ul');
    items.className = 'history-group-items';
    for (const item of group.items) {
      items.appendChild(createHistoryItem(item));
    }
    details.appendChild(items);

    li.appendChild(details);
    list.appendChild(li);
  }

  moreButton.hidden = !hasMore;
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

  const data = await browser.storage.local.get('presets');
  const presets = Array.isArray(data.presets) ? data.presets : [];

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
  size.textContent = `  ${preset.width}×${preset.height}`;
  button.appendChild(size);

  button.addEventListener('click', function () {
    openWithPreset(url, preset);
  });
  return button;
}

// 履歴項目の右クリックメニュー（階層なしでプリセットを直接選択）
async function showContextMenu(x, y, url) {
  closeContextMenu();

  const data = await browser.storage.local.get('presets');
  const presets = Array.isArray(data.presets) ? data.presets : [];

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
