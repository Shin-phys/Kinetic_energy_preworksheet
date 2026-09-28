// 問題データの構成チェック:  node tools/validate.mjs
// - 本番20問：No.1〜20、前半・後半とも A5・B2・C2・D1、A5・A8・C1 を含む
// - 腕試し：群ごとの抽出に足りる数
// - id 重複、項トークン、ヒント、図テンプレートの存在
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

for (const q of [...bank.main, ...bank.basic, ...bank.advanced]) {
  const ans = q.applicable
    ? { start: [...q.start].reverse(), end: [...q.end].reverse(), notApplicable: false }
    : { start: [], end: [], notApplicable: true };
  if (!judge(q, ans)) errors.push(`${q.id}: 正答で判定が通らない`);
}

if (errors.length) {
  console.error(`✗ ${errors.length} 件の問題があります`);
  errors.forEach(e => console.error('  - ' + e));
  process.exit(1);
}
console.log('本番20問');
for (const q of bank.main) console.log(`  No.${String(q.no).padStart(2)} ${q.type} ${formatEquation(q).padEnd(18)} ${q.text.slice(0, 28)}…`);
console.log(`腕試し：基礎 ${bank.basic.length}問／難関 ${bank.advanced.length}問`);
console.log('✓ OK');
