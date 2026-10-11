// browser API のモック（背景スクリプトのテスト用）。呼び出しは calls に記録する。
const plain = (x) => JSON.parse(JSON.stringify(x));

// options:
//   storage            初期のストレージ内容
//   createdWindow      windows.create が返すウィンドウの上書き値（座標ずれの再現など）
function makeBrowser(options = {}) {
  const store = plain(options.storage || {});
  const calls = {
    windowsUpdate: [], windowsCreate: [], tabsCreate: [], tabsDuplicate: [], tabsMove: [], tabsRemove: [],
    tabsQuery: [], tabsGet: [], menus: [], sidebarOpen: 0,
  };
  const listeners = {};
  const ev = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  let nextTab = 100;
  let blankTabRemoved = false;

  const browser = {
    storage: {
      local: {
        get: async (keys) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          const out = {};
          arr.forEach((k) => { if (k in store) out[k] = plain(store[k]); });
          return out;
        },
        set: async (o) => { Object.assign(store, plain(o)); },
      },
      onChanged: ev('storage.onChanged'),
    },
    runtime: {
      onStartup: ev('onStartup'), onInstalled: ev('onInstalled'), onMessage: ev('onMessage'),
      getURL: (p) => 'moz-extension://x/' + p,
    },
    contextMenus: {
      removeAll: async () => { calls.menus = []; },
      create: (o) => { calls.menus.push(plain(o)); },
      onClicked: ev('menus.onClicked'),
    },
    sidebarAction: { open: async () => { calls.sidebarOpen++; } },
    bookmarks: { get: async (id) => [{ id, url: 'https://example.com/bm' }] },
    windows: {
      getAll: async () => [{ id: 1 }],
      getLastFocused: async () => ({ id: 1 }),
      getCurrent: async () => ({ id: 999 }),
      update: async (id, v) => { calls.windowsUpdate.push([id, plain(v)]); return { id, ...v }; },
      create: async (v) => {
        calls.windowsCreate.push(plain(v));
        return Object.assign({ id: 50, left: v.left, top: v.top, width: v.width, height: v.height }, options.createdWindow || {});
      },
    },
    tabs: {
      get: async (id) => { calls.tabsGet.push(id); return { id, title: 't' + id, url: 'https://e.example', windowId: 1 }; },
      query: async (q) => {
        calls.tabsQuery.push(plain(q));
        if (q.windowId === 50) {
          return blankTabRemoved
            ? [{ id: 7, url: 'https://e.example', windowId: 50 }]
            : [{ id: 11, url: 'about:blank', windowId: 50 }, { id: 7, url: 'https://e.example', windowId: 50 }];
        }
        if (q.active) return [{ id: 5, title: 'active', url: 'https://a.example', windowId: q.windowId }];
        return [];
      },
      create: async (o) => { calls.tabsCreate.push(plain(o)); return { id: nextTab++, windowId: o.windowId }; },
      duplicate: async (id) => { calls.tabsDuplicate.push(id); return { id: nextTab++, windowId: 1 }; },
      move: async (id, o) => { calls.tabsMove.push([id, plain(o)]); return [{ id, windowId: o.windowId }]; },
      remove: async (id) => { calls.tabsRemove.push(id); blankTabRemoved = true; },
      update: async () => ({}),
      sendMessage: async () => {},
    },
  };
  return { browser, store, calls, listeners, plain };
}

const noopLogger = new Proxy({}, {
  get: (_, k) => (String(k).startsWith('log') ? async (_title, fn) => fn() : async () => {}),
});

module.exports = { makeBrowser, noopLogger, plain };
