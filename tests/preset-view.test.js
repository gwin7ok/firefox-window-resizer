// プリセット表示の共通処理（scripts/store.js の表示用関数、views/preset-view.js）の検証。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const store = require(path.join(__dirname, '..', 'scripts', 'store.js'));
let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

// 表示用の文字列
const preset = { id: 'p', name: '左半分\nフルHD', width: 960, height: 1080, left: -10, top: 0 };
assert.strictEqual(store.formatSize(preset), '960×1080');
assert.strictEqual(store.formatPosition(preset), '(-10, 0)');
assert.strictEqual(store.singleLineName(preset.name), '左半分 フルHD');
assert.strictEqual(store.singleLineName('a\nb\nc'), 'a b c');
assert.strictEqual(store.singleLineName('単一行'), '単一行');
ok('formatSize / formatPosition / singleLineName');

// 行へのセル追加（DOM スタブ）
class El {
  constructor(tag) { this.tagName = tag; this.children = []; this.className = ''; this.textContent = ''; }
  appendChild(c) { this.children.push(c); return c; }
}
const sandbox = { document: { createElement: (t) => new El(t) }, FwrStore: store };
vm.createContext(sandbox);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'views', 'preset-view.js'), 'utf8')
    .replace(/typeof self !== 'undefined' \? self : this/, 'globalThis'),
  sandbox
);
const View = sandbox.FwrPresetView;

const row = new El('tr');
View.appendInfoCells(row, preset, { name: 'preset-name', size: 'preset-size', position: 'preset-position' });
assert.deepStrictEqual(
  row.children.map((c) => [c.tagName, c.className, c.textContent]),
  [['td', 'preset-name', '左半分\nフルHD'], ['td', 'preset-size', '960×1080'], ['td', 'preset-position', '(-10, 0)']]
);
ok('appendInfoCells: name / size / position cells with classes');

const plain = new El('tr');
View.appendInfoCells(plain, preset);
assert.deepStrictEqual(plain.children.map((c) => c.className), ['', '', '']);
assert.deepStrictEqual(plain.children.map((c) => c.textContent), ['左半分\nフルHD', '960×1080', '(-10, 0)']);
ok('appendInfoCells: works without class names');

console.log(`\n${n} tests passed`);
