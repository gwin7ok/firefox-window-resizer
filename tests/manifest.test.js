// manifest.json が参照するファイルと、HTML から読み込むスクリプト/CSS が存在することを検証する。
// （ファイルを削除・改名した際の読み込み漏れを検知する）
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

let count = 0;
function exists(rel, from) {
  const full = path.resolve(from, rel);
  assert.ok(fs.existsSync(full), `missing file: ${path.relative(root, full)} (referenced from ${path.relative(root, from) || 'manifest.json'})`);
  count++;
}

// manifest が直接参照するファイル
const iconSets = [manifest.icons, manifest.browser_action && manifest.browser_action.default_icon,
  manifest.sidebar_action && manifest.sidebar_action.default_icon];
for (const set of iconSets) {
  for (const rel of Object.values(set || {})) exists(rel, root);
}
exists(manifest.browser_action.default_popup, root);
exists(manifest.options_ui.page, root);
exists(manifest.sidebar_action.default_panel, root);
for (const rel of manifest.background.scripts) exists(rel, root);

// 各HTMLが読み込む script / stylesheet
const htmlFiles = new Set([
  manifest.browser_action.default_popup,
  manifest.options_ui.page,
  manifest.sidebar_action.default_panel,
  'views/preset-editor.html',
]);
for (const html of htmlFiles) {
  const htmlPath = path.join(root, html);
  const text = fs.readFileSync(htmlPath, 'utf8');
  const refs = [...text.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\shref)="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    if (/^(https?:|data:)/.test(ref)) continue;
    exists(ref, path.dirname(htmlPath));
  }
}

// 使っていない権限が混ざっていないかの簡易確認（宣言済みの権限だけを許可）
const allowed = new Set(['storage', 'tabs', 'contextMenus', 'bookmarks', 'history']);
for (const p of manifest.permissions) {
  assert.ok(allowed.has(p), `unexpected permission: ${p} (update tests/manifest.test.js if intentional)`);
}

console.log(`PASS manifest/HTML references (${count} files checked), permissions: ${manifest.permissions.join(', ')}`);
