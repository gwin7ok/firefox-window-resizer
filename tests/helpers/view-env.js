// 画面スクリプトを、偽の DOM とモックした browser API で読み込むためのヘルパー。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { FakeDocument } = require('./fake-dom');
const { makeBrowser, noopLogger, plain } = require('./mock-browser');

const ROOT = path.join(__dirname, '..', '..');

// options:
//   scripts   読み込む画面スクリプト（リポジトリルートからの相対パス。store.js などの共通部品も含める）
//   elements  HTML に存在する要素 [{ id, tag }]
//   storage   初期のストレージ
//   search    window.location.search
//   confirm   confirm() の戻り値（既定 true）
//   windows   windows.get が返すウィンドウ { id: window }、windowsAll が getAll の戻り値
function createViewEnv(options = {}) {
  const mock = makeBrowser({ storage: options.storage });
  const { browser, calls } = mock;
  calls.messages = [];
  calls.alerts = [];
  calls.confirms = [];
  calls.windowClose = 0;

  browser.runtime.sendMessage = async (m) => { calls.messages.push(plain(m)); };
  browser.windows.getCurrent = async () => ({ id: 1 });
  browser.windows.get = async (id) => {
    const found = (options.windows || {})[id];
    if (!found) throw new Error('No window with id ' + id);
    return found;
  };
  if (options.windowsAll) {
    browser.windows.getAll = async () => options.windowsAll;
  }

  const document = new FakeDocument();
  const elements = {};
  for (const { id, tag } of options.elements || []) {
    elements[id] = document.register(id, tag);
  }

  const window = {
    location: { search: options.search || '' },
    close: () => { calls.windowClose++; },
    addEventListener() {},
  };

  const sandbox = {
    document, window, browser, Logger: noopLogger,
    alert: (m) => { calls.alerts.push(String(m)); },
    confirm: (m) => { calls.confirms.push(String(m)); return options.confirm !== false; },
    URLSearchParams, console, setTimeout, clearTimeout, Promise, Date, Math, Set, Map, Array, Object, JSON,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
  };
  vm.createContext(sandbox);

  for (const rel of options.scripts || []) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      // 共通部品は node 用の module.exports 分岐ではなく、ブラウザ用の分岐を通す
      .replace(/typeof self !== 'undefined' \? self : this/g, 'globalThis');
    vm.runInContext(code, sandbox, { filename: rel });
  }

  // fire-and-forget の非同期処理（await されていない呼び出し）が落ち着くまで待つ
  const flush = async (times = 10) => {
    for (let i = 0; i < times; i++) await new Promise((r) => setTimeout(r, 0));
  };

  return { sandbox, document, window, browser, calls, store: mock.store, listeners: mock.listeners, elements, flush };
}

module.exports = { createViewEnv, plain };
