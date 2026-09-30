// npm test（判定・ヒント・タイムアタック・称号のテスト）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressTerm, judge, formatEquation, formatAnswer, hintsFor } from '../js/core/answer.js';
import { buildBank, buildCourse, validateBank } from '../js/core/questions.js';
import { readFileSync } from 'node:fs';
import { Session } from '../js/core/session.js';
import { thresholds, levelFor, nextGap, TITLES } from '../js/core/titles.js';

const q = (type, start, end, extra = {}) => ({ id: type, type, start, end, applicable: true,
  hint: { start: 'はじめH', end: 'あとH' }, ...extra });

test('U は 消灯 → U → −U → 消灯、K/E は再押しで消える', () => {
  let b = pressTerm([], 'U');
  assert.deepEqual(b, ['U']);
  b = pressTerm(b, 'U');
  assert.deepEqual(b, ['-U']);
  b = pressTerm(b, 'U');
  assert.deepEqual(b, []);
  assert.deepEqual(pressTerm(['K'], 'K'), []);
  assert.deepEqual(pressTerm(['E'], 'K'), ['K', 'E']);
});

test('判定は集合一致（順序不問・U は符号込み）', () => {
  const a8 = q('A8', ['U'], ['K', '-U']);
  assert.equal(judge(a8, { start: ['U'], end: ['-U', 'K'] }), true);
  assert.equal(judge(a8, { start: ['U'], end: ['K', 'U'] }), false);
  assert.equal(formatEquation(a8), 'mgh₀ = ½mv² − mgh');
  assert.equal(formatEquation(q('A2', ['K', 'U'], ['K'])), '½mv₀² + mgh₀ = ½mv²');
});

test('ヒントは違っている行だけ出す', () => {
  const a5 = q('A5', ['K'], ['K', 'U']);
  assert.deepEqual(hintsFor(a5, { start: ['K'], end: ['U'] }), ['【あと】あとH']);
  assert.deepEqual(hintsFor(a5, { start: ['U'], end: ['U'] }), ['【はじめ】はじめH', '【あと】あとH']);
  assert.deepEqual(hintsFor(a5, { start: [], end: [], notApplicable: true }, { notApplicable: '摩擦？' }), ['摩擦？']);
  const d1 = { id: 'D1', applicable: false, hint: { equation: '面を読もう' } };
  assert.deepEqual(hintsFor(d1, { start: ['U'], end: ['K'] }), ['面を読もう']);
});

test('タイムアタック：全問正解で終了、誤答回数と最初の誤答を記録', () => {
  let t = 0;
  const qs = [q('A1', ['U'], ['K'], { no: 2 }), q('A3', ['K'], ['U'], { no: 1 })];
  const s = new Session({ questions: qs, now: () => t });
  s.start();
  t = 2000; assert.equal(s.submit({ start: ['U'], end: ['K'] }).correct, true); s.advance();
  t = 3000; assert.deepEqual(s.submit({ start: ['K'], end: ['K'] }), { correct: false, wrongs: 1 });
  t = 5000; assert.deepEqual(s.submit({ start: ['K'], end: ['E'] }), { correct: false, wrongs: 2 });
  assert.equal(s.finished, false);
  t = 7500; assert.equal(s.submit({ start: ['K'], end: ['U'] }).correct, true); s.advance();
  assert.equal(s.finished, true);
  const sum = s.summary();
  assert.equal(sum.timeSec, 7.5);
  assert.equal(sum.misses, 2);
  assert.equal(sum.noMiss, false);
  assert.equal(sum.missed.length, 1);
  assert.deepEqual(sum.missed[0].firstAnswer.end, ['K']);
});

test('称号：等比の区分、20問は2倍、次の級までの差', () => {
  const times = { walk: 120, light: 23 };
  const th10 = thresholds(10, times);
  assert.deepEqual(th10.slice(1), [120, 98, 79, 65, 53, 43, 35, 28, 23]);
  assert.equal(thresholds(20, times)[9], 46);
  assert.equal(levelFor(200, 10, times), 0);
  assert.equal(levelFor(53, 10, times), 5);
  assert.equal(levelFor(22, 10, times), TITLES.length - 1);
  assert.deepEqual(nextGap(55, 10, times), { level: 5, name: '音速級', gap: 2, limit: 53 });
  assert.equal(nextGap(20, 10, times), null);
});

test('−mgh は最後に並べる・片方の辺が 0 の式', () => {
  assert.equal(formatEquation(q('H4a', ['K', '-U', 'E'], ['U', 'E'])), '½mv₀² + ½kx₀² − mgh₀ = mgh + ½kx²');
  assert.equal(formatEquation(q('H4b', [], ['-U', 'E'])), '0 = ½kx² − mgh');
  assert.deepEqual(pressTerm(pressTerm(['E'], 'U'), 'U'), ['E', '-U']);
  const h4b = q('H4b', [], ['-U', 'E']);
  assert.equal(judge(h4b, { start: [], end: ['E', '-U'] }), true);
  assert.equal(judge(h4b, { start: ['U'], end: ['E', '-U'] }), false);
  assert.equal(formatAnswer({ start: [], end: [], notApplicable: false }), '（何も選ばずに判定）');
});

test('「使えない」を選んだときのヒントは問題ごとに書ける', () => {
  const h5 = q('H5a', ['U'], ['U'], { hint: { start: 'a', end: 'b', notApplicable: '張力は仕事をする？' } });
  assert.deepEqual(hintsFor(h5, { start: [], end: [], notApplicable: true }, { notApplicable: '共通' }), ['張力は仕事をする？']);
  assert.deepEqual(hintsFor(q('A1', ['U'], ['K']), { start: [], end: [], notApplicable: true }, { notApplicable: '共通' }), ['共通']);
});

test('実データ：構成チェックが通り、難関は H1〜H4 各2・H5・H6 各1 で10問', () => {
  const read = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
  const bank = buildBank(read('data/patterns.json'), read('data/questions.json'));
  assert.deepEqual(validateBank(bank), []);
  for (let i = 0; i < 20; i++) {
    const c = buildCourse(bank, 'advanced');
    assert.equal(c.length, 10);
    const n = g => c.filter(x => x.group === g).length;
    assert.deepEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].map(n), [2, 2, 2, 2, 1, 1]);
  }
});
