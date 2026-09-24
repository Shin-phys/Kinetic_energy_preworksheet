// 結果画面：スコア、推移グラフ、誤答パターンの trap 解説まとめ
import { h, esc, fmtClock, toast } from '../ui.js';
import { formatEquation, formatAnswer } from '../core/answer.js';
import { renderDiagram } from '../diagrams.js';
import { renderChart } from '../chart.js';
import { loadRecords, graduationStatus, resultCode, copyText, updateRecord } from '../storage.js';
import { senderEnabled, sendRecord } from '../sender.js';
import { GRADUATION } from '../config.js';

export function renderResult(root, app, { mode, summary, record, version, title = '' }) {
  const isExam = mode === 'exam';
  const records = loadRecords();
  let gradNow = null, gradNew = false;
  if (isExam) {
    gradNow = graduationStatus(records);
    const before = graduationStatus(records.slice(0, -1));
    gradNew = gradNow.graduated && !before.graduated;
  }

  // ---- 見出し ----
  let headline;
  if (isExam && summary.rule === 'time') {
    headline = `<div class="score"><span class="score-big">${summary.correct}</span><span class="score-unit">/ ${summary.total} 問 正解</span></div>
      <p class="score-sub">${summary.answered}問に解答・制限時間 ${fmtClock(record.limitSec)}${summary.answered < summary.total ? '' : `・${summary.timeSec.toFixed(1)}秒で全問解答`}</p>`;
  } else if (isExam) {
    headline = `<div class="score"><span class="score-big">${summary.timeSec.toFixed(1)}</span><span class="score-unit">秒で全問正解</span></div>
      <p class="score-sub">誤答 ${summary.misses}回</p>`;
  } else {
    headline = `<div class="score"><span class="score-big">${summary.correct}</span><span class="score-unit">/ ${summary.total} 問 1回目で正解</span></div>
      <p class="score-sub">練習モード（記録には残りません）</p>`;
  }

  const gradHtml = !isExam ? '' : gradNew
    ? `<div class="grad grad-done grad-new">卒業ライン達成！ ${GRADUATION.limitSec}秒で${GRADUATION.minCorrect}問以上を${GRADUATION.streak}回連続。次は数値入りの文章題へ。</div>`
    : gradNow.graduated ? '' : (record.rule === 'time' && record.limitSec === GRADUATION.limitSec
      ? `<div class="grad">卒業まで：${GRADUATION.minCorrect}問以上を<b>あと${gradNow.need}回</b>連続</div>` : '');

  // ---- 誤答の振り返り（パターンごとにまとめる） ----
  const byType = new Map();
  for (const r of summary.wrongAnswers) {
    if (!byType.has(r.q.type)) byType.set(r.q.type, []);
    byType.get(r.q.type).push(r);
  }
  const review = [...byType.entries()].map(([type, list]) => {
    const q = list[0].q;
    const items = list.map(r => `<li><span class="rv-q">${esc(r.q.text)}</span><span class="rv-your">あなたの答え：${esc(formatAnswer(r.answer))}</span></li>`).join('');
    return `<article class="rv-card">
      <div class="rv-dg">${renderDiagram(q.diagram, q.label)}</div>
      <div class="rv-body">
        <h3><span class="rv-type">${esc(type)}</span>${esc(q.patternName)}</h3>
        <p class="rv-eq">正解：<b>${esc(formatEquation(q))}</b></p>
        <p class="rv-trap">${esc(q.trap)}</p>
        <ul class="rv-list">${items}</ul>
      </div>
    </article>`;
  }).join('');

  const canSend = isExam && senderEnabled();
  const el = h(`<div class="result">
    <header class="result-head">
      <p class="result-mode">${isExam ? `本番・バージョン${version}` : `練習${title ? `・${esc(title)}` : `・バージョン${version}`}`}</p>
      ${headline}
      ${gradHtml}
    </header>

    <div class="result-actions">
      <button class="btn btn-primary" data-again><kbd class="kb">Enter</kbd>もう一度${isExam ? '（本番）' : ''}</button>
      ${summary.wrongQuestions.length ? '<button class="btn" data-retry-wrong>まちがえた問題だけ練習</button>' : ''}
      <button class="btn" data-home><kbd class="kb">Esc</kbd>ホーム</button>
    </div>

    ${isExam ? `<section class="panel">
      <h2>これまでの推移</h2>
      <div class="result-chart"></div>
      <div class="export-row">
        <button class="btn btn-small" data-copy>結果コードをコピー</button>
        ${canSend ? '<button class="btn btn-small" data-send>記録を送信</button>' : ''}
        <code class="code-preview">${esc(resultCode(record))}</code>
      </div>
    </section>` : ''}

    <section class="panel">
      <h2>振り返り</h2>
      ${review || '<p class="all-ok">まちがえた問題はありません。</p>'}
    </section>
  </div>`);
  root.appendChild(el);

  if (isExam) {
    const same = records.filter(r => r.rule === record.rule && (r.rule !== 'time' || r.limitSec === record.limitSec));
    renderChart(el.querySelector('.result-chart'), same, record.rule, { total: record.total });
  }

  const again = () => app.go('play', { mode });
  const home = () => app.go('home');
  const doSend = async btn => {
    btn.disabled = true; btn.textContent = '送信中…';
    try {
      await sendRecord(record);
      updateRecord(record.id, { sent: true });
      btn.textContent = '送信済み';
      toast('送信しました');
    } catch (err) {
      btn.disabled = false; btn.textContent = '再送信';
      toast(`送信できませんでした：${err.message}`);
    }
  };

  el.addEventListener('click', async e => {
    if (e.target.closest('[data-again]')) again();
    else if (e.target.closest('[data-home]')) home();
    else if (e.target.closest('[data-retry-wrong]')) app.go('play', { mode: 'practice', questions: summary.wrongQuestions, title: 'まちがえた問題' });
    else if (e.target.closest('[data-copy]')) toast((await copyText(resultCode(record))) ? 'コピーしました。フォームに貼り付けてください' : 'コピーできませんでした');
    else if (e.target.closest('[data-send]')) doSend(e.target.closest('[data-send]'));
  });

  // 出席番号が設定されていれば自動送信
  if (canSend && record.student) doSend(el.querySelector('[data-send]'));

  const onKey = e => {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'Enter') { e.preventDefault(); again(); }
    if (e.key === 'Escape') { e.preventDefault(); home(); }
  };
  // 直前の Enter 連打で即再開しないよう少し待ってから受け付ける
  const t = setTimeout(() => document.addEventListener('keydown', onKey), 700);
  return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
}
