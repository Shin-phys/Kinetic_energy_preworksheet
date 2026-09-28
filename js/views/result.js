// 結果画面（仕様書 v2 6.4）：タイム・称号 → ミスした問題（No.順）→ 推移グラフ → 書き出し
import { h, esc, toast } from '../ui.js';
import { formatEquation, formatAnswer } from '../core/answer.js';
import { COURSES } from '../core/questions.js';
import { TITLES, nextGap, titleLabel } from '../core/titles.js';
import { renderDiagram } from '../diagrams.js';
import { renderChart } from '../chart.js';
import { loadRecords, recordsOf, collection, resultCode, copyText, updateRecord, timeFactor } from '../storage.js';
import { senderEnabled, sendRecord } from '../sender.js';
import { TITLE_TIMES } from '../config.js';

const MODE_LABEL = { main: '本番', practice: '練習', challenge: '腕試し' };

export function renderResult(root, app, { mode, course, summary, record = null, before = [], title = '' }) {
  const timed = mode !== 'practice';

  // ---- 見出し・称号 ----
  let head = '';
  if (timed) {
    const prev = recordsOf(before, course);
    const prevBest = prev.length ? Math.min(...prev.map(r => r.timeSec)) : null;
    const newBest = prevBest == null || record.timeSec < prevBest;
    const coll = collection(before);
    const cell = coll[record.level];
    const newTitle = !cell.plain.size || (record.star && !cell.star.size);
    const gap = nextGap(record.timeSec, record.n, TITLE_TIMES, timeFactor(course));
    const gapName = gap ? (collection(loadRecords())[gap.level].plain.size ? gap.name : '？？？級') : '';
    const t = TITLES[record.level];
    head = `
      <div class="score"><span class="score-big">${record.timeSec.toFixed(1)}</span><span class="score-unit">秒</span></div>
      <p class="score-sub">${record.misses ? `ミス ${record.misses}回` : 'ノーミス'}${newBest && prevBest != null ? '・<b class="new">自己ベスト更新</b>' : ''}</p>
      <div class="title-card ${newTitle ? 'is-new' : ''}">
        ${newTitle ? '<p class="tc-new">新しい称号を獲得！</p>' : ''}
        <p class="tc-name">${esc(titleLabel(record.level, record.star))}</p>
        <p class="tc-speed">${esc(t.speed)}</p>
        ${newTitle ? `<p class="tc-trivia">${esc(t.trivia)}</p>` : ''}
      </div>
      ${gap ? `<p class="next-gap">あと <b>${gap.gap.toFixed(1)}秒</b> 速ければ <b>${esc(gapName)}</b>（${gap.limit}秒以内）${record.star ? '' : '／ノーミスなら ★'}</p>` : '<p class="next-gap">最上位の称号です。</p>'}`;
  } else {
    head = `
      <div class="score"><span class="score-big">${summary.n - summary.missed.length}</span><span class="score-unit">/ ${summary.n} 問 1回目で正解</span></div>
      <p class="score-sub">練習（記録なし）</p>`;
  }

  // ---- ミスした問題の一覧（No.順） ----
  const missed = summary.missed.map(({ q, firstAnswer, wrongs }) => `
    <article class="rv-card">
      <div class="rv-body">
        <h3>${q.no ? `<span class="rv-no">No.${q.no}</span>` : ''}<span class="rv-type">${esc(q.type)}</span>${esc(q.patternName)}</h3>
        <p class="rv-q">${esc(q.text)}</p>
        <p class="rv-eq">正解：<b>${esc(formatEquation(q))}</b></p>
        <p class="rv-your">最初の答え：${esc(formatAnswer(firstAnswer))}（ミス ${wrongs}回）</p>
        <p class="rv-trap">${esc(q.trap)}</p>
      </div>
      <div class="rv-dg">${renderDiagram(q.diagram, q.label)}</div>
    </article>`).join('');

  const canSend = timed && senderEnabled();
  const el = h(`<div class="result mode-${mode}">
    <header class="result-head">
      <p class="result-mode"><span class="mode-chip">${MODE_LABEL[mode]}</span>${esc(title || (mode === 'challenge' ? COURSES[course].label.replace('腕試し・', '') : COURSES[course].label))}${timed ? '<span class="saved">記録しました</span>' : ''}</p>
      ${head}
    </header>

    <div class="result-actions">
      <button class="btn btn-primary" data-again><kbd class="kb">Enter</kbd>もう一度</button>
      ${summary.missed.length ? '<button class="btn" data-retry-wrong>まちがえた問題だけ練習</button>' : ''}
      <button class="btn" data-zukan>称号図鑑</button>
      <button class="btn" data-home><kbd class="kb">Esc</kbd>ホーム</button>
    </div>

    <section class="panel">
      <h2>ミスした問題 <span class="muted small">${summary.missed.length ? '（プリントの同じ No. にメモしよう）' : ''}</span></h2>
      ${missed || '<p class="all-ok">ミスした問題はありません。</p>'}
    </section>

    ${timed ? `<section class="panel">
      <h2>${esc(COURSES[course].label)}の記録</h2>
      <div class="result-chart"></div>
      <div class="export-row">
        <button class="btn btn-small" data-copy>結果コードをコピー</button>
        ${canSend ? '<button class="btn btn-small" data-send>記録を送信</button>' : ''}
        <code class="code-preview">${esc(resultCode(record))}</code>
      </div>
    </section>` : ''}
  </div>`);
  root.appendChild(el);

  if (timed) renderChart(el.querySelector('.result-chart'), recordsOf(loadRecords(), course), course);

  const again = () => app.go('play', { mode, course });
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
    else if (e.target.closest('[data-zukan]')) app.go('zukan');
    else if (e.target.closest('[data-retry-wrong]')) app.go('play', { mode: 'practice', course, questions: summary.missed.map(m => m.q), title: 'まちがえた問題' });
    else if (e.target.closest('[data-copy]')) toast((await copyText(resultCode(record))) ? 'コピーしました。フォームに貼り付けてください' : 'コピーできませんでした');
    else if (e.target.closest('[data-send]')) doSend(e.target.closest('[data-send]'));
  });
  if (canSend && record.student) doSend(el.querySelector('[data-send]'));

  const onKey = e => {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'Enter') { e.preventDefault(); again(); }
    if (e.key === 'Escape') { e.preventDefault(); home(); }
  };
  // 直前の Enter 連打で即再開しないよう少し待つ
  const t = setTimeout(() => document.addEventListener('keydown', onKey), 800);
  return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); };
}
