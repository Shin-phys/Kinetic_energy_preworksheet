// タイムアタックの進行（仕様書 v2 6.2）。DOMに依存しない。時間は now() を注入できる。
// - 全問に正解するまで終わらない（1問ずつ正解してから次へ）
// - 誤答の回数を問題ごとに数える（1回目：ヒント、2回目以降：正答表示）
import { judge } from './answer.js';

export class Session {
  /**
   * @param {object} o
   * @param {Array} o.questions  出題順に並んだ問題
   * @param {() => number} [o.now] ミリ秒を返す関数
   */
  constructor({ questions, now = () => performance.now() }) {
    this.questions = [...questions];
    this.now = now;
    this.index = 0;
    this.wrongs = new Map();      // id → 誤答回数
    this.firstWrong = new Map();  // id → 最初の誤答
    this.misses = 0;              // 誤答の総回数
    this.startedAt = null;
    this.endedAt = null;
  }

  get total() { return this.questions.length; }
  get current() { return this.questions[this.index] ?? null; }
  get finished() { return this.endedAt != null; }
  /** 今の問題での誤答回数 */
  get currentWrongs() { return this.current ? (this.wrongs.get(this.current.id) ?? 0) : 0; }

  start() { this.startedAt = this.now(); }

  get elapsedSec() {
    if (this.startedAt == null) return 0;
    return ((this.endedAt ?? this.now()) - this.startedAt) / 1000;
  }

  /** 解答を提出。{ correct, wrongs } を返す。正解でも自動では進まない（画面側で advance） */
  submit(answer) {
    const q = this.current;
    if (!q || this.finished) return null;
    const correct = judge(q, answer);
    if (!correct) {
      const n = (this.wrongs.get(q.id) ?? 0) + 1;
      this.wrongs.set(q.id, n);
      if (n === 1) this.firstWrong.set(q.id, answer);
      this.misses += 1;
    }
    return { correct, wrongs: this.wrongs.get(q.id) ?? 0 };
  }

  /** 次の問題へ。最後なら終了 */
  advance() {
    this.index += 1;
    if (this.index >= this.questions.length) this.endedAt = this.now();
  }

  summary() {
    const missed = this.questions
      .filter(q => this.wrongs.has(q.id))
      .map(q => ({ q, firstAnswer: this.firstWrong.get(q.id), wrongs: this.wrongs.get(q.id) }))
      .sort((a, b) => (a.q.no ?? 999) - (b.q.no ?? 999) || a.q.id.localeCompare(b.q.id));
    return {
      n: this.total,
      timeSec: Math.round(this.elapsedSec * 10) / 10,
      misses: this.misses,
      noMiss: this.misses === 0,
      missed,
    };
  }
}
