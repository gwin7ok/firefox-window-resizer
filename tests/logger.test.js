// scripts/logger.js の検証: レベルによる出力制御、グループ化、戻り値と例外の扱い。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

function load() {
  const events = [];
  const rec = (type) => (...args) => events.push([type, ...args]);
  const sandbox = {
    console: {
      log: rec('log'), info: rec('info'), warn: rec('warn'), error: rec('error'), debug: rec('debug'),
      table: rec('table'), group: rec('group'), groupEnd: rec('groupEnd'),
    },
  };
  vm.createContext(sandbox);
  // 通常のスクリプトと同様に評価し、トップレベルの const を取り出す
  const code = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'logger.js'), 'utf8') + '\n;this.__Logger = Logger;';
  vm.runInContext(code, sandbox, { filename: 'logger.js' });
  return { Logger: sandbox.__Logger, events };
}

let n = 0; const ok = (m) => { n++; console.log('PASS', m); };

(async () => {
  // 既定: すべて出力。複数引数をそのまま渡す
  {
    const { Logger, events } = load();
    Logger.debug('d'); Logger.info('i', { a: 1 }, '%'); Logger.warn('w'); Logger.error('e', new Error('x')); Logger.table({ k: 1 });
    assert.deepStrictEqual(events.map((e) => e[0]), ['debug', 'log', 'warn', 'error', 'table']);
    assert.strictEqual(events[1].length, 4, 'all arguments are forwarded');
    ok('default level prints everything and forwards all arguments');
  }

  // レベルによる抑制
  {
    const { Logger, events } = load();
    Logger.level = Logger.LEVEL.WARN;
    Logger.debug('d'); Logger.info('i'); Logger.table({}); Logger.warn('w'); Logger.error('e');
    assert.deepStrictEqual(events.map((e) => e[0]), ['warn', 'error']);
    Logger.level = Logger.LEVEL.NONE;
    Logger.error('hidden');
    assert.strictEqual(events.length, 2);
    ok('level filters debug/info/table below the threshold');
  }

  // グループ化: 戻り値、ネスト、終了
  {
    const { Logger, events } = load();
    const result = await Logger.logPresetOperation('保存', async () => {
      await Logger.logSystemOperation('内側', async () => { Logger.info('inner'); });
      return 42;
    });
    assert.strictEqual(result, 42);
    assert.deepStrictEqual(events.map((e) => e[0]), ['group', 'group', 'log', 'groupEnd', 'groupEnd']);
    assert.strictEqual(events[0][1], 'プリセット: 保存');
    assert.strictEqual(events[1][1], 'システム: 内側');
    ok('group helpers nest, close, and return the callback result');
  }

  // 例外: グループを閉じて再スロー
  {
    const { Logger, events } = load();
    await assert.rejects(
      Logger.logDprOperation('失敗', async () => { throw new Error('boom'); }),
      /boom/
    );
    assert.deepStrictEqual(events.map((e) => e[0]), ['group', 'groupEnd']);
    ok('group closes and rethrows errors');
  }

  // 抑制時もコールバックは実行される
  {
    const { Logger, events } = load();
    Logger.level = Logger.LEVEL.ERROR;
    const result = await Logger.logWindowOperation('x', async () => 'ok');
    assert.strictEqual(result, 'ok');
    assert.strictEqual(events.length, 0);
    ok('callback runs even when output is suppressed');
  }

  console.log(`\n${n} tests passed`);
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
