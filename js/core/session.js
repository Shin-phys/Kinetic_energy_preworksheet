// 1回分の進行（本番／練習）。DOMに依存しない。時間は now() を注入できる。
import { judge } from './answer.js';

export class Session {
  /**
   * @param {object} o
   * @param {Array} o.questions  出題順に並んだ問題
   * @param {'exam'|'practice'} o.mode
   * @param {'time'|'complete'} o.rule  exam のときのみ意味をもつ
   * @param {number} o.limitSec         rule=time の制限時間
   */
  constructor({ questions, mode = 'exam', rule = 'time', limitSec = 120, now = () => performance.now() }) {
    this.mode = mode;
    this.rule = mode === 'exam' ? rule : 'none';
    this.limitSec = limitSec;
    this.now = now;
    this.total = questions.length;
    this.queue = [...questions];
    this.index = 0;
    this.results = [];          // 各提出 {q, answer, correct, retry}
    this.solved = new Set();    // 正答済み id（complete ルール用）
    this.startedAt = null;
    this.endedAt = null;
  }

  start() { this.startedAt = this.now(); }

  get elapsedSec() {
    if (this.startedAt == null) return 0;
    return ((this.endedAt ?? this.now()) - this.startedAt) / 1000;
  }
  get remainingSec() { return Math.max(0, this.limitSec - this.elapsedSec); }
  get timeUp() { return this.rule === 'time' && this.elapsedSec >= this.limitSec; }

  get current() { return this.queue[this.index] ?? null; }
  /** 画面表示用の進捗（complete ルールでは正答済み数） */
  get progress() {
    if (this.rule === 'complete') return { done: this.solved.size, total: this.total };
    return { done: Math.min(this.index + 1, this.total), total: this.total };
  }

  get finished() {
    return this.endedAt != null;
  }

  /** 解答を提出。正誤を返す。練習モードでは自動で次に進まない */
  submit(answer, { retry = false } = {}) {
    const q = this.current;
    if (!q || this.finished) return null;
    const correct = judge(q, answer);
    this.results.push({ q, answer, correct, retry });
    if (correct) this.solved.add(q.id);

    if (this.mode === 'exam') {
      if (this.rule === 'complete' && !correct) this.queue.push(q); // 全問正答まで：誤答は末尾に回す
      this.advance();
    }
    return correct;
  }

  /** 次の問題へ（練習モードでは画面から呼ぶ） */
  advance() {
    this.index += 1;
    if (this.index >= this.queue.length || this.timeUp) this.finish();
  }

  finish() {
    if (this.endedAt == null) this.endedAt = this.now();
  }

  summary() {
    const first = this.results.filter(r => !r.retry);
    // 本番 time ルールで時間切れのとき、所要時間は制限時間で打ち切る
    const timeSec = this.rule === 'time' ? Math.min(this.elapsedSec, this.limitSec) : this.elapsedSec;
    const wrong = first.filter(r => !r.correct);
    // パターンIDは出現順・重複なし
    const wrongTypes = [...new Set(wrong.map(r => r.q.type))];
    const wrongQuestions = [];
    const seen = new Set();
    for (const r of wrong) if (!seen.has(r.q.id)) { seen.add(r.q.id); wrongQuestions.push(r.q); }
    return {
      mode: this.mode,
      rule: this.rule,
      total: this.total,
      answered: this.rule === 'complete' ? this.total : new Set(first.map(r => r.q.id)).size,
      correct: this.rule === 'complete' ? this.solved.size : first.filter(r => r.correct).length,
      misses: wrong.length,
      timeSec,
      wrongTypes,
      wrongQuestions,
      wrongAnswers: wrong,
    };
  }
}
