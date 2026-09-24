// node --test tests/   （判定・操作・進行ロジックのテスト）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressTerm, tapChip, judge, formatEquation } from '../js/core/answer.js';
import { Session } from '../js/core/session.js';

const q = (type, start, end, extra = {}) => ({ id: type, type, start, end, applicable: true, ...extra });

test('U タイルは +U → −U → 取り消し の3段トグル', () => {
  let b = pressTerm([], 'U');
  assert.deepEqual(b, ['U']);
  b = pressTerm(b, 'U');
  assert.deepEqual(b, ['-U']);
  b = pressTerm(b, 'U');
  assert.deepEqual(b, []);
});

test('K/E は再タップで取り消し、チップのタップも同じ遷移', () => {
  assert.deepEqual(pressTerm(['K'], 'K'), []);
  assert.deepEqual(tapChip(['K', '-U'], '-U'), ['K']);
  assert.deepEqual(tapChip(['K', 'U'], 'U'), ['K', '-U']);
  assert.deepEqual(pressTerm(['E'], 'K'), ['K', 'E']); // 並びは K,U,E に整える
});

test('判定は集合一致（順序不問・U は符号込み）', () => {
  const a8 = q('A8', ['U'], ['K', '-U']);
  assert.equal(judge(a8, { start: ['U'], end: ['-U', 'K'] }), true);
  assert.equal(judge(a8, { start: ['U'], end: ['K', 'U'] }), false);
  assert.equal(judge(a8, { start: ['U'], end: ['K'] }), false);
  assert.equal(formatEquation(a8), 'U = K + (−U)');
});

test('D群は「使えない」のみ正解、それ以外の問題で「使えない」は不正解', () => {
  const d1 = { id: 'D1', type: 'D1', applicable: false, start: null, end: null };
  assert.equal(judge(d1, { start: [], end: [], notApplicable: true }), true);
  assert.equal(judge(d1, { start: ['U'], end: ['K'], notApplicable: false }), false);
  assert.equal(judge(q('A1', ['U'], ['K']), { start: [], end: [], notApplicable: true }), false);
});

test('本番 time ルール：時間切れで終了し、所要時間は制限時間で打ち切り', () => {
  let t = 0;
  const qs = [q('A1', ['U'], ['K']), q('A3', ['K'], ['U']), q('B1', ['E'], ['K'])];
  const s = new Session({ questions: qs, mode: 'exam', rule: 'time', limitSec: 10, now: () => t });
  s.start();
  t = 3000; s.submit({ start: ['U'], end: ['K'] });
  t = 5000; s.submit({ start: ['U'], end: ['K'] }); // 誤答
  t = 11000; s.advance();
  assert.equal(s.finished, true);
  const sum = s.summary();
  assert.equal(sum.correct, 1);
  assert.equal(sum.answered, 2);
  assert.equal(sum.timeSec, 10);
  assert.deepEqual(sum.wrongTypes, ['A3']);
});

test('本番 complete ルール：誤答は末尾に回り、全問正解で終了', () => {
  let t = 0;
  const qs = [q('A1', ['U'], ['K']), q('A5', ['K'], ['K', 'U'])];
  const s = new Session({ questions: qs, mode: 'exam', rule: 'complete', now: () => t });
  s.start();
  s.submit({ start: ['U'], end: ['K'] });
  s.submit({ start: ['K'], end: ['U'] });        // A5 誤答 → 末尾へ
  assert.equal(s.current.type, 'A5');
  t = 7500; s.submit({ start: ['K'], end: ['U', 'K'] });
  assert.equal(s.finished, true);
  const sum = s.summary();
  assert.equal(sum.correct, 2);
  assert.equal(sum.misses, 1);
  assert.equal(sum.timeSec, 7.5);
});
