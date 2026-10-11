// tests/*.test.js を順に実行する（Node 標準機能のみ）。
// 実行: node tests/run.js
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
let failed = 0;

for (const file of files) {
  console.log(`\n=== ${file} ===`);
  const result = spawnSync(process.execPath, [path.join(__dirname, file)], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed++;
    console.error(`FAILED: ${file}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed === 0 ? 0 : 1);
