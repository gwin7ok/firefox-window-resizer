// 背景スクリプトを、manifest.json の background.scripts の順にモック環境へ読み込むヘルパー。
// 実際の拡張機能と同じ読み込み順で評価するため、読み込み順の誤り（未定義の関数参照など）をテストが検知できる。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// logger.js はテスト用のスタブに差し替える（コンソールを汚さないため）。
function loadBackground({ browser, Logger }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const scripts = manifest.background.scripts;

  const sandbox = { browser, Logger, console, setTimeout, clearTimeout, Promise };
  vm.createContext(sandbox);

  for (const rel of scripts) {
    if (rel === 'scripts/logger.js') {
      continue;
    }
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    vm.runInContext(code, sandbox, { filename: rel });
  }
  return { sandbox, scripts };
}

module.exports = { loadBackground };
