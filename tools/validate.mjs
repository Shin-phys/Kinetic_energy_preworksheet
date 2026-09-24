// 問題データの構成チェック:  node tools/validate.mjs
// - 各バージョン20問（A10・B4・C4・D2）、A5/A8/C1/A6/A7 を含む
// - id 重複、項トークン、図テンプレートの存在
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBank, validateBank } from '../js/core/questions.js';
import { judge, formatEquation } from '../js/core/answer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(readFileSync(join(root, p), 'utf8'));

const bank = buildBank(read('data/patterns.json'), read('data/questions.json'));
const errors = validateBank(bank, {
  diagramExists: id => existsSync(join(root, 'assets/diagrams', `${id}.svg`)),
});

// 正答そのものを入れたら正解になるか（判定ロジックの自己テスト）
for (const v of bank.versions) {
  for (const q of v.questions) {
    const ans = q.applicable
      ? { start: [...q.start].reverse(), end: [...q.end].reverse(), notApplicable: false }
      : { start: [], end: [], notApplicable: true };
    if (!judge(q, ans)) errors.push(`${q.id}: 正答で判定が通らない`);
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} 件の問題があります`);
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
for (const v of bank.versions) {
  console.log(`バージョン${v.version}（${v.theme}）`);
  for (const q of v.questions) console.log(`  ${q.id.padEnd(7)} ${formatEquation(q)}`);
}
console.log(`✓ OK: ${bank.versions.length}バージョン × 20問`);
